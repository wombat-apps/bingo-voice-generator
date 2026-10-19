use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::VoiceSettings;

/// How one audio file was generated (see GLOSSARY.md). `AudioStore` keeps them inside the
/// file, in an ID3 tag; see `docs/adr/0003-generation-details-in-id3-tags.md`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationDetails {
    /// The Word Format or Digit Format of the part, as written, even the Default one.
    pub format: String,
    /// The text sent to ElevenLabs, without its context.
    pub text: String,
    pub settings: VoiceSettings,
    pub elevenlabs_voice_id: String,
    pub generated_at: DateTime<Utc>,
}
