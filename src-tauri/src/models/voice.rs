use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::Language;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Voice {
    pub uuid: Uuid,
    pub elevenlabs_id: String,
    pub elevenlabs_name: String,
    pub custom_name: String,
    pub language: Language,
    #[serde(default = "default_gender")]
    pub gender: String,
    #[serde(default)]
    pub favorite: bool,
    /// `None` for Voices saved before kinds were stored, until they are backfilled.
    #[serde(default)]
    pub kind: Option<VoiceKind>,
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
        language: Language,
        gender: Option<String>,
        kind: VoiceKind,
    ) -> Self {
        Self {
            uuid: Uuid::new_v4(),
            elevenlabs_id,
            elevenlabs_name: elevenlabs_name.clone(),
            custom_name: custom_name.unwrap_or(elevenlabs_name),
            language,
            gender: gender.unwrap_or_else(|| "male".to_string()),
            favorite: false,
            kind: Some(kind),
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
        assert_eq!(voice.custom_name, "Ana");
    }
}
