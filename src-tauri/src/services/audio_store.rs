use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::Serialize;
use thiserror::Error;
use tokio::fs;
use uuid::Uuid;

use super::audio_trimmer::{trim_trailing_silence, AudioTrimError, TrimConfig};
use crate::models::{Accent, AudioFile, AudioPart, BingoMode, NumberAudioPair};

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("Not an audio file of the app: {0}")]
    OutsideStore(String),
}

impl Serialize for StorageError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// The Trimmed Audio and Original Audio of every Voice, on disk under one root:
///
/// - `<root>/<accent>/<voice uuid>/<name>`: Trimmed Audio, the file the app plays.
/// - `<root>/Originals/<accent>/<voice uuid>/<name>`: Original Audio, kept in a parallel
///   tree so copying a voice directory only copies Trimmed Audio.
///
/// It is the only module that knows file names: `n45_word.mp3` (the Bingo 75 Word carries
/// its letter), `45_word.mp3` (Bingo 90) and `45_digit.mp3` (shared by both Bingo Modes).
#[derive(Debug, Clone)]
pub struct AudioStore {
    root: PathBuf,
}

impl AudioStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn voice_directory(&self, accent: Accent, voice: Uuid) -> PathBuf {
        self.root.join(accent.raw_value()).join(voice.to_string())
    }

    fn originals_directory(&self, accent: Accent, voice: Uuid) -> PathBuf {
        self.root
            .join("Originals")
            .join(accent.raw_value())
            .join(voice.to_string())
    }

    fn trimmed_path(
        &self,
        number: u32,
        accent: Accent,
        voice: Uuid,
        mode: BingoMode,
        part: AudioPart,
    ) -> PathBuf {
        self.voice_directory(accent, voice)
            .join(file_name(number, mode, part))
    }

    fn original_path(
        &self,
        number: u32,
        accent: Accent,
        voice: Uuid,
        mode: BingoMode,
        part: AudioPart,
    ) -> PathBuf {
        self.originals_directory(accent, voice)
            .join(file_name(number, mode, part))
    }

    /// Saves `original`, the audio exactly as ElevenLabs returned it, as the Original Audio,
    /// then its Trimmed Audio. When trimming fails, the Trimmed Audio is a copy of the
    /// Original Audio. Replaces any audio already saved for this part.
    pub async fn save(
        &self,
        number: u32,
        accent: Accent,
        voice: Uuid,
        mode: BingoMode,
        part: AudioPart,
        original: Vec<u8>,
    ) -> Result<AudioFile, StorageError> {
        // The Original Audio is only a safety net: failing to save it must not
        // lose a generation that has already spent characters.
        let original_path = self.original_path(number, accent, voice, mode, part);
        if let Err(e) = write_file(&original_path, &original).await {
            log::warn!(
                "[audio_store] Could not save Original Audio {}: {}",
                original_path.display(),
                e
            );
        }

        let path = self.trimmed_path(number, accent, voice, mode, part);
        let trimmed = trim_or_keep(original).await;
        write_file(&path, &trimmed).await?;

        Ok(AudioFile::new(
            number,
            part,
            accent,
            voice,
            mode,
            path.to_string_lossy().to_string(),
            Utc::now(),
        ))
    }

    /// The Trimmed Audio of one Voice in one Bingo Mode: its Words plus the shared Digits.
    pub async fn load(
        &self,
        accent: Accent,
        voice: Uuid,
        mode: BingoMode,
    ) -> Result<HashMap<u32, NumberAudioPair>, StorageError> {
        let directory = self.voice_directory(accent, voice);
        let mut result: HashMap<u32, NumberAudioPair> = HashMap::new();
        if !directory.exists() {
            return Ok(result);
        }

        let mut entries = fs::read_dir(&directory).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            let Some((number, part)) = parse_file_name(&path, mode) else {
                continue;
            };

            let metadata = entry.metadata().await?;
            let created_at: DateTime<Utc> = metadata
                .created()
                .map(DateTime::from)
                .unwrap_or_else(|_| Utc::now());
            let audio_file = AudioFile::new(
                number,
                part,
                accent,
                voice,
                mode,
                path.to_string_lossy().to_string(),
                created_at,
            );

            let pair = result
                .entry(number)
                .or_insert_with(|| NumberAudioPair::new(number));
            match part {
                AudioPart::Word => pair.word_audio = Some(audio_file),
                AudioPart::Digit => pair.digit_audio = Some(audio_file),
            }
        }

        Ok(result)
    }

    /// The Voices of an Accent with at least one Trimmed Audio in this Bingo Mode.
    pub async fn voices_with_recordings(
        &self,
        accent: Accent,
        mode: BingoMode,
    ) -> Result<Vec<Uuid>, StorageError> {
        let directory = self.root.join(accent.raw_value());
        let mut voices = Vec::new();
        if !directory.exists() {
            return Ok(voices);
        }

        let mut entries = fs::read_dir(&directory).await?;
        while let Some(entry) = entries.next_entry().await? {
            let Some(voice) = entry
                .file_name()
                .to_str()
                .and_then(|name| Uuid::parse_str(name).ok())
            else {
                continue;
            };
            let mut files = fs::read_dir(entry.path()).await?;
            while let Some(file) = files.next_entry().await? {
                if parse_file_name(&file.path(), mode).is_some() {
                    voices.push(voice);
                    break;
                }
            }
        }

        Ok(voices)
    }

    /// Deletes the Trimmed Audio of one part, and its Original Audio if there is one.
    pub async fn delete(
        &self,
        number: u32,
        accent: Accent,
        voice: Uuid,
        mode: BingoMode,
        part: AudioPart,
    ) -> Result<(), StorageError> {
        fs::remove_file(self.trimmed_path(number, accent, voice, mode, part)).await?;
        remove_original_audio(&self.original_path(number, accent, voice, mode, part)).await;
        Ok(())
    }

    /// Deletes the Word and the Digit of a number, whichever exist.
    pub async fn delete_all(
        &self,
        number: u32,
        accent: Accent,
        voice: Uuid,
        mode: BingoMode,
    ) -> Result<(), StorageError> {
        for part in AudioPart::all() {
            let path = self.trimmed_path(number, accent, voice, mode, part);
            if path.exists() {
                fs::remove_file(&path).await?;
            }
            remove_original_audio(&self.original_path(number, accent, voice, mode, part)).await;
        }
        Ok(())
    }

    /// Reads a Trimmed Audio by the path an `AudioFile` gave. Refuses anything outside the
    /// store, so the frontend cannot read arbitrary files.
    pub async fn read(&self, file_path: &str) -> Result<Vec<u8>, StorageError> {
        let path = PathBuf::from(file_path);
        if !path.exists() {
            return Err(StorageError::FileNotFound(file_path.to_string()));
        }
        let root = fs::canonicalize(&self.root).await?;
        if !fs::canonicalize(&path).await?.starts_with(&root) {
            return Err(StorageError::OutsideStore(file_path.to_string()));
        }
        Ok(fs::read(&path).await?)
    }
}

/// `n45_word.mp3` for the Bingo 75 Word, `45_word.mp3` for the Bingo 90 Word and
/// `45_digit.mp3` for the Digit, which both Bingo Modes share.
fn file_name(number: u32, mode: BingoMode, part: AudioPart) -> String {
    // Only the Word carries the letter: the Digit is shared by both Bingo Modes.
    let letter = match part {
        AudioPart::Word => mode.column_letter(number).unwrap_or(""),
        AudioPart::Digit => "",
    };
    let stem = format!("{}{}", letter.to_lowercase(), number);
    format!("{}_{}.mp3", stem, part.file_suffix())
}

/// The inverse of `file_name`, for the files of one Bingo Mode: the other mode's Words,
/// numbers outside the mode and anything that is not one of the app's files give `None`.
fn parse_file_name(path: &Path, mode: BingoMode) -> Option<(u32, AudioPart)> {
    if path.extension()?.to_str()? != "mp3" {
        return None;
    }
    let (stem, suffix) = path.file_stem()?.to_str()?.split_once('_')?;
    let part = match suffix {
        "word" => AudioPart::Word,
        "digit" => AudioPart::Digit,
        _ => return None,
    };

    let number: u32 = match (part, mode) {
        (AudioPart::Word, BingoMode::Bingo75) => {
            let mut chars = stem.chars();
            if !chars.next()?.is_alphabetic() {
                return None;
            }
            chars.as_str().parse().ok()?
        }
        _ => stem.parse().ok()?,
    };

    if !mode.contains(number)
        || !part.exists_for(number)
        || file_name(number, mode, part) != path.file_name()?.to_str()?
    {
        return None;
    }
    Some((number, part))
}

async fn write_file(path: &Path, data: &[u8]) -> Result<(), std::io::Error> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }
    fs::write(path, data).await
}

/// Trims the trailing silence, or returns the audio untouched if trimming
/// fails, panics or takes longer than 10 seconds.
async fn trim_or_keep(original: Vec<u8>) -> Vec<u8> {
    let config = TrimConfig::default();
    let for_trim = original.clone();
    let trim_result = tokio::time::timeout(
        Duration::from_secs(10),
        tokio::task::spawn_blocking(move || trim_trailing_silence(for_trim, &config)),
    )
    .await;

    match trim_result {
        Ok(Ok(Ok(trimmed))) => {
            log::debug!(
                "[audio_store] Trimmed: {} -> {} bytes",
                original.len(),
                trimmed.len()
            );
            trimmed
        }
        Ok(Ok(Err(AudioTrimError::NoSignificantSilence))) => {
            log::info!("[audio_store] No trailing silence to trim, keeping original");
            original
        }
        Ok(Ok(Err(e))) => {
            log::warn!("[audio_store] Trim failed, using original: {}", e);
            original
        }
        Ok(Err(e)) => {
            log::warn!("[audio_store] Trim task panicked, using original: {}", e);
            original
        }
        Err(_) => {
            log::warn!("[audio_store] Trim timed out after 10s, using original");
            original
        }
    }
}

/// Removes the Original Audio of a Trimmed Audio being deleted. It is only a
/// safety net, so failing to remove it does not fail the deletion.
async fn remove_original_audio(path: &Path) {
    if !path.exists() {
        return;
    }
    if let Err(e) = fs::remove_file(path).await {
        log::warn!("Could not delete Original Audio {}: {}", path.display(), e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ACCENT: Accent = Accent::PeninsularSpanish;

    fn store() -> (tempfile::TempDir, AudioStore) {
        let dir = tempfile::tempdir().unwrap();
        let store = AudioStore::new(dir.path().to_path_buf());
        (dir, store)
    }

    // Not an MP3, so trimming fails and the Trimmed Audio is a copy.
    const NOT_MP3: &[u8] = b"not an mp3";

    #[tokio::test]
    async fn save_keeps_the_original_and_a_copy_when_trimming_fails() {
        let (_dir, store) = store();
        let voice = Uuid::new_v4();

        let file = store
            .save(
                45,
                ACCENT,
                voice,
                BingoMode::Bingo75,
                AudioPart::Word,
                NOT_MP3.to_vec(),
            )
            .await
            .unwrap();

        assert!(file.file_path.ends_with("n45_word.mp3"));
        assert_eq!(fs::read(&file.file_path).await.unwrap(), NOT_MP3);
        let original = store.original_path(45, ACCENT, voice, BingoMode::Bingo75, AudioPart::Word);
        assert_eq!(fs::read(&original).await.unwrap(), NOT_MP3);
        assert!(!original.starts_with(store.voice_directory(ACCENT, voice)));
    }

    #[tokio::test]
    async fn each_mode_loads_its_own_words_and_the_shared_digits() {
        let (_dir, store) = store();
        let voice = Uuid::new_v4();
        for (number, mode, part) in [
            (45, BingoMode::Bingo75, AudioPart::Word),
            (45, BingoMode::Bingo75, AudioPart::Digit),
            (80, BingoMode::Bingo90, AudioPart::Word),
        ] {
            store
                .save(number, ACCENT, voice, mode, part, NOT_MP3.to_vec())
                .await
                .unwrap();
        }

        let bingo75 = store.load(ACCENT, voice, BingoMode::Bingo75).await.unwrap();
        let bingo90 = store.load(ACCENT, voice, BingoMode::Bingo90).await.unwrap();

        assert!(bingo75[&45].word_audio.is_some());
        assert!(bingo75[&45].digit_audio.is_some());
        assert!(!bingo75.contains_key(&80));
        assert!(bingo90[&45].word_audio.is_none());
        assert!(bingo90[&45].digit_audio.is_some());
        assert!(bingo90[&80].word_audio.is_some());
    }

    #[tokio::test]
    async fn delete_removes_the_trimmed_and_the_original_audio() {
        let (_dir, store) = store();
        let voice = Uuid::new_v4();
        let mode = BingoMode::Bingo90;
        for part in AudioPart::all() {
            store
                .save(45, ACCENT, voice, mode, part, NOT_MP3.to_vec())
                .await
                .unwrap();
        }

        store
            .delete(45, ACCENT, voice, mode, AudioPart::Digit)
            .await
            .unwrap();
        let loaded = store.load(ACCENT, voice, mode).await.unwrap();
        assert!(loaded[&45].word_audio.is_some());
        assert!(loaded[&45].digit_audio.is_none());
        assert!(!store
            .original_path(45, ACCENT, voice, mode, AudioPart::Digit)
            .exists());

        store.delete_all(45, ACCENT, voice, mode).await.unwrap();
        assert!(store.load(ACCENT, voice, mode).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn voices_with_recordings_counts_shared_digits_but_not_the_other_modes_words() {
        let (_dir, store) = store();
        let only_bingo90_word = Uuid::new_v4();
        let only_digit = Uuid::new_v4();
        store
            .save(
                45,
                ACCENT,
                only_bingo90_word,
                BingoMode::Bingo90,
                AudioPart::Word,
                NOT_MP3.to_vec(),
            )
            .await
            .unwrap();
        store
            .save(
                45,
                ACCENT,
                only_digit,
                BingoMode::Bingo90,
                AudioPart::Digit,
                NOT_MP3.to_vec(),
            )
            .await
            .unwrap();

        let bingo75 = store
            .voices_with_recordings(ACCENT, BingoMode::Bingo75)
            .await
            .unwrap();
        let mut bingo90 = store
            .voices_with_recordings(ACCENT, BingoMode::Bingo90)
            .await
            .unwrap();
        bingo90.sort();
        let mut both = vec![only_bingo90_word, only_digit];
        both.sort();

        assert_eq!(bingo75, vec![only_digit]);
        assert_eq!(bingo90, both);
    }

    #[tokio::test]
    async fn read_refuses_files_outside_the_store() {
        let (_dir, store) = store();
        let outside = tempfile::NamedTempFile::new().unwrap();
        let file = store
            .save(
                7,
                ACCENT,
                Uuid::new_v4(),
                BingoMode::Bingo90,
                AudioPart::Word,
                NOT_MP3.to_vec(),
            )
            .await
            .unwrap();

        assert_eq!(store.read(&file.file_path).await.unwrap(), NOT_MP3);
        assert!(matches!(
            store.read(outside.path().to_str().unwrap()).await,
            Err(StorageError::OutsideStore(_))
        ));
    }

    #[test]
    fn digit_has_the_same_file_name_in_both_modes() {
        assert_eq!(
            file_name(45, BingoMode::Bingo90, AudioPart::Digit),
            "45_digit.mp3"
        );
        assert_eq!(
            file_name(45, BingoMode::Bingo75, AudioPart::Digit),
            "45_digit.mp3"
        );
        assert_eq!(
            file_name(45, BingoMode::Bingo75, AudioPart::Word),
            "n45_word.mp3"
        );
    }

    #[test]
    fn file_names_round_trip_and_reject_what_the_app_did_not_write() {
        let parse = |name: &str, mode| parse_file_name(Path::new(name), mode);

        for mode in BingoMode::ALL {
            for number in 1..=75 {
                for part in AudioPart::all()
                    .into_iter()
                    .filter(|p| p.exists_for(number))
                {
                    assert_eq!(
                        parse(&file_name(number, mode, part), mode),
                        Some((number, part))
                    );
                }
            }
        }
        assert_eq!(parse("7_digit.mp3", BingoMode::Bingo90), None);
        assert_eq!(parse("45_word.mp3", BingoMode::Bingo75), None);
        assert_eq!(parse("n45_word.mp3", BingoMode::Bingo90), None);
        assert_eq!(parse("b45_word.mp3", BingoMode::Bingo75), None);
        assert_eq!(parse("80_word.mp3", BingoMode::Bingo75), None);
        assert_eq!(parse("45_word.wav", BingoMode::Bingo90), None);
    }
}
