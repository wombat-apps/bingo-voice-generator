use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum AudioPart {
    #[default]
    Word,
    Digit,
}

impl AudioPart {
    pub fn all() -> Vec<AudioPart> {
        vec![AudioPart::Word, AudioPart::Digit]
    }

    pub fn file_suffix(&self) -> &'static str {
        match self {
            AudioPart::Word => "word",
            AudioPart::Digit => "digit",
        }
    }
}
