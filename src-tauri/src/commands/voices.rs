use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;
use tokio::fs;

use crate::commands::{list_premade_voices, ElevenLabsError};
use crate::models::{Voice, VoiceKind};
use crate::services::app_dirs::AppDirs;

#[derive(Debug, Error)]
pub enum VoicesError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    #[error("Voice not found: {0}")]
    VoiceNotFound(String),
    #[error("ElevenLabs error: {0}")]
    ElevenLabs(#[from] ElevenLabsError),
}

impl Serialize for VoicesError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

async fn read_voices(dirs: &AppDirs) -> Result<Vec<Voice>, VoicesError> {
    let path = dirs.voices_file();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path).await?;
    Ok(serde_json::from_str(&content)?)
}

async fn write_voices(dirs: &AppDirs, voices: &[Voice]) -> Result<(), VoicesError> {
    let path = dirs.voices_file();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }
    fs::write(&path, serde_json::to_string_pretty(voices)?).await?;
    Ok(())
}

#[tauri::command]
pub async fn load_voices(dirs: State<'_, AppDirs>) -> Result<Vec<Voice>, VoicesError> {
    read_voices(&dirs).await
}

/// Input for creating a new voice
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVoiceInput {
    pub elevenlabs_id: String,
    pub elevenlabs_name: String,
    pub custom_name: String,
    pub accent: crate::models::Accent,
    pub gender: String,
    pub kind: crate::models::VoiceKind,
}

/// Creates a new voice with the given parameters (UUID generated server-side)
#[tauri::command]
pub async fn create_voice(
    dirs: State<'_, AppDirs>,
    input: CreateVoiceInput,
) -> Result<Vec<Voice>, VoicesError> {
    log::debug!("[create_voice] Received input: {:?}", input);
    log::debug!("[create_voice] elevenlabs_id: {}", input.elevenlabs_id);
    log::debug!("[create_voice] elevenlabs_name: {}", input.elevenlabs_name);
    log::debug!("[create_voice] custom_name: {}", input.custom_name);
    log::debug!("[create_voice] accent: {:?}", input.accent);
    log::debug!("[create_voice] gender: {}", input.gender);

    let voice = Voice::new(
        input.elevenlabs_id,
        input.elevenlabs_name,
        Some(input.custom_name),
        input.accent,
        Some(input.gender),
        input.kind,
    );

    log::debug!("[create_voice] Created voice: {:?}", voice);

    let mut voices = read_voices(&dirs).await?;
    log::debug!("[create_voice] Loaded {} existing voices", voices.len());

    // Check if voice already exists (by elevenlabs_id and accent)
    if voices
        .iter()
        .any(|v| v.elevenlabs_id == voice.elevenlabs_id && v.accent == voice.accent)
    {
        log::debug!("[create_voice] Voice already exists, returning existing list");
        return Ok(voices);
    }

    voices.push(voice);
    write_voices(&dirs, &voices).await?;
    log::debug!("[create_voice] Saved {} voices", voices.len());

    Ok(voices)
}

#[tauri::command]
pub async fn update_voice(
    dirs: State<'_, AppDirs>,
    voice: Voice,
) -> Result<Vec<Voice>, VoicesError> {
    let mut voices = read_voices(&dirs).await?;

    if let Some(existing) = voices.iter_mut().find(|v| v.uuid == voice.uuid) {
        // A copy taken before the backfill must not erase the stored kind.
        let kind = voice.kind.or(existing.kind);
        *existing = Voice { kind, ..voice };
        write_voices(&dirs, &voices).await?;
        Ok(voices)
    } else {
        Err(VoicesError::VoiceNotFound(voice.uuid.to_string()))
    }
}

#[tauri::command]
pub async fn delete_local_voice(
    dirs: State<'_, AppDirs>,
    voice_uuid: String,
) -> Result<Vec<Voice>, VoicesError> {
    let mut voices = read_voices(&dirs).await?;

    let uuid = uuid::Uuid::parse_str(&voice_uuid)
        .map_err(|_| VoicesError::VoiceNotFound(voice_uuid.clone()))?;

    let initial_len = voices.len();
    voices.retain(|v| v.uuid != uuid);

    if voices.len() == initial_len {
        return Err(VoicesError::VoiceNotFound(voice_uuid));
    }

    write_voices(&dirs, &voices).await?;
    Ok(voices)
}

/// Sets the kind of each Voice that has none: Default Voice if its ElevenLabs voice is one of
/// `default_voice_ids`, Library Voice otherwise. Returns whether any Voice changed.
fn fill_missing_kinds(voices: &mut [Voice], default_voice_ids: &[String]) -> bool {
    let mut changed = false;
    for voice in voices.iter_mut().filter(|v| v.kind.is_none()) {
        voice.kind = Some(if default_voice_ids.contains(&voice.elevenlabs_id) {
            VoiceKind::Default
        } else {
            VoiceKind::Library
        });
        changed = true;
    }
    changed
}

/// Stores the kind of Voices saved before kinds existed, asking ElevenLabs for its Default Voices.
#[tauri::command]
pub async fn backfill_voice_kinds(
    dirs: State<'_, AppDirs>,
    api_key: String,
) -> Result<Vec<Voice>, VoicesError> {
    let voices = read_voices(&dirs).await?;
    if voices.iter().all(|v| v.kind.is_some()) {
        return Ok(voices);
    }

    let default_voice_ids: Vec<String> = list_premade_voices(api_key)
        .await?
        .into_iter()
        .map(|v| v.voice_id)
        .collect();
    // Reload after the request so edits made while it was in flight are kept.
    let mut voices = read_voices(&dirs).await?;
    if fill_missing_kinds(&mut voices, &default_voice_ids) {
        log::info!("[backfill_voice_kinds] Stored the kind of Voices saved without one");
        write_voices(&dirs, &voices).await?;
    }
    Ok(voices)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Accent;

    fn voice(elevenlabs_id: &str, kind: Option<VoiceKind>) -> Voice {
        let mut voice = Voice::new(
            elevenlabs_id.to_string(),
            elevenlabs_id.to_string(),
            None,
            Accent::PeninsularSpanish,
            None,
            VoiceKind::Default,
        );
        voice.kind = kind;
        voice
    }

    #[test]
    fn backfill_classifies_voices_without_kind_by_default_voice_ids() {
        let mut voices = vec![voice("premade", None), voice("shared", None)];

        let changed = fill_missing_kinds(&mut voices, &["premade".to_string()]);

        assert!(changed);
        assert_eq!(voices[0].kind, Some(VoiceKind::Default));
        assert_eq!(voices[1].kind, Some(VoiceKind::Library));
    }

    #[test]
    fn backfill_keeps_stored_kinds() {
        let mut voices = vec![voice("premade", Some(VoiceKind::Library))];

        let changed = fill_missing_kinds(&mut voices, &["premade".to_string()]);

        assert!(!changed);
        assert_eq!(voices[0].kind, Some(VoiceKind::Library));
    }
}
