use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Language {
    #[serde(rename = "es-ES")]
    Spanish,
    #[serde(rename = "en-US")]
    English,
    #[serde(rename = "en-GB")]
    EnglishGB,
    #[serde(rename = "fr-FR")]
    French,
    #[serde(rename = "pt-BR")]
    Portuguese,
    #[serde(rename = "it-IT")]
    Italian,
}

impl Language {
    pub fn all() -> Vec<Language> {
        vec![
            Language::Spanish,
            Language::English,
            Language::EnglishGB,
            Language::French,
            Language::Portuguese,
            Language::Italian,
        ]
    }

    pub fn raw_value(&self) -> &'static str {
        match self {
            Language::Spanish => "es-ES",
            Language::English => "en-US",
            Language::EnglishGB => "en-GB",
            Language::French => "fr-FR",
            Language::Portuguese => "pt-BR",
            Language::Italian => "it-IT",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Language::Spanish => "Espa\u{f1}ol",
            Language::English => "English (US)",
            Language::EnglishGB => "English (UK)",
            Language::French => "Fran\u{e7}ais",
            Language::Portuguese => "Portugu\u{ea}s",
            Language::Italian => "Italiano",
        }
    }

    pub fn flag(&self) -> &'static str {
        match self {
            Language::Spanish => "\u{1f1ea}\u{1f1f8}",
            Language::English => "\u{1f1fa}\u{1f1f8}",
            Language::EnglishGB => "\u{1f1ec}\u{1f1e7}",
            Language::French => "\u{1f1eb}\u{1f1f7}",
            Language::Portuguese => "\u{1f1e7}\u{1f1f7}",
            Language::Italian => "\u{1f1ee}\u{1f1f9}",
        }
    }

    pub fn elevenlabs_code(&self) -> &'static str {
        match self {
            Language::Spanish => "es",
            Language::English => "en",
            Language::EnglishGB => "en",
            Language::French => "fr",
            Language::Portuguese => "pt",
            Language::Italian => "it",
        }
    }

    pub fn elevenlabs_accent(&self) -> &'static str {
        match self {
            Language::Spanish => "peninsular",
            Language::English => "american",
            Language::EnglishGB => "british",
            Language::French => "standard",
            Language::Portuguese => "brazilian",
            Language::Italian => "standard",
        }
    }
}

impl Default for Language {
    fn default() -> Self {
        Language::Spanish
    }
}
