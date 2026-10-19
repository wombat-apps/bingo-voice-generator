use std::collections::HashMap;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::{DateTime, Utc};
use id3::frame::ExtendedText;
use id3::{Tag, TagLike, Version};
use serde::Serialize;
use thiserror::Error;
use tokio::fs;
use uuid::Uuid;

use super::audio_trimmer::{trim_trailing_silence, AudioTrimError, TrimConfig};
use crate::models::{
    Accent, AudioFile, AudioFileId, AudioPart, BingoMode, GenerationDetails, NumberAudioPair,
    VoiceNumber,
};

/// The description of the ID3 `TXXX` frame that holds the Generation Details, as JSON.
const DETAILS_FRAME: &str = "bingo!! studio";

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("Not an audio file of the app: {0}")]
    OutsideStore(String),
}

/// `{code: "STORAGE_ERROR", message}`, the shape `generate_audio` also uses for it.
impl Serialize for StorageError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("code", "STORAGE_ERROR")?;
        map.serialize_entry("message", &self.to_string())?;
        map.end()
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
/// Both audios carry their Generation Details in an ID3 tag (see
/// `docs/adr/0003-generation-details-in-id3-tags.md`).
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

    fn trimmed_path(&self, id: &AudioFileId) -> PathBuf {
        self.voice_directory(id.accent, id.voice_uuid)
            .join(file_name(id))
    }

    fn original_path(&self, id: &AudioFileId) -> PathBuf {
        self.originals_directory(id.accent, id.voice_uuid)
            .join(file_name(id))
    }

    /// Saves `original`, the audio exactly as ElevenLabs returned it, as the Original Audio,
    /// then its Trimmed Audio, both tagged with `details`. When trimming fails, the Trimmed
    /// Audio is a copy of the Original Audio. Replaces any audio already saved for this part.
    pub async fn save(
        &self,
        id: &AudioFileId,
        original: Vec<u8>,
        details: &GenerationDetails,
    ) -> Result<AudioFile, StorageError> {
        // The Original Audio is only a safety net: failing to save it must not
        // lose a generation that has already spent characters.
        let original_path = self.original_path(id);
        if let Err(e) = write_file(&original_path, &with_details(&original, details)).await {
            log::warn!(
                "[audio_store] Could not save Original Audio {}: {}",
                original_path.display(),
                e
            );
        }

        let path = self.trimmed_path(id);
        // Trimming re-encodes the audio and drops any tag, so it is tagged afterwards
        let trimmed = trim_or_keep(original).await;
        write_file(&path, &with_details(&trimmed, details)).await?;

        Ok(AudioFile::new(
            *id,
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
            let Some(id) = parse_file_name(&path, accent, voice, mode) else {
                continue;
            };

            let metadata = entry.metadata().await?;
            let created_at: DateTime<Utc> = metadata
                .created()
                .map(DateTime::from)
                .unwrap_or_else(|_| Utc::now());
            let audio_file = AudioFile::new(id, path.to_string_lossy().to_string(), created_at);

            let pair = result
                .entry(id.number)
                .or_insert_with(|| NumberAudioPair::new(id.number));
            match id.part {
                AudioPart::Word => pair.word_audio = Some(audio_file),
                AudioPart::Digit => pair.digit_audio = Some(audio_file),
            }
        }

        Ok(result)
    }

    /// The Voices of an Accent with at least one Trimmed Audio in this Bingo Mode.
    pub async fn voices_with_trimmed_audio(
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
            // One unreadable folder counts as that Voice having no audio
            match has_trimmed_audio(&entry.path(), accent, voice, mode).await {
                Ok(true) => voices.push(voice),
                Ok(false) => {}
                Err(e) => log::warn!(
                    "[audio_store] Cannot read {}: {}",
                    entry.path().display(),
                    e
                ),
            }
        }

        Ok(voices)
    }

    /// Deletes the Trimmed Audio of one part, and its Original Audio if there is one.
    pub async fn delete(&self, id: &AudioFileId) -> Result<(), StorageError> {
        fs::remove_file(self.trimmed_path(id)).await?;
        remove_original_audio(&self.original_path(id)).await;
        Ok(())
    }

    /// Deletes the Word and the Digit of a number, whichever exist.
    pub async fn delete_all(&self, voice_number: &VoiceNumber) -> Result<(), StorageError> {
        for part in AudioPart::all() {
            let id = voice_number.with_part(part);
            let path = self.trimmed_path(&id);
            if path.exists() {
                fs::remove_file(&path).await?;
            }
            remove_original_audio(&self.original_path(&id)).await;
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

    /// The Generation Details of a Trimmed Audio, by the path an `AudioFile` gave, or `None`
    /// for audio generated before they were kept.
    pub async fn generation_details(
        &self,
        file_path: &str,
    ) -> Result<Option<GenerationDetails>, StorageError> {
        Ok(read_details(&self.read(file_path).await?))
    }
}

/// `audio` with `details` in its ID3 tag. When tagging fails the audio is kept as it is:
/// the details are not worth losing a generation that has already spent characters.
fn with_details(audio: &[u8], details: &GenerationDetails) -> Vec<u8> {
    let tagged = serde_json::to_string(details)
        .map_err(|e| e.to_string())
        .and_then(|json| {
            let mut tag = Tag::read_from2(Cursor::new(audio)).unwrap_or_default();
            tag.add_frame(ExtendedText {
                description: DETAILS_FRAME.to_string(),
                value: json,
            });
            let mut file = Cursor::new(audio.to_vec());
            tag.write_to_file(&mut file, Version::Id3v24)
                .map_err(|e| e.to_string())?;
            Ok(file.into_inner())
        });
    tagged.unwrap_or_else(|e| {
        log::warn!(
            "[audio_store] Could not write the Generation Details: {}",
            e
        );
        audio.to_vec()
    })
}

fn read_details(audio: &[u8]) -> Option<GenerationDetails> {
    let tag = Tag::read_from2(Cursor::new(audio)).ok()?;
    let frame = tag
        .extended_texts()
        .find(|frame| frame.description == DETAILS_FRAME)?;
    serde_json::from_str(&frame.value)
        .inspect_err(|e| log::warn!("[audio_store] Unreadable Generation Details: {}", e))
        .ok()
}

/// `n45_word.mp3` for the Bingo 75 Word, `45_word.mp3` for the Bingo 90 Word and
/// `45_digit.mp3` for the Digit, which both Bingo Modes share.
fn file_name(id: &AudioFileId) -> String {
    // Only the Word carries the letter: the Digit is shared by both Bingo Modes.
    let letter = match id.part {
        AudioPart::Word => id.mode.column_letter(id.number).unwrap_or(""),
        AudioPart::Digit => "",
    };
    let stem = format!("{}{}", letter.to_lowercase(), id.number);
    format!("{}_{}.mp3", stem, id.part.file_suffix())
}

async fn has_trimmed_audio(
    directory: &Path,
    accent: Accent,
    voice: Uuid,
    mode: BingoMode,
) -> std::io::Result<bool> {
    let mut files = fs::read_dir(directory).await?;
    while let Some(file) = files.next_entry().await? {
        if parse_file_name(&file.path(), accent, voice, mode).is_some() {
            return Ok(true);
        }
    }
    Ok(false)
}

/// The inverse of `file_name`, for the files of one Voice in one Bingo Mode: the other
/// mode's Words, numbers outside the mode and anything that is not one of the app's files
/// give `None`.
fn parse_file_name(
    path: &Path,
    accent: Accent,
    voice: Uuid,
    mode: BingoMode,
) -> Option<AudioFileId> {
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

    let id = VoiceNumber::new(accent, voice, mode, number).with_part(part);
    if !mode.contains(number)
        || !part.exists_for(number)
        || file_name(&id) != path.file_name()?.to_str()?
    {
        return None;
    }
    Some(id)
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

    fn id(voice: Uuid, mode: BingoMode, number: u32, part: AudioPart) -> AudioFileId {
        VoiceNumber::new(ACCENT, voice, mode, number).with_part(part)
    }

    fn store() -> (tempfile::TempDir, AudioStore) {
        let dir = tempfile::tempdir().unwrap();
        let store = AudioStore::new(dir.path().to_path_buf());
        (dir, store)
    }

    // Not an MP3, so trimming fails and the Trimmed Audio is a copy.
    const NOT_MP3: &[u8] = b"not an mp3";

    fn details() -> GenerationDetails {
        GenerationDetails {
            format: "¡{LETTER} {NUM}!".into(),
            text: "¡N CUARENTA Y CINCO!".into(),
            settings: crate::models::VoiceSettings::default(),
            elevenlabs_voice_id: "el-voice".into(),
            generated_at: DateTime::parse_from_rfc3339("2026-10-19T10:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
        }
    }

    /// The audio of a saved file, after its tag.
    fn untagged(bytes: &[u8]) -> &[u8] {
        &bytes[bytes.len() - NOT_MP3.len()..]
    }

    #[tokio::test]
    async fn save_keeps_the_original_and_a_copy_when_trimming_fails() {
        let (_dir, store) = store();
        let voice = Uuid::new_v4();

        let file = store
            .save(
                &id(voice, BingoMode::Bingo75, 45, AudioPart::Word),
                NOT_MP3.to_vec(),
                &details(),
            )
            .await
            .unwrap();

        assert!(file.file_path.ends_with("n45_word.mp3"));
        assert_eq!(untagged(&fs::read(&file.file_path).await.unwrap()), NOT_MP3);
        let original = store.original_path(&id(voice, BingoMode::Bingo75, 45, AudioPart::Word));
        assert_eq!(untagged(&fs::read(&original).await.unwrap()), NOT_MP3);
        assert!(!original.starts_with(store.voice_directory(ACCENT, voice)));
    }

    #[tokio::test]
    async fn the_original_and_the_trimmed_audio_carry_the_generation_details() {
        let (_dir, store) = store();
        let id = id(Uuid::new_v4(), BingoMode::Bingo75, 45, AudioPart::Word);

        let file = store.save(&id, NOT_MP3.to_vec(), &details()).await.unwrap();

        assert_eq!(
            store.generation_details(&file.file_path).await.unwrap(),
            Some(details())
        );
        let original = fs::read(store.original_path(&id)).await.unwrap();
        assert_eq!(read_details(&original), Some(details()));
    }

    #[tokio::test]
    async fn audio_saved_before_the_details_were_kept_has_none() {
        let (_dir, store) = store();
        let id = id(Uuid::new_v4(), BingoMode::Bingo90, 45, AudioPart::Digit);
        let path = store.trimmed_path(&id);
        write_file(&path, NOT_MP3).await.unwrap();

        assert_eq!(
            store
                .generation_details(path.to_str().unwrap())
                .await
                .unwrap(),
            None
        );
    }

    #[test]
    fn regenerating_replaces_the_details_instead_of_adding_more() {
        let mut newer = details();
        newer.format = "{NUM}".into();

        let tagged = with_details(&with_details(NOT_MP3, &details()), &newer);

        assert_eq!(read_details(&tagged), Some(newer));
        assert_eq!(untagged(&tagged), NOT_MP3);
        let tag = Tag::read_from2(Cursor::new(&tagged)).unwrap();
        assert_eq!(tag.extended_texts().count(), 1);
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
                .save(&id(voice, mode, number, part), NOT_MP3.to_vec(), &details())
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
                .save(&id(voice, mode, 45, part), NOT_MP3.to_vec(), &details())
                .await
                .unwrap();
        }

        store
            .delete(&id(voice, mode, 45, AudioPart::Digit))
            .await
            .unwrap();
        let loaded = store.load(ACCENT, voice, mode).await.unwrap();
        assert!(loaded[&45].word_audio.is_some());
        assert!(loaded[&45].digit_audio.is_none());
        assert!(!store
            .original_path(&id(voice, mode, 45, AudioPart::Digit))
            .exists());

        store
            .delete_all(&VoiceNumber::new(ACCENT, voice, mode, 45))
            .await
            .unwrap();
        assert!(store.load(ACCENT, voice, mode).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn voices_with_trimmed_audio_counts_shared_digits_but_not_the_other_modes_words() {
        let (_dir, store) = store();
        let only_bingo90_word = Uuid::new_v4();
        let only_digit = Uuid::new_v4();
        store
            .save(
                &id(only_bingo90_word, BingoMode::Bingo90, 45, AudioPart::Word),
                NOT_MP3.to_vec(),
                &details(),
            )
            .await
            .unwrap();
        store
            .save(
                &id(only_digit, BingoMode::Bingo90, 45, AudioPart::Digit),
                NOT_MP3.to_vec(),
                &details(),
            )
            .await
            .unwrap();

        let bingo75 = store
            .voices_with_trimmed_audio(ACCENT, BingoMode::Bingo75)
            .await
            .unwrap();
        let mut bingo90 = store
            .voices_with_trimmed_audio(ACCENT, BingoMode::Bingo90)
            .await
            .unwrap();
        bingo90.sort();
        let mut both = vec![only_bingo90_word, only_digit];
        both.sort();

        assert_eq!(bingo75, vec![only_digit]);
        assert_eq!(bingo90, both);
    }

    #[test]
    fn errors_serialize_with_a_code_and_message() {
        let error = StorageError::FileNotFound("45_word.mp3".into());
        assert_eq!(
            serde_json::to_value(&error).unwrap(),
            serde_json::json!({
                "code": "STORAGE_ERROR",
                "message": "File not found: 45_word.mp3",
            })
        );
    }

    #[tokio::test]
    async fn voices_with_trimmed_audio_skips_a_voice_it_cannot_read() {
        let (dir, store) = store();
        let readable = Uuid::new_v4();
        store
            .save(
                &id(readable, BingoMode::Bingo90, 45, AudioPart::Word),
                NOT_MP3.to_vec(),
                &details(),
            )
            .await
            .unwrap();
        // A file where the Voice's folder should be cannot be listed.
        let unreadable = dir
            .path()
            .join(ACCENT.raw_value())
            .join(Uuid::new_v4().to_string());
        fs::write(&unreadable, b"").await.unwrap();

        let voices = store
            .voices_with_trimmed_audio(ACCENT, BingoMode::Bingo90)
            .await
            .unwrap();

        assert_eq!(voices, vec![readable]);
    }

    #[tokio::test]
    async fn read_refuses_files_outside_the_store() {
        let (_dir, store) = store();
        let outside = tempfile::NamedTempFile::new().unwrap();
        let file = store
            .save(
                &id(Uuid::new_v4(), BingoMode::Bingo90, 7, AudioPart::Word),
                NOT_MP3.to_vec(),
                &details(),
            )
            .await
            .unwrap();

        assert_eq!(
            untagged(&store.read(&file.file_path).await.unwrap()),
            NOT_MP3
        );
        assert!(matches!(
            store.read(outside.path().to_str().unwrap()).await,
            Err(StorageError::OutsideStore(_))
        ));
    }

    #[test]
    fn digit_has_the_same_file_name_in_both_modes() {
        let voice = Uuid::new_v4();
        let name = |mode, part| file_name(&id(voice, mode, 45, part));
        assert_eq!(name(BingoMode::Bingo90, AudioPart::Digit), "45_digit.mp3");
        assert_eq!(name(BingoMode::Bingo75, AudioPart::Digit), "45_digit.mp3");
        assert_eq!(name(BingoMode::Bingo75, AudioPart::Word), "n45_word.mp3");
    }

    #[test]
    fn file_names_round_trip_and_reject_what_the_app_did_not_write() {
        let voice = Uuid::new_v4();
        let parse = |name: &str, mode| parse_file_name(Path::new(name), ACCENT, voice, mode);

        for mode in BingoMode::ALL {
            for number in 1..=75 {
                for part in AudioPart::all()
                    .into_iter()
                    .filter(|p| p.exists_for(number))
                {
                    let id = id(voice, mode, number, part);
                    assert_eq!(parse(&file_name(&id), mode), Some(id));
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
