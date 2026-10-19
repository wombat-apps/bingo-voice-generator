use std::path::PathBuf;

use super::account_store::AccountStore;
use super::audio_store::AudioStore;
use super::format_store::FormatStore;

/// Where the app keeps its data: `voices.json`, `accounts.json`, `formats.json` and the audio of every
/// Voice. Managed by Tauri so tests can point it at a temporary directory.
#[derive(Debug, Clone)]
pub struct AppDirs {
    root: PathBuf,
}

impl AppDirs {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    /// `~/Library/Application Support/BingoVoiceGenerator` on macOS.
    pub fn from_system() -> Self {
        let app_support = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        Self::new(app_support.join("BingoVoiceGenerator"))
    }

    pub fn voices_file(&self) -> PathBuf {
        self.root.join("voices.json")
    }

    pub fn account_store(&self) -> AccountStore {
        AccountStore::new(self.root.join("accounts.json"))
    }

    pub fn format_store(&self) -> FormatStore {
        FormatStore::new(self.root.join("formats.json"))
    }

    pub fn audio_store(&self) -> AudioStore {
        AudioStore::new(self.root.clone())
    }
}
