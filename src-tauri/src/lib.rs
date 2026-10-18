mod commands;
mod models;
mod services;

use commands::*;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

// Platform detection types
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: String,
    pub os_version: String,
    pub has_vibrancy: bool,
    pub vibrancy_type: String,
}

#[tauri::command]
fn get_platform_info() -> PlatformInfo {
    #[cfg(target_os = "macos")]
    {
        PlatformInfo {
            os: "macos".to_string(),
            os_version: std::env::consts::OS.to_string(),
            has_vibrancy: true,
            vibrancy_type: "vibrancy".to_string(),
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Check Windows version to determine effect type
        // Windows 11 (build 22000+) supports Mica, Windows 10 uses Acrylic
        let os_version = std::env::consts::OS.to_string();
        PlatformInfo {
            os: "windows".to_string(),
            os_version,
            has_vibrancy: true,
            vibrancy_type: "mica".to_string(), // Will fallback to acrylic in setup
        }
    }

    #[cfg(target_os = "linux")]
    {
        PlatformInfo {
            os: "linux".to_string(),
            os_version: std::env::consts::OS.to_string(),
            has_vibrancy: false,
            vibrancy_type: "none".to_string(),
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        PlatformInfo {
            os: std::env::consts::OS.to_string(),
            os_version: "unknown".to_string(),
            has_vibrancy: false,
            vibrancy_type: "none".to_string(),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(
            // Writes to stdout and to ~/Library/Logs/com.wombatapps.bingovoicegenerator/
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some("bingo-voice-generator".to_string()),
                    }),
                ])
                .level(log::LevelFilter::Info)
                .level_for("bingo_voice_generator_tauri_lib", log::LevelFilter::Debug)
                .max_file_size(5_000_000)
                .rotation_strategy(RotationStrategy::KeepSome(3))
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init());

    // Add updater plugin only on desktop
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .manage(services::app_dirs::AppDirs::from_system())
        .invoke_handler(tauri::generate_handler![
            // ElevenLabs commands
            generate_speech,
            list_default_voices,
            search_shared_voices,
            get_subscription,
            add_shared_voice,
            // Storage commands
            save_audio_file,
            load_audio_files,
            delete_audio_file,
            delete_all_audio_files,
            voices_with_recordings,
            read_audio_file,
            get_voice_directory,
            // Voices commands
            load_voices,
            backfill_voice_kinds,
            create_voice,
            update_voice,
            delete_local_voice,
            // Account commands
            list_accounts,
            get_account_api_key,
            add_account,
            rename_account,
            delete_account,
            set_active_account,
            // Utility commands
            build_tts_text,
            get_accents,
            get_bingo_modes,
            // Platform detection
            get_platform_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Utility commands
use models::{Accent, AudioPart, BingoMode, TtsText};

#[derive(Debug, thiserror::Error)]
enum TtsTextError {
    #[error("Number {0} has no Digit: numbers below 10 only have a Word")]
    NoDigit(u32),
}

impl serde::Serialize for TtsTextError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[tauri::command]
fn build_tts_text(
    number: u32,
    accent: Accent,
    mode: BingoMode,
    part: AudioPart,
) -> Result<TtsText, TtsTextError> {
    log::debug!(
        "[build_tts_text] number={}, accent={:?}, mode={:?}, part={:?}",
        number,
        accent,
        mode,
        part
    );
    let text =
        models::build_tts_text(number, accent, mode, part).ok_or(TtsTextError::NoDigit(number))?;
    log::debug!("[build_tts_text] result: {:?}", text);
    Ok(text)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AccentInfo {
    id: String,
    display_name: String,
    flag: String,
    elevenlabs_code: String,
    elevenlabs_accent: String,
}

#[tauri::command]
fn get_accents() -> Vec<AccentInfo> {
    Accent::all()
        .into_iter()
        .map(|accent| AccentInfo {
            id: accent.raw_value().to_string(),
            display_name: accent.display_name().to_string(),
            flag: accent.flag().to_string(),
            elevenlabs_code: accent.elevenlabs_code().to_string(),
            elevenlabs_accent: accent.elevenlabs_accent().to_string(),
        })
        .collect()
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct BingoModeInfo {
    id: String,
    display_name: String,
    max_number: u32,
    grid_columns: u32,
}

#[tauri::command]
fn get_bingo_modes() -> Vec<BingoModeInfo> {
    vec![
        BingoModeInfo {
            id: "bingo90".to_string(),
            display_name: "Bingo 90".to_string(),
            max_number: 90,
            grid_columns: 10,
        },
        BingoModeInfo {
            id: "bingo75".to_string(),
            display_name: "Bingo 75".to_string(),
            max_number: 75,
            grid_columns: 5,
        },
    ]
}
