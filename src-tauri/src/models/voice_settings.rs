use serde::{Deserialize, Serialize};

/// The parameters applied when generating audio (see GLOSSARY.md). The frontend keeps
/// them and sends them with each generation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSettings {
    /// The TTS Model, e.g. `eleven_v4`.
    pub model_id: String,
    pub stability: f64,
    pub similarity_boost: f64,
    pub style: f64,
    pub use_speaker_boost: bool,
    pub speed: f64,
}

impl Default for VoiceSettings {
    fn default() -> Self {
        Self {
            model_id: "eleven_v4".to_string(),
            stability: 0.5,
            similarity_boost: 0.85,
            style: 0.9,
            use_speaker_boost: true,
            speed: 1.0,
        }
    }
}
