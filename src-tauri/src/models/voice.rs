use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::Accent;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Voice {
    pub uuid: Uuid,
    pub elevenlabs_id: String,
    pub elevenlabs_name: String,
    pub custom_name: String,
    /// Saved as `language` before Accents were split from Languages.
    #[serde(alias = "language")]
    pub accent: Accent,
    #[serde(default = "default_gender")]
    pub gender: String,
    #[serde(default)]
    pub favorite: bool,
    /// `None` for Voices saved before kinds were stored, until they are backfilled.
    #[serde(default)]
    pub kind: Option<VoiceKind>,
    /// `None` for Voices saved before details were stored, until they are backfilled.
    #[serde(default)]
    pub details: Option<VoiceDetails>,
}

/// How ElevenLabs describes the voice, as it did when the Voice was added. See GLOSSARY.md.
#[derive(Debug, Clone, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceDetails {
    /// ElevenLabs' free-form label (e.g. "castilian"), not the Voice's Accent.
    pub elevenlabs_accent: Option<String>,
    pub age: Option<String>,
    pub description: Option<String>,
    pub use_case: Option<String>,
}

/// Whether a Voice is a Default Voice or a Library Voice. See GLOSSARY.md.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VoiceKind {
    Default,
    Library,
}

fn default_gender() -> String {
    "male".to_string()
}

impl Voice {
    pub fn new(
        elevenlabs_id: String,
        elevenlabs_name: String,
        custom_name: Option<String>,
        accent: Accent,
        gender: Option<String>,
        kind: VoiceKind,
    ) -> Self {
        Self {
            uuid: Uuid::new_v4(),
            elevenlabs_id,
            elevenlabs_name: elevenlabs_name.clone(),
            custom_name: custom_name.unwrap_or(elevenlabs_name),
            accent,
            gender: gender.unwrap_or_else(|| "male".to_string()),
            favorite: false,
            kind: Some(kind),
            details: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn voice_saved_before_kinds_existed_loads_with_unknown_kind() {
        let json = r#"{"uuid":"6f9619ff-8b86-d011-b42d-00c04fc964ff","elevenlabsId":"abc","elevenlabsName":"Ana","customName":"Ana","language":"es-ES","gender":"female","favorite":true}"#;

        let voice: Voice = serde_json::from_str(json).unwrap();

        assert_eq!(voice.kind, None);
        assert_eq!(voice.details, None);
        assert_eq!(voice.custom_name, "Ana");
        assert_eq!(voice.accent, Accent::PeninsularSpanish);
    }
}
