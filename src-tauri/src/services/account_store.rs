use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::fs;
use uuid::Uuid;

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
    /// The last characters of the API key, e.g. `••••a1b2`, so the key itself never has to
    /// leave the Keychain to be recognised. `None` for accounts saved before it existed,
    /// until `list_accounts` fills it in.
    #[serde(default)]
    pub key_hint: Option<String>,
}

/// Saved accounts plus the Active Account, persisted (without keys) in `accounts.json`.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsState {
    pub accounts: Vec<ElevenLabsAccount>,
    pub active_account_id: Option<Uuid>,
}

impl AccountsState {
    pub fn add(&mut self, name: &str, api_key: &str) -> Result<Uuid, AccountsError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AccountsError::EmptyName);
        }
        let id = Uuid::new_v4();
        self.accounts.push(ElevenLabsAccount {
            id,
            name: name.to_string(),
            key_hint: Some(key_hint(api_key)),
        });
        // The first account becomes active so it can be used right away
        if self.active_account_id.is_none() {
            self.active_account_id = Some(id);
        }
        Ok(id)
    }

    pub fn rename(&mut self, id: Uuid, name: &str) -> Result<(), AccountsError> {
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

    pub fn remove(&mut self, id: Uuid) -> Result<(), AccountsError> {
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

    pub fn set_active(&mut self, id: Option<Uuid>) -> Result<(), AccountsError> {
        if let Some(id) = id {
            if !self.accounts.iter().any(|a| a.id == id) {
                return Err(AccountsError::NotFound);
            }
        }
        self.active_account_id = id;
        Ok(())
    }
}

/// `••••` plus the last four characters of an API key.
pub fn key_hint(api_key: &str) -> String {
    let chars: Vec<char> = api_key.chars().collect();
    let last: String = chars[chars.len().saturating_sub(4)..].iter().collect();
    format!("••••{}", last)
}

/// The saved ElevenLabs Accounts: their names and the Active Account in `accounts.json`,
/// their API keys in the Keychain. It is the only module that reads either.
#[derive(Debug, Clone)]
pub struct AccountStore {
    file: PathBuf,
}

impl AccountStore {
    pub fn new(file: PathBuf) -> Self {
        Self { file }
    }

    /// The saved state, or no accounts when `accounts.json` does not exist yet.
    pub async fn load(&self) -> Result<AccountsState, AccountsError> {
        if !self.file.exists() {
            return Ok(AccountsState::default());
        }
        let content = fs::read_to_string(&self.file).await?;
        Ok(serde_json::from_str(&content)?)
    }

    pub async fn save(&self, state: &AccountsState) -> Result<(), AccountsError> {
        if let Some(parent) = self.file.parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::write(&self.file, serde_json::to_string_pretty(state)?).await?;
        Ok(())
    }

    /// The Active Account's id.
    pub async fn active_account_id(&self) -> Result<Option<Uuid>, AccountsError> {
        Ok(self.load().await?.active_account_id)
    }

    /// A saved account's API key.
    pub fn api_key(&self, id: Uuid) -> Result<String, AccountsError> {
        Ok(keychain_entry(id)?.get_password()?)
    }

    pub fn set_api_key(&self, id: Uuid, api_key: &str) -> Result<(), AccountsError> {
        Ok(keychain_entry(id)?.set_password(api_key)?)
    }

    /// Removes an account's API key, if it still has one.
    pub fn delete_api_key(&self, id: Uuid) -> Result<(), AccountsError> {
        match keychain_entry(id)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.into()),
        }
    }
}

fn keychain_entry(id: Uuid) -> Result<keyring::Entry, AccountsError> {
    let account = format!("{}_{}", API_KEY_ACCOUNT_PREFIX, id);
    Ok(keyring::Entry::new(SERVICE_NAME, &account)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> (tempfile::TempDir, AccountStore) {
        let dir = tempfile::tempdir().unwrap();
        let store = AccountStore::new(dir.path().join("accounts.json"));
        (dir, store)
    }

    #[tokio::test]
    async fn without_accounts_json_there_are_no_accounts_and_no_active_account() {
        let (_dir, store) = store();
        assert_eq!(store.load().await.unwrap(), AccountsState::default());
        assert_eq!(store.active_account_id().await.unwrap(), None);
    }

    #[tokio::test]
    async fn the_active_account_is_read_back_from_what_was_saved() {
        let (_dir, store) = store();
        let mut state = AccountsState::default();
        let id = state.add("Personal", "sk_abcdef").unwrap();
        store.save(&state).await.unwrap();

        assert_eq!(store.load().await.unwrap(), state);
        assert_eq!(store.active_account_id().await.unwrap(), Some(id));
    }

    #[test]
    fn first_added_account_becomes_active() {
        let mut state = AccountsState::default();
        let first = state.add("Personal", "key").unwrap();
        state.add("Client", "key").unwrap();
        assert_eq!(state.active_account_id, Some(first));
        assert_eq!(state.accounts.len(), 2);
    }

    #[test]
    fn add_rejects_blank_name_and_trims() {
        let mut state = AccountsState::default();
        assert!(matches!(
            state.add("   ", "key"),
            Err(AccountsError::EmptyName)
        ));
        state.add("  Personal ", "sk_abcdef").unwrap();
        assert_eq!(state.accounts[0].name, "Personal");
        assert_eq!(state.accounts[0].key_hint.as_deref(), Some("••••cdef"));
    }

    #[test]
    fn removing_active_account_leaves_none_active() {
        let mut state = AccountsState::default();
        let first = state.add("Personal", "key").unwrap();
        state.add("Client", "key").unwrap();
        state.remove(first).unwrap();
        assert_eq!(state.active_account_id, None);
        assert_eq!(state.accounts.len(), 1);
    }

    #[test]
    fn removing_inactive_account_keeps_active() {
        let mut state = AccountsState::default();
        let first = state.add("Personal", "key").unwrap();
        let second = state.add("Client", "key").unwrap();
        state.remove(second).unwrap();
        assert_eq!(state.active_account_id, Some(first));
    }

    #[test]
    fn rename_updates_name() {
        let mut state = AccountsState::default();
        let id = state.add("Personal", "key").unwrap();
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
        let id = state.add("Personal", "key").unwrap();
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
