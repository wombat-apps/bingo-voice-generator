use serde::Serialize;
use thiserror::Error;

const SERVICE_NAME: &str = "BingoVoiceGenerator";
const API_KEY_ACCOUNT: &str = "elevenlabs_api_key";

#[derive(Debug, Error)]
pub enum KeychainError {
    #[error("Keyring error: {0}")]
    KeyringError(String),
    #[error("No password found")]
    NoPassword,
}

impl Serialize for KeychainError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<keyring::Error> for KeychainError {
    fn from(err: keyring::Error) -> Self {
        match err {
            keyring::Error::NoEntry => KeychainError::NoPassword,
            e => KeychainError::KeyringError(e.to_string()),
        }
    }
}

#[tauri::command]
pub fn get_api_key() -> Result<String, KeychainError> {
    let entry = keyring::Entry::new(SERVICE_NAME, API_KEY_ACCOUNT)?;
    let password = entry.get_password()?;
    Ok(password)
}

#[tauri::command]
pub fn set_api_key(api_key: String) -> Result<(), KeychainError> {
    let entry = keyring::Entry::new(SERVICE_NAME, API_KEY_ACCOUNT)?;
    entry.set_password(&api_key)?;
    Ok(())
}

#[tauri::command]
pub fn delete_api_key() -> Result<(), KeychainError> {
    let entry = keyring::Entry::new(SERVICE_NAME, API_KEY_ACCOUNT)?;
    entry.delete_credential()?;
    Ok(())
}

#[tauri::command]
pub fn has_api_key() -> bool {
    match keyring::Entry::new(SERVICE_NAME, API_KEY_ACCOUNT) {
        Ok(entry) => entry.get_password().is_ok(),
        Err(_) => false,
    }
}
