use std::collections::HashMap;
use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::models::{
    bingo75_letter, AudioFile, AudioPart, BingoMode, Language, NumberAudioPair, Voice,
};

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

fn audio_file_path(
    number: u32,
    language: &Language,
    voice: &Voice,
    mode: &BingoMode,
    part: &AudioPart,
) -> PathBuf {
    let base_filename = match mode {
        BingoMode::Bingo90 => number.to_string(),
        BingoMode::Bingo75 => {
            let letter = bingo75_letter(number).to_lowercase();
            format!("{}{}", letter, number)
        }
    };

    let filename = format!("{}_{}.mp3", base_filename, part.file_suffix());

    get_base_directory()
        .join(language.raw_value())
        .join(voice.uuid.to_string())
        .join(filename)
}

fn voice_directory(language: &Language, voice: &Voice) -> PathBuf {
    get_base_directory()
        .join(language.raw_value())
        .join(voice.uuid.to_string())
}

#[tauri::command]
pub async fn save_audio_file(
    data: Vec<u8>,
    number: u32,
    language: Language,
    voice: Voice,
    mode: BingoMode,
    part: AudioPart,
) -> Result<AudioFile, StorageError> {
    let path = audio_file_path(number, &language, &voice, &mode, &part);

    // Create parent directories
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }

    // Write data
    let mut file = fs::File::create(&path).await?;
    file.write_all(&data).await?;

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

        // Parse filename: "45_word" or "b15_digit"
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

    let number = match mode {
        BingoMode::Bingo90 => number_part.parse::<u32>().ok()?,
        BingoMode::Bingo75 => {
            // "b15" -> drop letter, get number
            if number_part.len() < 2 {
                return None;
            }
            let first_char = number_part.chars().next()?;
            if !first_char.is_alphabetic() {
                return None;
            }
            number_part[1..].parse::<u32>().ok()?
        }
    };

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
