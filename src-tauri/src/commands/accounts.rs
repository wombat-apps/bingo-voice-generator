use serde::Serialize;
use uuid::Uuid;

use tauri::State;

use super::elevenlabs::ElevenLabs;
use crate::services::account_store::{key_hint, AccountsError, AccountsState};
use crate::services::app_dirs::AppDirs;

/// An API key permission the app checks when an account is added.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ApiKeyPermission {
    VoicesRead,
}

/// The result of adding an account: the new state plus the API key permissions it lacks.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddAccountResult {
    pub state: AccountsState,
    /// Checked permissions the key lacks, e.g. `voices_read`. The account is saved anyway.
    pub missing_permissions: Vec<ApiKeyPermission>,
}

#[tauri::command]
pub async fn list_accounts(dirs: State<'_, AppDirs>) -> Result<AccountsState, AccountsError> {
    let store = dirs.account_store();
    let mut state = store.load().await?;
    let mut changed = state.activate_only_account();
    // The Active Account's key is checked every time, so a key gone from the
    // Keychain clears its hint and the UI stops offering to generate.
    let active_id = state.active_account_id;
    for account in state
        .accounts
        .iter_mut()
        .filter(|a| a.key_hint.is_none() || Some(a.id) == active_id)
    {
        let hint = match store.api_key(account.id) {
            Ok(key) => Some(key_hint(&key)),
            Err(e) => {
                log::warn!("[list_accounts] No key for \"{}\": {}", account.name, e);
                None
            }
        };
        if account.key_hint != hint {
            account.key_hint = hint;
            changed = true;
        }
    }
    if changed {
        store.save(&state).await?;
    }
    Ok(state)
}

/// The full API key, only for showing it when the user asks to. Requests to ElevenLabs
/// read the key in Rust and never take it from the frontend.
#[tauri::command]
pub async fn reveal_account_api_key(
    dirs: State<'_, AppDirs>,
    account_id: Uuid,
) -> Result<String, AccountsError> {
    dirs.account_store().api_key(account_id)
}

/// Saves a new account after checking the key against ElevenLabs. `user_read` is required;
/// `voices_read` is probed without side effects and reported if missing.
/// `text_to_speech` and `voices_write` cannot be checked without spending characters or
/// saving a voice, so they are not tested.
#[tauri::command]
pub async fn add_account(
    elevenlabs: State<'_, ElevenLabs>,
    dirs: State<'_, AppDirs>,
    name: String,
    api_key: String,
) -> Result<AddAccountResult, AccountsError> {
    let api_key = api_key.trim().to_string();
    if name.trim().is_empty() {
        return Err(AccountsError::EmptyName);
    }
    if api_key.is_empty() {
        return Err(AccountsError::EmptyApiKey);
    }

    let store = dirs.account_store();
    let mut state = store.load().await?;
    for account in &state.accounts {
        if store.api_key(account.id).ok().as_deref() == Some(api_key.as_str()) {
            return Err(AccountsError::DuplicateApiKey(account.name.clone()));
        }
    }

    let client = elevenlabs.client_for_key(api_key.clone());
    client
        .subscription()
        .await
        .map_err(|e| AccountsError::InvalidApiKey(e.to_string()))?;

    let mut missing_permissions = Vec::new();
    if !client.has_voices_read().await {
        missing_permissions.push(ApiKeyPermission::VoicesRead);
    }

    let id = state.add(&name, &api_key)?;
    store.set_api_key(id, &api_key)?;
    store.save(&state).await?;
    if !missing_permissions.is_empty() {
        log::warn!(
            "[add_account] Saved account \"{}\" without permissions: {:?}",
            name.trim(),
            missing_permissions
        );
    }
    Ok(AddAccountResult {
        state,
        missing_permissions,
    })
}

#[tauri::command]
pub async fn rename_account(
    dirs: State<'_, AppDirs>,
    account_id: Uuid,
    name: String,
) -> Result<AccountsState, AccountsError> {
    let store = dirs.account_store();
    let mut state = store.load().await?;
    state.rename(account_id, &name)?;
    store.save(&state).await?;
    Ok(state)
}

#[tauri::command]
pub async fn delete_account(
    dirs: State<'_, AppDirs>,
    elevenlabs: State<'_, ElevenLabs>,
    account_id: Uuid,
) -> Result<AccountsState, AccountsError> {
    let store = dirs.account_store();
    let mut state = store.load().await?;
    state.remove(account_id)?;
    store.delete_api_key(account_id)?;
    elevenlabs.forget_account(account_id).await;
    store.save(&state).await?;
    Ok(state)
}

#[tauri::command]
pub async fn set_active_account(
    dirs: State<'_, AppDirs>,
    account_id: Option<Uuid>,
) -> Result<AccountsState, AccountsError> {
    let store = dirs.account_store();
    let mut state = store.load().await?;
    state.set_active(account_id)?;
    store.save(&state).await?;
    Ok(state)
}
