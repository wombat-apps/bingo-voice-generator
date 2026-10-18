use serde::{Deserialize, Serialize};
use thiserror::Error;
use std::time::Duration;

use crate::models::Language;
use crate::services::audio_trimmer::{trim_trailing_silence, TrimConfig};

const BASE_URL: &str = "https://api.elevenlabs.io/v1";

#[derive(Debug, Error)]
pub enum ElevenLabsError {
    #[error("No API key configured")]
    NoApiKey,
    #[error("API Error ({status_code}): {message}")]
    ApiError { status_code: u16, message: String },
    #[error("Voice limit reached")]
    VoiceLimitReached,
    #[error("Network error: {0}")]
    NetworkError(#[from] reqwest::Error),
}

impl Serialize for ElevenLabsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(2))?;
        let code = match self {
            ElevenLabsError::NoApiKey => "NO_API_KEY",
            ElevenLabsError::ApiError { .. } => "API_ERROR",
            ElevenLabsError::VoiceLimitReached => "VOICE_LIMIT_REACHED",
            ElevenLabsError::NetworkError(_) => "NETWORK_ERROR",
        };
        map.serialize_entry("code", code)?;
        map.serialize_entry("message", &self.to_string())?;
        map.end()
    }
}

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
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicesResponse {
    pub voices: Vec<ElevenLabsVoice>,
    pub has_more: Option<bool>,
    pub total_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElevenLabsErrorDetail {
    pub status: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElevenLabsErrorResponse {
    pub detail: Option<ElevenLabsErrorDetail>,
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
    #[serde(rename(deserialize = "free_users_allowed"))]
    pub free_users_allowed: Option<bool>,
    #[serde(rename(deserialize = "public_owner_id"))]
    pub public_owner_id: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSettings {
    pub stability: f64,
    pub similarity_boost: f64,
    pub style: f64,
    pub use_speaker_boost: bool,
}

impl Default for VoiceSettings {
    fn default() -> Self {
        Self {
            stability: 0.5,
            similarity_boost: 0.85,
            style: 0.9,
            use_speaker_boost: true,
        }
    }
}

// Tauri Commands

#[tauri::command]
pub async fn generate_speech(
    text: String,
    voice_id: String,
    language_code: String,
    api_key: String,
    model_id: Option<String>,
    output_format: Option<String>,
    speed: Option<f64>,
    stability: Option<f64>,
    similarity_boost: Option<f64>,
    style: Option<f64>,
    use_speaker_boost: Option<bool>,
) -> Result<Vec<u8>, ElevenLabsError> {
    println!("[generate_speech] text={}, voice_id={}, language_code={}", text, voice_id, language_code);
    if api_key.is_empty() {
        println!("[generate_speech] ERROR: No API key");
        return Err(ElevenLabsError::NoApiKey);
    }

    let model = model_id.unwrap_or_else(|| "eleven_turbo_v2_5".to_string());
    let format = output_format.unwrap_or_else(|| "mp3_44100_128".to_string());
    let speech_speed = speed.unwrap_or(1.0);

    // Build voice settings from optional params or use defaults
    let default_settings = VoiceSettings::default();
    let voice_settings = VoiceSettings {
        stability: stability.unwrap_or(default_settings.stability),
        similarity_boost: similarity_boost.unwrap_or(default_settings.similarity_boost),
        style: style.unwrap_or(default_settings.style),
        use_speaker_boost: use_speaker_boost.unwrap_or(default_settings.use_speaker_boost),
    };

    println!("[generate_speech] voice_settings: stability={}, similarity_boost={}, style={}, use_speaker_boost={}",
        voice_settings.stability, voice_settings.similarity_boost, voice_settings.style, voice_settings.use_speaker_boost);

    let url = format!(
        "{}/text-to-speech/{}?output_format={}",
        BASE_URL, voice_id, format
    );

    let client = reqwest::Client::new();

    let request_body = serde_json::json!({
        "text": text,
        "model_id": model,
        "voice_settings": voice_settings,
        "language_code": language_code,
        "speed": speech_speed,
    });

    println!("[generate_speech] Sending request to ElevenLabs...");
    let response = client
        .post(&url)
        .header("xi-api-key", &api_key)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await?;

    let status = response.status();
    println!("[generate_speech] Response status: {}", status);

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        println!("[generate_speech] ERROR: {}", error_text);

        // Check for voice_limit_reached error
        if let Ok(error_response) = serde_json::from_str::<ElevenLabsErrorResponse>(&error_text) {
            if let Some(detail) = error_response.detail {
                if detail.status.as_deref() == Some("voice_limit_reached") {
                    return Err(ElevenLabsError::VoiceLimitReached);
                }
            }
        }

        return Err(ElevenLabsError::ApiError {
            status_code: status.as_u16(),
            message: error_text,
        });
    }

    let bytes = response.bytes().await?;
    let raw_bytes = bytes.to_vec();
    println!("[generate_speech] Received {} bytes from API", raw_bytes.len());

    // Apply silence trimming with timeout to prevent hanging
    // Run blocking trimming on a dedicated thread pool with 10 second timeout
    let config = TrimConfig::default();
    let raw_bytes_for_trim = raw_bytes.clone();
    let trim_result = tokio::time::timeout(
        Duration::from_secs(10),
        tokio::task::spawn_blocking(move || {
            trim_trailing_silence(raw_bytes_for_trim, &config)
        })
    ).await;

    let trimmed_bytes = match trim_result {
        Ok(Ok(Ok(trimmed))) => {
            println!(
                "[generate_speech] Trimmed: {} -> {} bytes",
                raw_bytes.len(),
                trimmed.len()
            );
            trimmed
        }
        Ok(Ok(Err(e))) => {
            println!(
                "[generate_speech] WARN: Trim failed, using original: {}",
                e
            );
            raw_bytes // Graceful fallback
        }
        Ok(Err(e)) => {
            println!(
                "[generate_speech] WARN: Trim task panicked, using original: {}",
                e
            );
            raw_bytes // Graceful fallback
        }
        Err(_) => {
            println!(
                "[generate_speech] WARN: Trim timed out after 10s, using original"
            );
            raw_bytes // Graceful fallback on timeout
        }
    };

    println!("[generate_speech] SUCCESS: {} bytes", trimmed_bytes.len());
    Ok(trimmed_bytes)
}

#[tauri::command]
pub async fn list_voices(api_key: String) -> Result<Vec<ElevenLabsVoice>, ElevenLabsError> {
    if api_key.is_empty() {
        return Err(ElevenLabsError::NoApiKey);
    }

    let url = "https://api.elevenlabs.io/v2/voices?page_size=100&voice_type=saved".to_string();

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("xi-api-key", &api_key)
        .send()
        .await?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(ElevenLabsError::ApiError {
            status_code: status.as_u16(),
            message: error_text,
        });
    }

    let response_text = response.text().await?;
    println!("[list_voices] Raw response (first 2000 chars): {}", &response_text[..response_text.len().min(2000)]);

    let voices_response: VoicesResponse = serde_json::from_str(&response_text)
        .map_err(|e| ElevenLabsError::ApiError {
            status_code: 500,
            message: format!("JSON parse error: {}", e)
        })?;
    println!("[list_voices] Found {} voices:", voices_response.voices.len());
    let mut premade_count = 0;
    let mut custom_count = 0;
    for voice in &voices_response.voices {
        if voice.category == "premade" {
            premade_count += 1;
        } else {
            custom_count += 1;
        }
        println!("  - {} (id: {}, category: {}, created_at: {:?})",
            voice.name, voice.voice_id, voice.category, voice.created_at_unix);
    }
    println!("[list_voices] Summary: {} premade, {} custom/professional", premade_count, custom_count);
    Ok(voices_response.voices)
}

#[tauri::command]
pub async fn list_premade_voices(api_key: String) -> Result<Vec<ElevenLabsVoice>, ElevenLabsError> {
    if api_key.is_empty() {
        return Err(ElevenLabsError::NoApiKey);
    }

    let url = "https://api.elevenlabs.io/v2/voices?page_size=100&voice_type=default".to_string();

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("xi-api-key", &api_key)
        .send()
        .await?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(ElevenLabsError::ApiError {
            status_code: status.as_u16(),
            message: error_text,
        });
    }

    let voices_response: VoicesResponse = response.json().await?;
    println!("[list_premade_voices] Found {} premade voices", voices_response.voices.len());
    Ok(voices_response.voices)
}

#[tauri::command]
pub async fn search_shared_voices(
    language: Language,
    api_key: String,
    gender: Option<String>,
    search: Option<String>,
    page_size: Option<u32>,
) -> Result<SharedVoicesResponse, ElevenLabsError> {
    if api_key.is_empty() {
        return Err(ElevenLabsError::NoApiKey);
    }

    let mut url = format!(
        "{}/shared-voices?language={}&accent={}&page_size={}",
        BASE_URL,
        language.elevenlabs_code(),
        language.elevenlabs_accent(),
        page_size.unwrap_or(20)
    );

    if let Some(g) = gender {
        if !g.is_empty() {
            url.push_str(&format!("&gender={}", g));
        }
    }

    if let Some(s) = search {
        if !s.is_empty() {
            url.push_str(&format!("&search={}", urlencoding::encode(&s)));
        }
    }

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("xi-api-key", &api_key)
        .send()
        .await?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(ElevenLabsError::ApiError {
            status_code: status.as_u16(),
            message: error_text,
        });
    }

    let shared_voices: SharedVoicesResponse = response.json().await?;
    Ok(shared_voices)
}

#[tauri::command]
pub async fn get_subscription(api_key: String) -> Result<SubscriptionInfo, ElevenLabsError> {
    if api_key.is_empty() {
        return Err(ElevenLabsError::NoApiKey);
    }

    let url = format!("{}/user/subscription", BASE_URL);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("xi-api-key", &api_key)
        .send()
        .await?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(ElevenLabsError::ApiError {
            status_code: status.as_u16(),
            message: error_text,
        });
    }

    let subscription: SubscriptionInfo = response.json().await?;
    Ok(subscription)
}

#[tauri::command]
pub async fn delete_voice(voice_id: String, api_key: String) -> Result<(), ElevenLabsError> {
    println!("[delete_voice] Deleting voice: {}", voice_id);
    if api_key.is_empty() {
        return Err(ElevenLabsError::NoApiKey);
    }

    let url = format!("{}/voices/{}", BASE_URL, voice_id);

    let client = reqwest::Client::new();
    let response = client
        .delete(&url)
        .header("xi-api-key", &api_key)
        .send()
        .await?;

    let status = response.status();
    println!("[delete_voice] Response status: {}", status);

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        println!("[delete_voice] ERROR: {}", error_text);
        return Err(ElevenLabsError::ApiError {
            status_code: status.as_u16(),
            message: error_text,
        });
    }

    println!("[delete_voice] SUCCESS");
    Ok(())
}

#[tauri::command]
pub async fn add_shared_voice(
    public_owner_id: String,
    voice_id: String,
    new_name: String,
    api_key: String,
) -> Result<String, ElevenLabsError> {
    println!("[add_shared_voice] Adding voice {} from owner {} with name: {}", voice_id, public_owner_id, new_name);
    if api_key.is_empty() {
        return Err(ElevenLabsError::NoApiKey);
    }

    let url = format!("{}/voices/add/{}/{}", BASE_URL, public_owner_id, voice_id);

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("xi-api-key", &api_key)
        .json(&serde_json::json!({ "new_name": new_name }))
        .send()
        .await?;

    let status = response.status();
    println!("[add_shared_voice] Response status: {}", status);

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        println!("[add_shared_voice] ERROR: {}", error_text);
        return Err(ElevenLabsError::ApiError {
            status_code: status.as_u16(),
            message: error_text,
        });
    }

    let add_response: AddSharedVoiceResponse = response.json().await?;
    println!("[add_shared_voice] SUCCESS - new voice_id: {}", add_response.voice_id);
    Ok(add_response.voice_id)
}
