use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::models::{
    bingo75_letter, AudioFile, AudioPart, BingoMode, Language, NumberAudioPair, Voice,
};
use crate::services::audio_trimmer::{trim_trailing_silence, AudioTrimError, TrimConfig};

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("File not found: {0}")]
    FileNotFound(String),
}

impl Serialize for StorageError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

fn get_base_directory() -> PathBuf {
    let app_support = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    app_support.join("BingoVoiceGenerator")
}

/// The Bingo 75 Word carries its letter ("n45_word"). The Digit is shared by
/// both Bingo Modes, so it never does ("45_digit").
fn audio_file_name(number: u32, mode: &BingoMode, part: &AudioPart) -> String {
    let base_filename = match (part, mode) {
        (AudioPart::Word, BingoMode::Bingo75) => {
            let letter = bingo75_letter(number).to_lowercase();
            format!("{}{}", letter, number)
        }
        _ => number.to_string(),
    };

    format!("{}_{}.mp3", base_filename, part.file_suffix())
}

/// Path of the Trimmed Audio, the one the app plays.
fn audio_file_path(
    number: u32,
    language: &Language,
    voice: &Voice,
    mode: &BingoMode,
    part: &AudioPart,
) -> PathBuf {
    voice_directory(language, voice).join(audio_file_name(number, mode, part))
}

/// Path of the Original Audio. It lives in a tree parallel to the voice
/// directories so that copying a voice directory only copies Trimmed Audio.
fn original_audio_path(
    number: u32,
    language: &Language,
    voice: &Voice,
    mode: &BingoMode,
    part: &AudioPart,
) -> PathBuf {
    get_base_directory()
        .join("Originals")
        .join(language.raw_value())
        .join(voice.uuid.to_string())
        .join(audio_file_name(number, mode, part))
}

fn voice_directory(language: &Language, voice: &Voice) -> PathBuf {
    get_base_directory()
        .join(language.raw_value())
        .join(voice.uuid.to_string())
}

async fn write_file(path: &Path, data: &[u8]) -> Result<(), std::io::Error> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }
    let mut file = fs::File::create(path).await?;
    file.write_all(data).await
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
                "[save_audio_file] Trimmed: {} -> {} bytes",
                original.len(),
                trimmed.len()
            );
            trimmed
        }
        Ok(Ok(Err(AudioTrimError::NoSignificantSilence))) => {
            log::info!("[save_audio_file] No trailing silence to trim, keeping original");
            original
        }
        Ok(Ok(Err(e))) => {
            log::warn!("[save_audio_file] Trim failed, using original: {}", e);
            original
        }
        Ok(Err(e)) => {
            log::warn!(
                "[save_audio_file] Trim task panicked, using original: {}",
                e
            );
            original
        }
        Err(_) => {
            log::warn!("[save_audio_file] Trim timed out after 10s, using original");
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

/// Saves `data`, the audio exactly as ElevenLabs returned it, as the Original
/// Audio, then saves its Trimmed Audio, the file the app plays.
#[tauri::command]
pub async fn save_audio_file(
    data: Vec<u8>,
    number: u32,
    language: Language,
    voice: Voice,
    mode: BingoMode,
    part: AudioPart,
) -> Result<AudioFile, StorageError> {
    // The Original Audio is only a safety net: failing to save it must not
    // lose a generation that has already spent characters.
    let original_path = original_audio_path(number, &language, &voice, &mode, &part);
    if let Err(e) = write_file(&original_path, &data).await {
        log::warn!(
            "[save_audio_file] Could not save Original Audio {}: {}",
            original_path.display(),
            e
        );
    }

    let path = audio_file_path(number, &language, &voice, &mode, &part);
    let trimmed = trim_or_keep(data).await;
    write_file(&path, &trimmed).await?;

    // For now, we don't calculate duration on the Rust side
    // The frontend can calculate it using Web Audio API
    let audio_file = AudioFile::new(
        number,
        part,
        language,
        &voice,
        mode,
        path.to_string_lossy().to_string(),
        0.0, // Duration will be calculated on frontend
    );

    Ok(audio_file)
}

#[tauri::command]
pub async fn load_audio_files(
    language: Language,
    voice: Voice,
    mode: BingoMode,
) -> Result<HashMap<u32, NumberAudioPair>, StorageError> {
    let directory = voice_directory(&language, &voice);
    let mut result: HashMap<u32, NumberAudioPair> = HashMap::new();

    // Check if directory exists
    if !directory.exists() {
        return Ok(result);
    }

    let mut entries = fs::read_dir(&directory).await?;

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();

        // Only process MP3 files
        if path.extension().map(|e| e.to_str()) != Some(Some("mp3")) {
            continue;
        }

        let filename = match path.file_stem().and_then(|s| s.to_str()) {
            Some(f) => f.to_string(),
            None => continue,
        };

        // Parse filename: "45_word", "n45_word" or "45_digit"
        let (number, part) = match parse_filename(&filename, &mode) {
            Some(p) => p,
            None => continue,
        };

        // Validate number is in correct range for mode
        let is_valid = match mode {
            BingoMode::Bingo90 => (1..=90).contains(&number),
            BingoMode::Bingo75 => (1..=75).contains(&number),
        };

        if !is_valid {
            continue;
        }

        // Get file metadata
        let metadata = entry.metadata().await?;
        let created_at: DateTime<Utc> = metadata
            .created()
            .map(DateTime::from)
            .unwrap_or_else(|_| Utc::now());

        let audio_file = AudioFile {
            number,
            part,
            language,
            voice_uuid: voice.uuid.to_string(),
            mode,
            file_path: path.to_string_lossy().to_string(),
            created_at,
            duration: 0.0, // Duration will be calculated on frontend
        };

        // Initialize pair if needed
        result
            .entry(number)
            .or_insert_with(|| NumberAudioPair::new(number));

        // Add to appropriate slot
        match part {
            AudioPart::Word => {
                if let Some(pair) = result.get_mut(&number) {
                    pair.word_audio = Some(audio_file);
                }
            }
            AudioPart::Digit => {
                if let Some(pair) = result.get_mut(&number) {
                    pair.digit_audio = Some(audio_file);
                }
            }
        }
    }

    Ok(result)
}

fn parse_filename(filename: &str, mode: &BingoMode) -> Option<(u32, AudioPart)> {
    // Split by underscore: "45_word" -> ["45", "word"]
    let parts: Vec<&str> = filename.split('_').collect();
    if parts.len() != 2 {
        return None;
    }

    let part = match parts[1] {
        "word" => AudioPart::Word,
        "digit" => AudioPart::Digit,
        _ => return None,
    };

    let number_part = parts[0];

    let number = match (part, mode) {
        (AudioPart::Word, BingoMode::Bingo75) => {
            // "n45" -> drop letter, get number
            if number_part.len() < 2 {
                return None;
            }
            let first_char = number_part.chars().next()?;
            if !first_char.is_alphabetic() {
                return None;
            }
            number_part[1..].parse::<u32>().ok()?
        }
        _ => number_part.parse::<u32>().ok()?,
    };

    if !part.exists_for(number) {
        return None;
    }

    Some((number, part))
}

#[tauri::command]
pub async fn delete_audio_file(
    number: u32,
    language: Language,
    voice: Voice,
    mode: BingoMode,
    part: AudioPart,
) -> Result<(), StorageError> {
    let path = audio_file_path(number, &language, &voice, &mode, &part);
    fs::remove_file(&path).await?;
    remove_original_audio(&original_audio_path(
        number, &language, &voice, &mode, &part,
    ))
    .await;
    Ok(())
}

#[tauri::command]
pub async fn delete_all_audio_files(
    number: u32,
    language: Language,
    voice: Voice,
    mode: BingoMode,
) -> Result<(), StorageError> {
    for part in AudioPart::all() {
        let path = audio_file_path(number, &language, &voice, &mode, &part);
        if path.exists() {
            fs::remove_file(&path).await?;
        }
        remove_original_audio(&original_audio_path(
            number, &language, &voice, &mode, &part,
        ))
        .await;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_storage_directory() -> String {
    get_base_directory().to_string_lossy().to_string()
}

#[tauri::command]
pub async fn read_audio_file(file_path: String) -> Result<Vec<u8>, StorageError> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(StorageError::FileNotFound(file_path));
    }
    let data = fs::read(&path).await?;
    Ok(data)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceDirectoryInfo {
    pub path: String,
    pub exists: bool,
}

#[tauri::command]
pub async fn get_voice_directory(
    language: Language,
    voice: Voice,
) -> Result<VoiceDirectoryInfo, StorageError> {
    let dir = voice_directory(&language, &voice);
    let exists = dir.exists();
    Ok(VoiceDirectoryInfo {
        path: dir.to_string_lossy().to_string(),
        exists,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::VoiceKind;

    #[test]
    fn original_audio_lives_outside_the_voice_directory_with_the_same_name() {
        let voice = Voice::new(
            "id".into(),
            "Name".into(),
            None,
            Language::Spanish,
            None,
            VoiceKind::Default,
        );
        let mode = BingoMode::Bingo75;
        let part = AudioPart::Word;

        let trimmed = audio_file_path(12, &Language::Spanish, &voice, &mode, &part);
        let original = original_audio_path(12, &Language::Spanish, &voice, &mode, &part);

        assert_eq!(trimmed.file_name(), original.file_name());
        assert!(!original.starts_with(voice_directory(&Language::Spanish, &voice)));
        assert!(original.starts_with(get_base_directory().join("Originals")));
    }

    #[test]
    fn digit_has_the_same_file_name_in_both_modes() {
        let digit = |mode| audio_file_name(45, &mode, &AudioPart::Digit);

        assert_eq!(digit(BingoMode::Bingo90), "45_digit.mp3");
        assert_eq!(digit(BingoMode::Bingo75), "45_digit.mp3");
        assert_eq!(
            audio_file_name(45, &BingoMode::Bingo75, &AudioPart::Word),
            "n45_word.mp3"
        );
    }

    #[test]
    fn each_mode_reads_its_own_words_and_the_shared_digits() {
        let parse = |name, mode| parse_filename(name, &mode);

        assert_eq!(
            parse("45_digit", BingoMode::Bingo75),
            Some((45, AudioPart::Digit))
        );
        assert_eq!(
            parse("45_digit", BingoMode::Bingo90),
            Some((45, AudioPart::Digit))
        );
        assert_eq!(
            parse("n45_word", BingoMode::Bingo75),
            Some((45, AudioPart::Word))
        );
        assert_eq!(parse("45_word", BingoMode::Bingo75), None);
        assert_eq!(parse("n45_word", BingoMode::Bingo90), None);
    }

    #[test]
    fn numbers_below_10_have_no_digit_file() {
        assert_eq!(parse_filename("7_digit", &BingoMode::Bingo90), None);
        assert_eq!(
            parse_filename("7_word", &BingoMode::Bingo90),
            Some((7, AudioPart::Word))
        );
    }
}
