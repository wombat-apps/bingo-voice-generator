use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::fs;
use uuid::Uuid;

use tauri::State;

use super::elevenlabs::{get_subscription, has_voices_read};
use crate::services::app_dirs::AppDirs;

const SERVICE_NAME: &str = "BingoVoiceGenerator";
const API_KEY_ACCOUNT_PREFIX: &str = "elevenlabs_api_key";

#[derive(Debug, Error)]
pub enum AccountsError {
    #[error("Account name cannot be empty")]
    EmptyName,
    #[error("API key cannot be empty")]
    EmptyApiKey,
    #[error("This API key is already saved as \"{0}\"")]
    DuplicateApiKey(String),
    #[error("Account not found")]
    NotFound,
    #[error("Invalid API key: {0}")]
    InvalidApiKey(String),
    #[error("Keyring error: {0}")]
    Keyring(#[from] keyring::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

impl Serialize for AccountsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// An ElevenLabs account saved in the app. Its API key lives in the Keychain.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevenLabsAccount {
    pub id: Uuid,
    pub name: String,
}

/// Saved accounts plus the Active Account, persisted (without keys) in `accounts.json`.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsState {
    pub accounts: Vec<ElevenLabsAccount>,
    pub active_account_id: Option<Uuid>,
}

impl AccountsState {
    fn add(&mut self, name: &str) -> Result<Uuid, AccountsError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AccountsError::EmptyName);
        }
        let id = Uuid::new_v4();
        self.accounts.push(ElevenLabsAccount {
            id,
            name: name.to_string(),
        });
        // The first account becomes active so it can be used right away
        if self.active_account_id.is_none() {
            self.active_account_id = Some(id);
        }
        Ok(id)
    }

    fn rename(&mut self, id: Uuid, name: &str) -> Result<(), AccountsError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AccountsError::EmptyName);
        }
        let account = self
            .accounts
            .iter_mut()
            .find(|a| a.id == id)
            .ok_or(AccountsError::NotFound)?;
        account.name = name.to_string();
        Ok(())
    }

    fn remove(&mut self, id: Uuid) -> Result<(), AccountsError> {
        let index = self
            .accounts
            .iter()
            .position(|a| a.id == id)
            .ok_or(AccountsError::NotFound)?;
        self.accounts.remove(index);
        if self.active_account_id == Some(id) {
            self.active_account_id = None;
        }
        Ok(())
    }

    fn set_active(&mut self, id: Option<Uuid>) -> Result<(), AccountsError> {
        if let Some(id) = id {
            if !self.accounts.iter().any(|a| a.id == id) {
                return Err(AccountsError::NotFound);
            }
        }
        self.active_account_id = id;
        Ok(())
    }
}

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

async fn load_state(dirs: &AppDirs) -> Result<AccountsState, AccountsError> {
    let path = dirs.accounts_file();
    if !path.exists() {
        return Ok(AccountsState::default());
    }
    let content = fs::read_to_string(&path).await?;
    Ok(serde_json::from_str(&content)?)
}

async fn save_state(dirs: &AppDirs, state: &AccountsState) -> Result<(), AccountsError> {
    let path = dirs.accounts_file();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }
    fs::write(&path, serde_json::to_string_pretty(state)?).await?;
    Ok(())
}

fn keychain_entry(id: Uuid) -> Result<keyring::Entry, AccountsError> {
    let account = format!("{}_{}", API_KEY_ACCOUNT_PREFIX, id);
    Ok(keyring::Entry::new(SERVICE_NAME, &account)?)
}

#[tauri::command]
pub async fn list_accounts(dirs: State<'_, AppDirs>) -> Result<AccountsState, AccountsError> {
    load_state(&dirs).await
}

#[tauri::command]
pub async fn get_account_api_key(account_id: Uuid) -> Result<String, AccountsError> {
    Ok(keychain_entry(account_id)?.get_password()?)
}

/// Saves a new account after checking the key against ElevenLabs. `user_read` is required;
/// `voices_read` is probed without side effects and reported if missing.
/// `text_to_speech` and `voices_write` cannot be checked without spending characters or
/// saving a voice, so they are not tested.
#[tauri::command]
pub async fn add_account(
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

    let mut state = load_state(&dirs).await?;
    for account in &state.accounts {
        if keychain_entry(account.id)?.get_password().ok().as_deref() == Some(api_key.as_str()) {
            return Err(AccountsError::DuplicateApiKey(account.name.clone()));
        }
    }

    get_subscription(api_key.clone())
        .await
        .map_err(|e| AccountsError::InvalidApiKey(e.to_string()))?;

    let mut missing_permissions = Vec::new();
    if !has_voices_read(&api_key).await {
        missing_permissions.push(ApiKeyPermission::VoicesRead);
    }

    let id = state.add(&name)?;
    keychain_entry(id)?.set_password(&api_key)?;
    save_state(&dirs, &state).await?;
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
    let mut state = load_state(&dirs).await?;
    state.rename(account_id, &name)?;
    save_state(&dirs, &state).await?;
    Ok(state)
}

#[tauri::command]
pub async fn delete_account(
    dirs: State<'_, AppDirs>,
    account_id: Uuid,
) -> Result<AccountsState, AccountsError> {
    let mut state = load_state(&dirs).await?;
    state.remove(account_id)?;
    match keychain_entry(account_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(e.into()),
    }
    save_state(&dirs, &state).await?;
    Ok(state)
}

#[tauri::command]
pub async fn set_active_account(
    dirs: State<'_, AppDirs>,
    account_id: Option<Uuid>,
) -> Result<AccountsState, AccountsError> {
    let mut state = load_state(&dirs).await?;
    state.set_active(account_id)?;
    save_state(&dirs, &state).await?;
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_added_account_becomes_active() {
        let mut state = AccountsState::default();
        let first = state.add("Personal").unwrap();
        state.add("Client").unwrap();
        assert_eq!(state.active_account_id, Some(first));
        assert_eq!(state.accounts.len(), 2);
    }

    #[test]
    fn add_rejects_blank_name_and_trims() {
        let mut state = AccountsState::default();
        assert!(matches!(state.add("   "), Err(AccountsError::EmptyName)));
        state.add("  Personal ").unwrap();
        assert_eq!(state.accounts[0].name, "Personal");
    }

    #[test]
    fn removing_active_account_leaves_none_active() {
        let mut state = AccountsState::default();
        let first = state.add("Personal").unwrap();
        state.add("Client").unwrap();
        state.remove(first).unwrap();
        assert_eq!(state.active_account_id, None);
        assert_eq!(state.accounts.len(), 1);
    }

    #[test]
    fn removing_inactive_account_keeps_active() {
        let mut state = AccountsState::default();
        let first = state.add("Personal").unwrap();
        let second = state.add("Client").unwrap();
        state.remove(second).unwrap();
        assert_eq!(state.active_account_id, Some(first));
    }

    #[test]
    fn rename_updates_name() {
        let mut state = AccountsState::default();
        let id = state.add("Personal").unwrap();
        state.rename(id, "Home").unwrap();
        assert_eq!(state.accounts[0].name, "Home");
        assert!(matches!(
            state.rename(id, ""),
            Err(AccountsError::EmptyName)
        ));
    }

    #[test]
    fn set_active_requires_known_account() {
        let mut state = AccountsState::default();
        let id = state.add("Personal").unwrap();
        assert!(matches!(
            state.set_active(Some(Uuid::new_v4())),
            Err(AccountsError::NotFound)
        ));
        state.set_active(None).unwrap();
        assert_eq!(state.active_account_id, None);
        state.set_active(Some(id)).unwrap();
        assert_eq!(state.active_account_id, Some(id));
    }
}
