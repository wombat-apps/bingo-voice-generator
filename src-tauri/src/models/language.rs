use serde::{Deserialize, Serialize};

/// The language the numbers are said in. It sets the number words; the user picks an Accent,
/// which belongs to one. See GLOSSARY.md.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Language {
    Spanish,
    English,
    French,
    Portuguese,
    Italian,
    German,
    Russian,
    Turkish,
    Hindi,
    Japanese,
}

impl Language {
    /// The ISO 639-1 code ElevenLabs takes as `language_code` and as the Voice Library language.
    pub fn elevenlabs_code(&self) -> &'static str {
        match self {
            Language::Spanish => "es",
            Language::English => "en",
            Language::French => "fr",
            Language::Portuguese => "pt",
            Language::Italian => "it",
            Language::German => "de",
            Language::Russian => "ru",
            Language::Turkish => "tr",
            Language::Hindi => "hi",
            Language::Japanese => "ja",
        }
    }
}
