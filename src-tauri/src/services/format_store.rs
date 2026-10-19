use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::fs;
use uuid::Uuid;

use crate::models::{
    default_format, format_placeholders, validate_format, AudioPart, BingoMode, FormatInvalid,
    FormatSlot, Language, PartFormat, SelectedFormats,
};

#[derive(Debug, Error)]
pub enum FormatError {
    #[error(transparent)]
    Invalid(#[from] FormatInvalid),
    #[error("Format not found: {0}")]
    NotFound(Uuid),
    #[error("Could not read or save the formats: {0}")]
    Io(#[from] std::io::Error),
    #[error("Could not read or save the formats: {0}")]
    Json(#[from] serde_json::Error),
}

/// `{code: "FORMAT_ERROR", message}`, like the other command errors.
impl Serialize for FormatError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("code", "FORMAT_ERROR")?;
        map.serialize_entry("message", &self.to_string())?;
        map.end()
    }
}

/// The formats of one slot: the user's, the Default one's text, the placeholders it can use,
/// and the one selected (`None` for the Default one).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Formats {
    pub formats: Vec<PartFormat>,
    pub default_format: String,
    pub placeholders: Vec<&'static str>,
    pub selected_id: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Selection {
    #[serde(flatten)]
    slot: FormatSlot,
    id: Uuid,
}

/// What `formats.json` holds.
#[derive(Debug, Default, Serialize, Deserialize)]
struct FormatsFile {
    #[serde(default)]
    formats: Vec<PartFormat>,
    #[serde(default)]
    selected: Vec<Selection>,
}

impl FormatsFile {
    fn of(&self, slot: FormatSlot) -> Formats {
        Formats {
            formats: self
                .formats
                .iter()
                .filter(|f| f.slot == slot)
                .cloned()
                .collect(),
            default_format: default_format(slot),
            placeholders: format_placeholders(slot),
            selected_id: self.selected.iter().find(|s| s.slot == slot).map(|s| s.id),
        }
    }

    fn selected_format(&self, slot: FormatSlot) -> Option<String> {
        let formats = self.of(slot);
        let id = formats.selected_id?;
        formats
            .formats
            .into_iter()
            .find(|f| f.id == id)
            .map(|f| f.format)
    }

    fn select(&mut self, slot: FormatSlot, id: Option<Uuid>) {
        self.selected.retain(|s| s.slot != slot);
        if let Some(id) = id {
            self.selected.push(Selection { slot, id });
        }
    }
}

/// The user's Word Formats and Digit Formats, and which one each slot uses, in
/// `formats.json`.
#[derive(Debug, Clone)]
pub struct FormatStore {
    path: PathBuf,
}

impl FormatStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    pub async fn list(&self, slot: FormatSlot) -> Result<Formats, FormatError> {
        Ok(self.read().await?.of(slot))
    }

    /// The text of the formats selected for `language`.
    pub async fn selected_formats(
        &self,
        language: Language,
    ) -> Result<SelectedFormats, FormatError> {
        let file = self.read().await?;
        let word = |mode| file.selected_format(FormatSlot::new(language, AudioPart::Word, mode));
        Ok(SelectedFormats {
            word_90: word(BingoMode::Bingo90),
            word_75: word(BingoMode::Bingo75),
            digit: file.selected_format(FormatSlot::new(
                language,
                AudioPart::Digit,
                BingoMode::Bingo90,
            )),
        })
    }

    /// Adds a format, or changes the one with `id`, and selects it.
    pub async fn save(
        &self,
        slot: FormatSlot,
        id: Option<Uuid>,
        format: &str,
    ) -> Result<Formats, FormatError> {
        let format = format.trim();
        validate_format(format, slot)?;
        let mut file = self.read().await?;
        let taken = format == default_format(slot)
            || file
                .of(slot)
                .formats
                .iter()
                .any(|f| f.format == format && Some(f.id) != id);
        if taken {
            return Err(FormatInvalid::Duplicate.into());
        }
        let id = match id {
            Some(id) => {
                let existing = file
                    .formats
                    .iter_mut()
                    .find(|f| f.id == id && f.slot == slot)
                    .ok_or(FormatError::NotFound(id))?;
                existing.format = format.to_string();
                id
            }
            None => {
                let id = Uuid::new_v4();
                file.formats.push(PartFormat {
                    id,
                    slot,
                    format: format.to_string(),
                });
                id
            }
        };
        file.select(slot, Some(id));
        self.write(&file).await?;
        Ok(file.of(slot))
    }

    /// Deletes a format; if it was selected, the Default one is selected instead.
    pub async fn delete(&self, slot: FormatSlot, id: Uuid) -> Result<Formats, FormatError> {
        let mut file = self.read().await?;
        file.formats.retain(|f| f.id != id);
        file.selected.retain(|s| s.id != id);
        self.write(&file).await?;
        Ok(file.of(slot))
    }

    /// Selects a format, or the Default one with `None`.
    pub async fn select(&self, slot: FormatSlot, id: Option<Uuid>) -> Result<Formats, FormatError> {
        let mut file = self.read().await?;
        if let Some(id) = id {
            if !file.of(slot).formats.iter().any(|f| f.id == id) {
                return Err(FormatError::NotFound(id));
            }
        }
        file.select(slot, id);
        self.write(&file).await?;
        Ok(file.of(slot))
    }

    async fn read(&self) -> Result<FormatsFile, FormatError> {
        if !self.path.exists() {
            return Ok(FormatsFile::default());
        }
        let content = fs::read_to_string(&self.path).await?;
        Ok(serde_json::from_str(&content)?)
    }

    async fn write(&self, file: &FormatsFile) -> Result<(), FormatError> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::write(&self.path, serde_json::to_string_pretty(file)?).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> (tempfile::TempDir, FormatStore) {
        let dir = tempfile::tempdir().unwrap();
        let store = FormatStore::new(dir.path().join("formats.json"));
        (dir, store)
    }

    const ES: Language = Language::Spanish;

    fn word(mode: BingoMode) -> FormatSlot {
        FormatSlot::new(ES, AudioPart::Word, mode)
    }

    fn word_75() -> FormatSlot {
        word(BingoMode::Bingo75)
    }

    fn digit() -> FormatSlot {
        FormatSlot::new(ES, AudioPart::Digit, BingoMode::Bingo90)
    }

    #[tokio::test]
    async fn without_formats_the_default_ones_are_selected() {
        let (_dir, store) = store();

        let formats = store.list(word_75()).await.unwrap();

        assert!(formats.formats.is_empty());
        assert_eq!(formats.selected_id, None);
        assert_eq!(formats.default_format, default_format(word_75()));
        assert_eq!(
            store.selected_formats(ES).await.unwrap(),
            SelectedFormats::default()
        );
    }

    #[tokio::test]
    async fn a_saved_format_is_selected_and_used() {
        let (_dir, store) = store();

        let formats = store
            .save(word_75(), None, "¡{LETTER} {NUM}!")
            .await
            .unwrap();

        assert_eq!(formats.formats.len(), 1);
        assert_eq!(formats.selected_id, Some(formats.formats[0].id));
        assert_eq!(
            store.selected_formats(ES).await.unwrap().word_75.as_deref(),
            Some("¡{LETTER} {NUM}!")
        );
    }

    #[tokio::test]
    async fn each_slot_has_its_own_formats_and_selection() {
        let (_dir, store) = store();
        store.save(word_75(), None, "{NUM}").await.unwrap();
        store.save(digit(), None, "{#1} {#2}").await.unwrap();

        assert!(store
            .list(word(BingoMode::Bingo90))
            .await
            .unwrap()
            .formats
            .is_empty());
        assert!(store
            .list(FormatSlot::new(
                Language::English,
                AudioPart::Word,
                BingoMode::Bingo75
            ))
            .await
            .unwrap()
            .formats
            .is_empty());
        assert_eq!(
            store.selected_formats(ES).await.unwrap(),
            SelectedFormats {
                word_90: None,
                word_75: Some("{NUM}".into()),
                digit: Some("{#1} {#2}".into()),
            }
        );
    }

    #[tokio::test]
    async fn a_digit_format_serves_every_bingo_mode() {
        let (_dir, store) = store();
        store.save(digit(), None, "{#1} {#2}").await.unwrap();

        let from_75 = FormatSlot::new(ES, AudioPart::Digit, BingoMode::Bingo75);

        assert_eq!(store.list(from_75).await.unwrap().formats.len(), 1);
    }

    #[tokio::test]
    async fn editing_a_format_keeps_its_id() {
        let (_dir, store) = store();
        let id = store.save(word_75(), None, "{num}").await.unwrap().formats[0].id;

        let formats = store.save(word_75(), Some(id), "{Num}!").await.unwrap();

        assert_eq!(formats.formats.len(), 1);
        assert_eq!(formats.formats[0].id, id);
        assert_eq!(formats.formats[0].format, "{Num}!");
    }

    #[tokio::test]
    async fn a_format_cannot_repeat_another_or_the_default_one() {
        let (_dir, store) = store();
        store.save(word_75(), None, "{num}").await.unwrap();

        let repeated = store.save(word_75(), None, "{num}").await;
        let default = store
            .save(word_75(), None, &default_format(word_75()))
            .await;

        assert!(matches!(
            repeated,
            Err(FormatError::Invalid(FormatInvalid::Duplicate))
        ));
        assert!(matches!(
            default,
            Err(FormatError::Invalid(FormatInvalid::Duplicate))
        ));
    }

    #[tokio::test]
    async fn deleting_the_selected_format_selects_the_default_one() {
        let (_dir, store) = store();
        let id = store.save(word_75(), None, "{num}").await.unwrap().formats[0].id;

        let formats = store.delete(word_75(), id).await.unwrap();

        assert!(formats.formats.is_empty());
        assert_eq!(formats.selected_id, None);
    }

    #[tokio::test]
    async fn the_default_format_can_be_selected_again() {
        let (_dir, store) = store();
        store.save(word_75(), None, "{num}").await.unwrap();

        let formats = store.select(word_75(), None).await.unwrap();

        assert_eq!(formats.selected_id, None);
        assert_eq!(formats.formats.len(), 1);
        assert_eq!(store.selected_formats(ES).await.unwrap().word_75, None);
    }

    #[tokio::test]
    async fn an_invalid_format_is_not_saved() {
        let (_dir, store) = store();

        let result = store
            .save(word(BingoMode::Bingo90), None, "{letter} {num}")
            .await;

        assert!(matches!(result, Err(FormatError::Invalid(_))));
        assert!(!store.path.exists());
    }
}
