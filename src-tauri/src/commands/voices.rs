use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::models::Voice;

#[derive(Debug, Error)]
pub enum VoicesError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    #[error("Voice not found: {0}")]
    VoiceNotFound(String),
}

impl Serialize for VoicesError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

fn get_voices_file_path() -> PathBuf {
    let app_support = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    app_support.join("BingoVoiceGenerator").join("voices.json")
}

#[tauri::command]
pub async fn load_voices() -> Result<Vec<Voice>, VoicesError> {
    let path = get_voices_file_path();

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path).await?;
    let voices: Vec<Voice> = serde_json::from_str(&content)?;
    Ok(voices)
}

#[tauri::command]
pub async fn save_voices(voices: Vec<Voice>) -> Result<(), VoicesError> {
    let path = get_voices_file_path();

    // Create parent directory if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }

    let content = serde_json::to_string_pretty(&voices)?;
    let mut file = fs::File::create(&path).await?;
    file.write_all(content.as_bytes()).await?;

    Ok(())
}

#[tauri::command]
pub async fn add_voice(voice: Voice) -> Result<Vec<Voice>, VoicesError> {
    let mut voices = load_voices().await?;

    // Check if voice already exists (by UUID)
    if voices.iter().any(|v| v.uuid == voice.uuid) {
        return Ok(voices);
    }

    voices.push(voice);
    save_voices(voices.clone()).await?;

    Ok(voices)
}

/// Input for creating a new voice
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVoiceInput {
    pub elevenlabs_id: String,
    pub elevenlabs_name: String,
    pub custom_name: String,
    pub language: crate::models::Language,
    pub gender: String,
}

/// Creates a new voice with the given parameters (UUID generated server-side)
#[tauri::command]
pub async fn create_voice(input: CreateVoiceInput) -> Result<Vec<Voice>, VoicesError> {
    log::debug!("[create_voice] Received input: {:?}", input);
    log::debug!("[create_voice] elevenlabs_id: {}", input.elevenlabs_id);
    log::debug!("[create_voice] elevenlabs_name: {}", input.elevenlabs_name);
    log::debug!("[create_voice] custom_name: {}", input.custom_name);
    log::debug!("[create_voice] language: {:?}", input.language);
    log::debug!("[create_voice] gender: {}", input.gender);

    let voice = Voice::new(
        input.elevenlabs_id,
        input.elevenlabs_name,
        Some(input.custom_name),
        input.language,
        Some(input.gender),
    );

    log::debug!("[create_voice] Created voice: {:?}", voice);

    let mut voices = load_voices().await?;
    log::debug!("[create_voice] Loaded {} existing voices", voices.len());

    // Check if voice already exists (by elevenlabs_id and language)
    if voices
        .iter()
        .any(|v| v.elevenlabs_id == voice.elevenlabs_id && v.language == voice.language)
    {
        log::debug!("[create_voice] Voice already exists, returning existing list");
        return Ok(voices);
    }

    voices.push(voice);
    save_voices(voices.clone()).await?;
    log::debug!("[create_voice] Saved {} voices", voices.len());

    Ok(voices)
}

#[tauri::command]
pub async fn update_voice(voice: Voice) -> Result<Vec<Voice>, VoicesError> {
    let mut voices = load_voices().await?;

    if let Some(existing) = voices.iter_mut().find(|v| v.uuid == voice.uuid) {
        *existing = voice;
        save_voices(voices.clone()).await?;
        Ok(voices)
    } else {
        Err(VoicesError::VoiceNotFound(voice.uuid.to_string()))
    }
}

#[tauri::command]
pub async fn delete_local_voice(voice_uuid: String) -> Result<Vec<Voice>, VoicesError> {
    let mut voices = load_voices().await?;

    let uuid = uuid::Uuid::parse_str(&voice_uuid)
        .map_err(|_| VoicesError::VoiceNotFound(voice_uuid.clone()))?;

    let initial_len = voices.len();
    voices.retain(|v| v.uuid != uuid);

    if voices.len() == initial_len {
        return Err(VoicesError::VoiceNotFound(voice_uuid));
    }

    save_voices(voices.clone()).await?;
    Ok(voices)
}

#[tauri::command]
pub async fn get_voice(voice_uuid: String) -> Result<Option<Voice>, VoicesError> {
    let voices = load_voices().await?;

    let uuid = match uuid::Uuid::parse_str(&voice_uuid) {
        Ok(u) => u,
        Err(_) => return Ok(None),
    };

    Ok(voices.into_iter().find(|v| v.uuid == uuid))
}
