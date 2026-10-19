use tauri::State;
use uuid::Uuid;

use crate::models::{build_part_text, validate_format, Accent, AudioPart, BingoMode, FormatSlot};
use crate::services::app_dirs::AppDirs;
use crate::services::format_store::{FormatError, Formats};

// Word Formats and Digit Formats belong to a Language; the UI knows the Accent, which
// belongs to one. `mode` is the Word's Bingo Mode, and is ignored for the Digit.

fn slot(accent: Accent, part: AudioPart, mode: BingoMode) -> FormatSlot {
    FormatSlot::new(accent.language(), part, mode)
}

#[tauri::command]
pub async fn list_formats(
    dirs: State<'_, AppDirs>,
    accent: Accent,
    part: AudioPart,
    mode: BingoMode,
) -> Result<Formats, FormatError> {
    dirs.format_store().list(slot(accent, part, mode)).await
}

/// Adds a format, or changes the one with `id`, and selects it.
#[tauri::command]
pub async fn save_format(
    dirs: State<'_, AppDirs>,
    accent: Accent,
    part: AudioPart,
    mode: BingoMode,
    id: Option<Uuid>,
    format: String,
) -> Result<Formats, FormatError> {
    dirs.format_store()
        .save(slot(accent, part, mode), id, &format)
        .await
}

#[tauri::command]
pub async fn delete_format(
    dirs: State<'_, AppDirs>,
    accent: Accent,
    part: AudioPart,
    mode: BingoMode,
    id: Uuid,
) -> Result<Formats, FormatError> {
    dirs.format_store()
        .delete(slot(accent, part, mode), id)
        .await
}

/// Selects a format, or the Default one with `None`.
#[tauri::command]
pub async fn select_format(
    dirs: State<'_, AppDirs>,
    accent: Accent,
    part: AudioPart,
    mode: BingoMode,
    id: Option<Uuid>,
) -> Result<Formats, FormatError> {
    dirs.format_store()
        .select(slot(accent, part, mode), id)
        .await
}

/// The Word or the Digit of `number` written in `format`, or in the Default one when `None`,
/// as it would be sent to ElevenLabs. Fails as saving would for an invalid format.
#[tauri::command]
pub fn preview_format(
    accent: Accent,
    part: AudioPart,
    mode: BingoMode,
    number: u32,
    format: Option<String>,
) -> Result<String, FormatError> {
    if let Some(format) = &format {
        validate_format(format, slot(accent, part, mode))?;
    }
    Ok(build_part_text(
        number,
        accent,
        mode,
        part,
        format.as_deref(),
    ))
}
