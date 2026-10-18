use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::{AudioPart, BingoMode, Language, Voice};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFile {
    pub number: u32,
    pub part: AudioPart,
    pub language: Language,
    pub voice_uuid: String,
    pub mode: BingoMode,
    pub file_path: String,
    pub created_at: DateTime<Utc>,
    pub duration: f64,
}

impl AudioFile {
    pub fn new(
        number: u32,
        part: AudioPart,
        language: Language,
        voice: &Voice,
        mode: BingoMode,
        file_path: String,
        duration: f64,
    ) -> Self {
        Self {
            number,
            part,
            language,
            voice_uuid: voice.uuid.to_string(),
            mode,
            file_path,
            created_at: Utc::now(),
            duration,
        }
    }
}

/// Represents a pair of audio files (word and digit) for a single number
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumberAudioPair {
    pub number: u32,
    pub word_audio: Option<AudioFile>,
    pub digit_audio: Option<AudioFile>,
}

impl NumberAudioPair {
    pub fn new(number: u32) -> Self {
        Self {
            number,
            word_audio: None,
            digit_audio: None,
        }
    }
}
