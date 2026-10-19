mod client;
mod types;

pub use client::{ElevenLabs, ElevenLabsClient, ElevenLabsError};
pub use types::*;

use tauri::State;
use uuid::Uuid;

use crate::models::Accent;
use crate::services::app_dirs::AppDirs;

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
pub async fn search_library_voices(
    elevenlabs: State<'_, ElevenLabs>,
    dirs: State<'_, AppDirs>,
    accent: Accent,
    gender: Option<String>,
    search: Option<String>,
    sort: Option<LibraryVoiceSort>,
    page_size: Option<u32>,
) -> Result<SharedVoicesResponse, ElevenLabsError> {
    let client = elevenlabs.active_client(&dirs).await?;
    let fetch = |accent_label| {
        client.library_voices(
            accent,
            accent_label,
            gender.as_deref(),
            search.as_deref(),
            sort.unwrap_or_default(),
            page_size.unwrap_or(20),
        )
    };
    // A search by text looks across the whole Language: a name or a word in the description
    // rarely matches within one accent label, and each result shows its own accent.
    if search.as_deref().is_some_and(|s| !s.trim().is_empty()) {
        return fetch(None).await;
    }
    let in_accent = fetch(Some(accent.elevenlabs_accent())).await?;
    if !in_accent.voices.is_empty() {
        return Ok(in_accent);
    }

    // Some Accents have few or no voices under their label (or a label the Voice Library
    // does not use): the user picks from the whole Language by ear instead.
    log::info!(
        "[search_library_voices] No voices with accent {:?}, searching all of {}",
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
    dirs: State<'_, AppDirs>,
    account_id: Uuid,
) -> Result<SubscriptionInfo, ElevenLabsError> {
    elevenlabs
        .client_for_account(&dirs, account_id)?
        .subscription()
        .await
}

#[tauri::command]
pub async fn add_library_voice(
    elevenlabs: State<'_, ElevenLabs>,
    dirs: State<'_, AppDirs>,
    public_owner_id: String,
    voice_id: String,
    new_name: String,
) -> Result<String, ElevenLabsError> {
    let new_voice_id = elevenlabs
        .active_client(&dirs)
        .await?
        .add_library_voice(&public_owner_id, &voice_id, &new_name)
        .await?;
    log::info!("[add_library_voice] Saved {} as {}", voice_id, new_voice_id);
    Ok(new_voice_id)
}
