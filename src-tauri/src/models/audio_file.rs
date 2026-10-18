use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use uuid::Uuid;

use super::{Accent, AudioPart, BingoMode};

/// A number of one Voice in one Bingo Mode: its Word and its Digit, whichever exist.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceNumber {
    pub accent: Accent,
    pub voice_uuid: Uuid,
    pub mode: BingoMode,
    pub number: u32,
}

impl VoiceNumber {
    pub fn new(accent: Accent, voice: Uuid, mode: BingoMode, number: u32) -> Self {
        Self {
            accent,
            voice_uuid: voice,
            mode,
            number,
        }
    }

    pub fn with_part(self, part: AudioPart) -> AudioFileId {
        AudioFileId {
            accent: self.accent,
            voice_uuid: self.voice_uuid,
            mode: self.mode,
            number: self.number,
            part,
        }
    }
}

/// The Word or the Digit of a `VoiceNumber`: what names one audio file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFileId {
    pub accent: Accent,
    pub voice_uuid: Uuid,
    pub mode: BingoMode,
    pub number: u32,
    pub part: AudioPart,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFile {
    #[serde(flatten)]
    pub id: AudioFileId,
    pub file_path: String,
    pub created_at: DateTime<Utc>,
}

impl AudioFile {
    pub fn new(id: AudioFileId, file_path: String, created_at: DateTime<Utc>) -> Self {
        Self {
            id,
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const VOICE: &str = "6f1c1f3e-2a4b-4c5d-8e9f-0a1b2c3d4e5f";

    #[test]
    fn an_audio_file_id_reads_the_shape_the_frontend_sends() {
        let id: AudioFileId = serde_json::from_value(json!({
            "accent": "es-ES",
            "voiceUuid": VOICE,
            "mode": "bingo75",
            "number": 45,
            "part": "word",
        }))
        .unwrap();

        assert_eq!(
            id,
            VoiceNumber::new(
                Accent::PeninsularSpanish,
                Uuid::parse_str(VOICE).unwrap(),
                BingoMode::Bingo75,
                45
            )
            .with_part(AudioPart::Word)
        );
    }

    #[test]
    fn an_audio_file_serializes_its_id_alongside_its_path() {
        let id = VoiceNumber::new(
            Accent::PeninsularSpanish,
            Uuid::parse_str(VOICE).unwrap(),
            BingoMode::Bingo90,
            45,
        )
        .with_part(AudioPart::Digit);
        let created_at = DateTime::parse_from_rfc3339("2026-10-19T10:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        assert_eq!(
            serde_json::to_value(AudioFile::new(id, "/a/45_digit.mp3".into(), created_at)).unwrap(),
            json!({
                "accent": "es-ES",
                "voiceUuid": VOICE,
                "mode": "bingo90",
                "number": 45,
                "part": "digit",
                "filePath": "/a/45_digit.mp3",
                "createdAt": "2026-10-19T10:00:00Z",
            })
        );
    }
}
