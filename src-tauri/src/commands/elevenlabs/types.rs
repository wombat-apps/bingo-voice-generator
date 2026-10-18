use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::models::Accent;

// API Response Models
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevenLabsVoice {
    #[serde(rename(deserialize = "voice_id"))]
    pub voice_id: String,
    pub name: String,
    pub category: String,
    #[serde(rename(deserialize = "created_at_unix"))]
    pub created_at_unix: Option<i64>,
    /// `gender`, `accent`, `age`, `use_case`, among others.
    #[serde(default)]
    pub labels: HashMap<String, String>,
    pub description: Option<String>,
    #[serde(rename(deserialize = "preview_url"))]
    pub preview_url: Option<String>,
    #[serde(default, rename(deserialize = "verified_languages"))]
    pub verified_languages: Vec<VerifiedLanguage>,
}

/// A language ElevenLabs has checked the voice speaks, with a preview in it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifiedLanguage {
    pub language: String,
    pub accent: Option<String>,
    pub locale: Option<String>,
    #[serde(rename(deserialize = "preview_url"))]
    pub preview_url: Option<String>,
}

/// A Default Voice as the voice picker shows it, for one Accent.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DefaultVoice {
    pub voice_id: String,
    pub name: String,
    pub gender: Option<String>,
    pub accent: Option<String>,
    pub age: Option<String>,
    pub description: Option<String>,
    pub preview_url: Option<String>,
}

impl DefaultVoice {
    /// The voice for the Language of `accent`, or `None` when ElevenLabs has not verified it
    /// speaks it. The preview is the one in the Accent if there is one, then any in the
    /// Language, then the generic one.
    pub fn for_accent(voice: &ElevenLabsVoice, accent: Accent) -> Option<Self> {
        let in_language: Vec<&VerifiedLanguage> = voice
            .verified_languages
            .iter()
            .filter(|v| v.language == accent.elevenlabs_code())
            .collect();
        let verified = in_language
            .iter()
            .find(|v| v.accent.as_deref() == Some(accent.elevenlabs_accent()))
            .or_else(|| in_language.first())?;
        let label = |key: &str| voice.labels.get(key).cloned();
        Some(DefaultVoice {
            voice_id: voice.voice_id.clone(),
            name: voice.name.clone(),
            gender: label("gender"),
            accent: verified.accent.clone().or_else(|| label("accent")),
            age: label("age"),
            description: voice.description.clone().or_else(|| label("description")),
            preview_url: verified
                .preview_url
                .clone()
                .or_else(|| in_language.iter().find_map(|v| v.preview_url.clone()))
                .or_else(|| voice.preview_url.clone()),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicesResponse {
    pub voices: Vec<ElevenLabsVoice>,
    pub has_more: Option<bool>,
    pub total_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedVoice {
    #[serde(rename(deserialize = "voice_id"))]
    pub voice_id: String,
    pub name: String,
    pub accent: Option<String>,
    pub gender: Option<String>,
    pub age: Option<String>,
    pub language: Option<String>,
    pub locale: Option<String>,
    pub description: Option<String>,
    #[serde(rename(deserialize = "preview_url"))]
    pub preview_url: Option<String>,
    pub category: Option<String>,
    #[serde(rename(deserialize = "use_case"))]
    pub use_case: Option<String>,
    #[serde(rename(deserialize = "public_owner_id"))]
    pub public_owner_id: Option<String>,
    /// How many ElevenLabs users have added the voice: the Voice Library has no rating.
    #[serde(default, rename(deserialize = "cloned_by_count"))]
    pub cloned_by_count: Option<u64>,
    #[serde(default)]
    pub featured: Option<bool>,
}

/// The orders the Voice Library can return its voices in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LibraryVoiceSort {
    #[default]
    Trending,
    ClonedByCount,
    #[serde(rename = "usage_character_count_1y")]
    UsageCharacterCount1y,
    CreatedDate,
}

impl LibraryVoiceSort {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Trending => "trending",
            Self::ClonedByCount => "cloned_by_count",
            Self::UsageCharacterCount1y => "usage_character_count_1y",
            Self::CreatedDate => "created_date",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddSharedVoiceResponse {
    pub voice_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedVoicesResponse {
    pub voices: Vec<SharedVoice>,
    #[serde(rename(deserialize = "has_more"))]
    pub has_more: bool,
    /// The Accent's label found no voices, so these are from its whole Language.
    #[serde(default, skip_deserializing)]
    pub whole_language: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionInfo {
    pub tier: String,
    #[serde(rename(deserialize = "character_count"))]
    pub character_count: i64,
    #[serde(rename(deserialize = "character_limit"))]
    pub character_limit: i64,
    pub status: String,
    #[serde(rename(deserialize = "next_character_count_reset_unix"))]
    pub next_character_count_reset_unix: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_voice(verified: &str) -> ElevenLabsVoice {
        serde_json::from_str(&format!(
            r#"{{"voice_id":"v1","name":"Sarah","category":"premade",
                "labels":{{"gender":"female","age":"young","accent":"american"}},
                "preview_url":"generic.mp3","verified_languages":[{verified}]}}"#
        ))
        .unwrap()
    }

    #[test]
    fn default_voice_not_verified_for_the_language_is_left_out() {
        let voice = default_voice(r#"{"language":"en","model_id":"m","preview_url":"en.mp3"}"#);

        assert_eq!(
            DefaultVoice::for_accent(&voice, Accent::PeninsularSpanish),
            None
        );
    }

    #[test]
    fn default_voice_takes_the_preview_in_the_language_accent() {
        let voice = default_voice(
            r#"{"language":"es","model_id":"m","accent":"latin american","preview_url":"latam.mp3"},
               {"language":"es","model_id":"m","accent":"peninsular","preview_url":"es.mp3"}"#,
        );

        let picked = DefaultVoice::for_accent(&voice, Accent::PeninsularSpanish).unwrap();

        assert_eq!(picked.preview_url.as_deref(), Some("es.mp3"));
        assert_eq!(picked.accent.as_deref(), Some("peninsular"));
        assert_eq!(picked.gender.as_deref(), Some("female"));
    }

    #[test]
    fn default_voice_in_another_accent_still_counts_for_the_language() {
        let voice = default_voice(
            r#"{"language":"es","model_id":"m","accent":"latin american","preview_url":"latam.mp3"}"#,
        );

        let picked = DefaultVoice::for_accent(&voice, Accent::PeninsularSpanish).unwrap();

        assert_eq!(picked.preview_url.as_deref(), Some("latam.mp3"));
    }

    #[test]
    fn default_voice_without_a_preview_in_the_language_falls_back_to_the_generic_one() {
        let voice = default_voice(r#"{"language":"es","model_id":"m"}"#);

        let picked = DefaultVoice::for_accent(&voice, Accent::PeninsularSpanish).unwrap();

        assert_eq!(picked.preview_url.as_deref(), Some("generic.mp3"));
    }

    #[test]
    fn library_voice_sort_matches_the_api_values() {
        for sort in [
            LibraryVoiceSort::Trending,
            LibraryVoiceSort::ClonedByCount,
            LibraryVoiceSort::UsageCharacterCount1y,
            LibraryVoiceSort::CreatedDate,
        ] {
            let json = serde_json::to_string(&sort).unwrap();
            assert_eq!(json, format!("\"{}\"", sort.as_str()));
        }
    }

    #[test]
    fn shared_voice_reads_its_popularity() {
        let voice: SharedVoice = serde_json::from_str(
            r#"{"voice_id":"v","name":"Ana","cloned_by_count":1234,"featured":true}"#,
        )
        .unwrap();

        assert_eq!(voice.cloned_by_count, Some(1234));
        assert_eq!(voice.featured, Some(true));
    }
}
