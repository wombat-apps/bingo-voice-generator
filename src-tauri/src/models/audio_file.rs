use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use uuid::Uuid;

use super::{Accent, AudioPart, BingoMode};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFile {
    pub number: u32,
    pub part: AudioPart,
    pub accent: Accent,
    pub voice_uuid: String,
    pub mode: BingoMode,
    pub file_path: String,
    pub created_at: DateTime<Utc>,
}

impl AudioFile {
    pub fn new(
        number: u32,
        part: AudioPart,
        accent: Accent,
        voice: Uuid,
        mode: BingoMode,
        file_path: String,
        created_at: DateTime<Utc>,
    ) -> Self {
        Self {
            number,
            part,
            accent,
            voice_uuid: voice.to_string(),
            mode,
            file_path,
            created_at,
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
