use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioPart {
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

impl Default for AudioPart {
    fn default() -> Self {
        AudioPart::Word
    }
}
