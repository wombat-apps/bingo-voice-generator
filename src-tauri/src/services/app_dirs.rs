use std::path::PathBuf;

use super::audio_store::AudioStore;

/// Where the app keeps its data: `voices.json`, `accounts.json` and the audio of every
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

    pub fn accounts_file(&self) -> PathBuf {
        self.root.join("accounts.json")
    }

    pub fn audio_store(&self) -> AudioStore {
        AudioStore::new(self.root.clone())
    }
}
