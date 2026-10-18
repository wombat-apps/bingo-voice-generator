use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::models::{Accent, AudioFileId, BingoMode, NumberAudioPair, VoiceNumber};
use crate::services::app_dirs::AppDirs;
pub use crate::services::audio_store::StorageError;

#[tauri::command]
pub async fn load_audio_files(
    dirs: State<'_, AppDirs>,
    accent: Accent,
    voice_uuid: Uuid,
    mode: BingoMode,
) -> Result<HashMap<u32, NumberAudioPair>, StorageError> {
    dirs.audio_store().load(accent, voice_uuid, mode).await
}

#[tauri::command]
pub async fn voices_with_trimmed_audio(
    dirs: State<'_, AppDirs>,
    accent: Accent,
    mode: BingoMode,
) -> Result<Vec<Uuid>, StorageError> {
    dirs.audio_store()
        .voices_with_trimmed_audio(accent, mode)
        .await
}

#[tauri::command]
pub async fn delete_audio_file(
    dirs: State<'_, AppDirs>,
    id: AudioFileId,
) -> Result<(), StorageError> {
    dirs.audio_store().delete(&id).await
}

#[tauri::command]
pub async fn delete_all_audio_files(
    dirs: State<'_, AppDirs>,
    voice_number: VoiceNumber,
) -> Result<(), StorageError> {
    dirs.audio_store().delete_all(&voice_number).await
}

#[tauri::command]
pub async fn read_audio_file(
    dirs: State<'_, AppDirs>,
    file_path: String,
) -> Result<Vec<u8>, StorageError> {
    dirs.audio_store().read(&file_path).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceDirectoryInfo {
    pub path: String,
    pub exists: bool,
}

#[tauri::command]
pub fn get_voice_directory(
    dirs: State<'_, AppDirs>,
    accent: Accent,
    voice_uuid: Uuid,
) -> VoiceDirectoryInfo {
    let dir = dirs.audio_store().voice_directory(accent, voice_uuid);
    VoiceDirectoryInfo {
        exists: dir.exists(),
        path: dir.to_string_lossy().to_string(),
    }
}
