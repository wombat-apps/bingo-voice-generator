mod client;
mod types;

pub use client::{ElevenLabs, ElevenLabsError};
pub use types::*;

use tauri::State;
use uuid::Uuid;

use crate::models::{Accent, TtsText, VoiceSettings};
use crate::services::app_dirs::AppDirs;

// Arguments map 1:1 to the `invoke()` payload in src/services/tauri.ts.
#[tauri::command]
pub async fn generate_speech(
    elevenlabs: State<'_, ElevenLabs>,
    dirs: State<'_, AppDirs>,
    tts: TtsText,
    voice_id: String,
    language_code: String,
    settings: VoiceSettings,
) -> Result<Vec<u8>, ElevenLabsError> {
    elevenlabs
        .active_client(&dirs)
        .await?
        .text_to_speech(&voice_id, &language_code, &tts, &settings)
        .await
}

/// The Default Voices ElevenLabs has verified for the Language of `accent`.
#[tauri::command]
pub async fn list_default_voices(
    elevenlabs: State<'_, ElevenLabs>,
    dirs: State<'_, AppDirs>,
    accent: Accent,
    gender: Option<String>,
) -> Result<Vec<DefaultVoice>, ElevenLabsError> {
    let voices = elevenlabs
        .active_client(&dirs)
        .await?
        .default_voices(gender.as_deref())
        .await?;
    let in_language: Vec<DefaultVoice> = voices
        .iter()
        .filter_map(|v| DefaultVoice::for_accent(v, accent))
        .collect();
    log::info!(
        "[list_default_voices] {} of {} Default Voices are verified for {}",
        in_language.len(),
        voices.len(),
        accent.elevenlabs_code()
    );
    Ok(in_language)
}

#[tauri::command]
pub async fn search_shared_voices(
    elevenlabs: State<'_, ElevenLabs>,
    dirs: State<'_, AppDirs>,
    accent: Accent,
    gender: Option<String>,
    search: Option<String>,
    sort: Option<SharedVoiceSort>,
    page_size: Option<u32>,
) -> Result<SharedVoicesResponse, ElevenLabsError> {
    let client = elevenlabs.active_client(&dirs).await?;
    let fetch = |accent_label| {
        client.shared_voices(
            accent,
            accent_label,
            gender.as_deref(),
            search.as_deref(),
            sort.unwrap_or_default(),
            page_size.unwrap_or(20),
        )
    };
    let in_accent = fetch(Some(accent.elevenlabs_accent())).await?;
    if !in_accent.voices.is_empty() {
        return Ok(in_accent);
    }

    // Some Accents have few or no voices under their label (or a label the Voice Library
    // does not use): the user picks from the whole Language by ear instead.
    log::info!(
        "[search_shared_voices] No voices with accent {:?}, searching all of {}",
        accent.elevenlabs_accent(),
        accent.elevenlabs_code()
    );
    let mut in_language = fetch(None).await?;
    in_language.whole_language = true;
    Ok(in_language)
}

/// The subscription of any saved ElevenLabs Account, active or not.
#[tauri::command]
pub async fn get_account_subscription(
    elevenlabs: State<'_, ElevenLabs>,
    account_id: Uuid,
) -> Result<SubscriptionInfo, ElevenLabsError> {
    elevenlabs
        .client_for_account(account_id)
        .await?
        .subscription()
        .await
}

#[tauri::command]
pub async fn add_shared_voice(
    elevenlabs: State<'_, ElevenLabs>,
    dirs: State<'_, AppDirs>,
    public_owner_id: String,
    voice_id: String,
    new_name: String,
) -> Result<String, ElevenLabsError> {
    let new_voice_id = elevenlabs
        .active_client(&dirs)
        .await?
        .add_shared_voice(&public_owner_id, &voice_id, &new_name)
        .await?;
    log::info!("[add_shared_voice] Saved {} as {}", voice_id, new_voice_id);
    Ok(new_voice_id)
}
