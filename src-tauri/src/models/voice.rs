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
    ) -> Self {
        Self {
            uuid: Uuid::new_v4(),
            elevenlabs_id,
            elevenlabs_name: elevenlabs_name.clone(),
            custom_name: custom_name.unwrap_or(elevenlabs_name),
            language,
            gender: gender.unwrap_or_else(|| "male".to_string()),
            favorite: false,
        }
    }
}
