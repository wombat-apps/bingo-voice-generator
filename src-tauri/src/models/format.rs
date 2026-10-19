use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

use super::{AudioPart, BingoMode, Language};

/// The placeholders of a Word Format and of a Digit Format. See `build_word_text_with_format`
/// and `build_digit_text_with_format`.
const NUMBER_PLACEHOLDERS: [&str; 4] = ["{num}", "{Num}", "{NUM}", "{#}"];
const LETTER_PLACEHOLDERS: [&str; 3] = ["{letter}", "{Letter}", "{LETTER}"];
const FIRST_PLACEHOLDERS: [&str; 4] = ["{first}", "{First}", "{FIRST}", "{#1}"];
const SECOND_PLACEHOLDERS: [&str; 4] = ["{second}", "{Second}", "{SECOND}", "{#2}"];

/// What a format writes: the Word of a Language in one Bingo Mode, or the Digit of a
/// Language, which serves every Bingo Mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatSlot {
    pub language: Language,
    pub part: AudioPart,
    /// The Bingo Mode of a Word Format; a Digit Format has none.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bingo_mode: Option<BingoMode>,
}

impl FormatSlot {
    /// The slot of `part`; `mode` is ignored for the Digit.
    pub fn new(language: Language, part: AudioPart, mode: BingoMode) -> Self {
        Self {
            language,
            part,
            bingo_mode: (part == AudioPart::Word).then_some(mode),
        }
    }
}

/// A Word Format or a Digit Format the user added. The Default ones are not stored: they are
/// the Language's own phrasing in `number_words.rs`. See GLOSSARY.md.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartFormat {
    pub id: Uuid,
    #[serde(flatten)]
    pub slot: FormatSlot,
    pub format: String,
}

/// The text of the formats to write with, for one Language; `None` for the Default ones.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct SelectedFormats {
    pub word_90: Option<String>,
    pub word_75: Option<String>,
    pub digit: Option<String>,
}

impl SelectedFormats {
    pub fn word(&self, mode: BingoMode) -> Option<&str> {
        match mode {
            BingoMode::Bingo90 => self.word_90.as_deref(),
            BingoMode::Bingo75 => self.word_75.as_deref(),
        }
    }

    pub fn digit(&self) -> Option<&str> {
        self.digit.as_deref()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum FormatInvalid {
    #[error("This format already exists")]
    Duplicate,
    #[error("The Word Format must contain the number: {{num}}, {{Num}}, {{NUM}} or {{#}}")]
    NoNumber,
    #[error(
        "The Digit Format must contain both digits: {{first}} or {{#1}}, and {{second}} or {{#2}}"
    )]
    NoDigits,
    #[error("Bingo 90 has no letter: remove {0}")]
    LetterInBingo90(String),
    #[error("Unknown placeholder {0}: use {1}")]
    UnknownPlaceholder(String, String),
}

/// The placeholders `slot` can use, for the UI's hint and the error message.
pub fn format_placeholders(slot: FormatSlot) -> Vec<&'static str> {
    match (slot.part, slot.bingo_mode) {
        (AudioPart::Word, Some(BingoMode::Bingo75)) => {
            [&NUMBER_PLACEHOLDERS[..], &LETTER_PLACEHOLDERS[..]].concat()
        }
        (AudioPart::Word, _) => NUMBER_PLACEHOLDERS.to_vec(),
        (AudioPart::Digit, _) => [&FIRST_PLACEHOLDERS[..], &SECOND_PLACEHOLDERS[..]].concat(),
    }
}

/// Checks a format before it is saved, so a typo is never sent to ElevenLabs as text.
pub fn validate_format(format: &str, slot: FormatSlot) -> Result<(), FormatInvalid> {
    let allowed = format_placeholders(slot);
    for placeholder in placeholders(format) {
        if allowed.contains(&placeholder) {
            continue;
        }
        if slot.part == AudioPart::Word && LETTER_PLACEHOLDERS.contains(&placeholder) {
            return Err(FormatInvalid::LetterInBingo90(placeholder.to_string()));
        }
        return Err(FormatInvalid::UnknownPlaceholder(
            placeholder.to_string(),
            allowed.join(", "),
        ));
    }
    let has_any = |group: &[&str]| group.iter().any(|p| format.contains(p));
    match slot.part {
        AudioPart::Word if !has_any(&NUMBER_PLACEHOLDERS) => Err(FormatInvalid::NoNumber),
        AudioPart::Digit if !has_any(&FIRST_PLACEHOLDERS) || !has_any(&SECOND_PLACEHOLDERS) => {
            Err(FormatInvalid::NoDigits)
        }
        _ => Ok(()),
    }
}

/// Every `{…}` in `format`, braces included.
fn placeholders(format: &str) -> impl Iterator<Item = &str> {
    format.match_indices('{').filter_map(move |(start, _)| {
        format[start..]
            .find('}')
            .map(|end| &format[start..=start + end])
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const ES: Language = Language::Spanish;

    fn word(mode: BingoMode) -> FormatSlot {
        FormatSlot::new(ES, AudioPart::Word, mode)
    }

    fn digit() -> FormatSlot {
        FormatSlot::new(ES, AudioPart::Digit, BingoMode::Bingo75)
    }

    #[test]
    fn a_word_format_with_the_number_is_valid() {
        assert_eq!(
            validate_format("¡{LETTER} {NUM}!", word(BingoMode::Bingo75)),
            Ok(())
        );
        assert_eq!(validate_format("{Num}.", word(BingoMode::Bingo90)), Ok(()));
        assert_eq!(validate_format("¡{#}!", word(BingoMode::Bingo90)), Ok(()));
    }

    #[test]
    fn a_word_format_needs_the_number() {
        assert_eq!(
            validate_format("{letter}!", word(BingoMode::Bingo75)),
            Err(FormatInvalid::NoNumber)
        );
    }

    #[test]
    fn bingo_90_has_no_letter() {
        assert_eq!(
            validate_format("{Letter} {num}", word(BingoMode::Bingo90)),
            Err(FormatInvalid::LetterInBingo90("{Letter}".into()))
        );
    }

    #[test]
    fn an_unknown_placeholder_is_refused() {
        assert!(matches!(
            validate_format("¡{num_word}!", word(BingoMode::Bingo90)),
            Err(FormatInvalid::UnknownPlaceholder(p, _)) if p == "{num_word}"
        ));
    }

    #[test]
    fn a_digit_format_needs_both_digits() {
        assert_eq!(validate_format("{FIRST}… {#2}", digit()), Ok(()));
        assert_eq!(
            validate_format("{first}", digit()),
            Err(FormatInvalid::NoDigits)
        );
    }

    #[test]
    fn word_and_digit_placeholders_do_not_mix() {
        assert!(matches!(
            validate_format("{num}", digit()),
            Err(FormatInvalid::UnknownPlaceholder(..))
        ));
        assert!(matches!(
            validate_format("{#} {#1}", word(BingoMode::Bingo90)),
            Err(FormatInvalid::UnknownPlaceholder(..))
        ));
    }

    #[test]
    fn a_digit_slot_has_no_bingo_mode() {
        assert_eq!(digit().bingo_mode, None);
        assert_eq!(
            word(BingoMode::Bingo75).bingo_mode,
            Some(BingoMode::Bingo75)
        );
    }
}
