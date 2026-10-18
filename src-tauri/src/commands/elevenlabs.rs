use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

use crate::models::Language;
use crate::services::audio_trimmer::{trim_trailing_silence, TrimConfig};

const BASE_URL: &str = "https://api.elevenlabs.io/v1";

#[derive(Debug, Error)]
pub enum ElevenLabsError {
    #[error("No API key configured")]
    NoApiKey,
    #[error("API Error ({status_code}): {message}")]
    ApiError {
        status_code: u16,
        /// ElevenLabs' error code (`detail.code`, or the legacy `detail.status`), if any.
        api_code: Option<String>,
        /// ElevenLabs' message, never the raw body.
        message: String,
    },
    #[error("Network error: {0}")]
    NetworkError(reqwest::Error),
}

impl From<reqwest::Error> for ElevenLabsError {
    fn from(error: reqwest::Error) -> Self {
        log::error!("ElevenLabs network error: {}", error);
        ElevenLabsError::NetworkError(error)
    }
}

impl Serialize for ElevenLabsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(None)?;
        let code = match self {
            ElevenLabsError::NoApiKey => "NO_API_KEY",
            ElevenLabsError::ApiError { .. } => "API_ERROR",
            ElevenLabsError::NetworkError(_) => "NETWORK_ERROR",
        };
        map.serialize_entry("code", code)?;
        match self {
            ElevenLabsError::ApiError {
                status_code,
                api_code,
                message,
            } => {
                map.serialize_entry("status", status_code)?;
                map.serialize_entry("apiCode", api_code)?;
                map.serialize_entry("message", message)?;
            }
            _ => map.serialize_entry("message", &self.to_string())?,
        }
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

/// What the app reads from the body of a failed ElevenLabs response.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ErrorBody {
    /// ElevenLabs' error code, e.g. `paid_plan_required`.
    pub code: Option<String>,
    /// ElevenLabs' human-readable message.
    pub message: Option<String>,
}

/// Parses an ElevenLabs error body. See docs/elevenlabs-plans.md, section Errors.
fn parse_error_body(body: &str) -> ErrorBody {
    let Ok(json) = serde_json::from_str::<serde_json::Value>(body) else {
        return ErrorBody::default();
    };
    let detail = &json["detail"];
    // Validation errors (422): a list of `{loc, msg, type}`.
    if let Some(items) = detail.as_array() {
        let messages: Vec<&str> = items.iter().filter_map(|i| i["msg"].as_str()).collect();
        return ErrorBody {
            code: None,
            message: (!messages.is_empty()).then(|| messages.join("; ")),
        };
    }
    if let Some(message) = detail.as_str() {
        return ErrorBody {
            code: None,
            message: Some(message.to_string()),
        };
    }
    let text = |key: &str| detail[key].as_str().map(str::to_string);
    ErrorBody {
        // `detail.status` is the legacy code; in the current shape it repeats the type.
        code: text("code").or_else(|| text("status")),
        message: text("message"),
    }
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

/// Reads the body of a failed ElevenLabs response, logs it and turns it into an `ElevenLabsError`.
async fn api_error(
    command: &str,
    status: reqwest::StatusCode,
    response: reqwest::Response,
) -> ElevenLabsError {
    let error_text = response.text().await.unwrap_or_default();
    log::error!(
        "[{}] ElevenLabs API error ({}): {}",
        command,
        status,
        error_text
    );
    error_from_response(status, &error_text)
}

fn error_from_response(status: reqwest::StatusCode, body: &str) -> ElevenLabsError {
    let ErrorBody { code, message } = parse_error_body(body);
    ElevenLabsError::ApiError {
        status_code: status.as_u16(),
        api_code: code,
        message: message.unwrap_or_else(|| {
            status
                .canonical_reason()
                .unwrap_or("Unknown error")
                .to_string()
        }),
    }
}

/// Whether `error` says the key lacks a permission: a `401` with code `unauthorized`
/// ("missing the permission …"), or no code. `invalid_api_key` is a wrong key instead.
fn is_missing_permission(error: &ElevenLabsError) -> bool {
    match error {
        ElevenLabsError::ApiError {
            status_code: 401,
            api_code,
            ..
        } => matches!(api_code.as_deref(), None | Some("unauthorized")),
        _ => false,
    }
}

/// Checks `voices_read` with the cheapest voice listing (one Default Voice, no side effects).
/// Returns `false` only when the permission is missing: other failures are logged and ignored.
pub async fn has_voices_read(api_key: &str) -> bool {
    let url = "https://api.elevenlabs.io/v2/voices?page_size=1&voice_type=default";
    let result = async {
        let response = reqwest::Client::new()
            .get(url)
            .header("xi-api-key", api_key)
            .send()
            .await?;
        let status = response.status();
        if !status.is_success() {
            // A missing permission is an expected outcome here, so it is not logged as an error.
            let body = response.text().await.unwrap_or_default();
            return Err(error_from_response(status, &body));
        }
        Ok(())
    }
    .await;
    match result {
        Ok(()) => true,
        Err(e) if is_missing_permission(&e) => false,
        Err(e) => {
            log::warn!("[has_voices_read] Could not check voices_read: {}", e);
            true
        }
    }
}

// Tauri Commands

// Arguments map 1:1 to the `invoke()` payload in src/services/tauri.ts.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn generate_speech(
    text: String,
    previous_text: Option<String>,
    next_text: Option<String>,
    voice_id: String,
    language_code: String,
    api_key: String,
    model_id: String,
    output_format: Option<String>,
    speed: Option<f64>,
    stability: Option<f64>,
    similarity_boost: Option<f64>,
    style: Option<f64>,
    use_speaker_boost: Option<bool>,
) -> Result<Vec<u8>, ElevenLabsError> {
    log::info!(
        "[generate_speech] text={}, voice_id={}, language_code={}, model_id={}, output_format={:?}",
        text,
        voice_id,
        language_code,
        model_id,
        output_format
    );
    if api_key.is_empty() {
        log::error!("[generate_speech] No API key");
        return Err(ElevenLabsError::NoApiKey);
    }

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

    log::debug!("[generate_speech] voice_settings: stability={}, similarity_boost={}, style={}, use_speaker_boost={}",
        voice_settings.stability, voice_settings.similarity_boost, voice_settings.style, voice_settings.use_speaker_boost);

    let url = format!(
        "{}/text-to-speech/{}?output_format={}",
        BASE_URL, voice_id, format
    );

    let client = reqwest::Client::new();

    let mut request_body = serde_json::json!({
        "text": text,
        "model_id": model_id,
        "voice_settings": voice_settings,
        "language_code": language_code,
        "speed": speech_speed,
    });
    // Eleven v3 does not support context (request stitching), so it gets the bare text.
    if model_id != "eleven_v3" {
        request_body["previous_text"] = serde_json::json!(previous_text);
        request_body["next_text"] = serde_json::json!(next_text);
    }
    log::debug!(
        "[generate_speech] previous_text={:?}, next_text={:?}",
        request_body["previous_text"],
        request_body["next_text"]
    );

    log::debug!("[generate_speech] Sending request to ElevenLabs...");
    let response = client
        .post(&url)
        .header("xi-api-key", &api_key)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await?;

    let status = response.status();
    log::debug!("[generate_speech] Response status: {}", status);

    if !status.is_success() {
        return Err(api_error("generate_speech", status, response).await);
    }

    let bytes = response.bytes().await?;
    let raw_bytes = bytes.to_vec();
    log::debug!(
        "[generate_speech] Received {} bytes from API",
        raw_bytes.len()
    );

    // Apply silence trimming with timeout to prevent hanging
    // Run blocking trimming on a dedicated thread pool with 10 second timeout
    let config = TrimConfig::default();
    let raw_bytes_for_trim = raw_bytes.clone();
    let trim_result = tokio::time::timeout(
        Duration::from_secs(10),
        tokio::task::spawn_blocking(move || trim_trailing_silence(raw_bytes_for_trim, &config)),
    )
    .await;

    let trimmed_bytes = match trim_result {
        Ok(Ok(Ok(trimmed))) => {
            log::debug!(
                "[generate_speech] Trimmed: {} -> {} bytes",
                raw_bytes.len(),
                trimmed.len()
            );
            trimmed
        }
        Ok(Ok(Err(e))) => {
            log::warn!("[generate_speech] Trim failed, using original: {}", e);
            raw_bytes // Graceful fallback
        }
        Ok(Err(e)) => {
            log::warn!(
                "[generate_speech] Trim task panicked, using original: {}",
                e
            );
            raw_bytes // Graceful fallback
        }
        Err(_) => {
            log::warn!("[generate_speech] Trim timed out after 10s, using original");
            raw_bytes // Graceful fallback on timeout
        }
    };

    log::info!("[generate_speech] Success: {} bytes", trimmed_bytes.len());
    Ok(trimmed_bytes)
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
        return Err(api_error("list_premade_voices", status, response).await);
    }

    let voices_response: VoicesResponse = response.json().await?;
    log::debug!(
        "[list_premade_voices] Found {} premade voices",
        voices_response.voices.len()
    );
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
        return Err(api_error("search_shared_voices", status, response).await);
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
        return Err(api_error("get_subscription", status, response).await);
    }

    let subscription: SubscriptionInfo = response.json().await?;
    Ok(subscription)
}

#[tauri::command]
pub async fn add_shared_voice(
    public_owner_id: String,
    voice_id: String,
    new_name: String,
    api_key: String,
) -> Result<String, ElevenLabsError> {
    log::debug!(
        "[add_shared_voice] Adding voice {} from owner {} with name: {}",
        voice_id,
        public_owner_id,
        new_name
    );
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
    log::debug!("[add_shared_voice] Response status: {}", status);

    if !status.is_success() {
        return Err(api_error("add_shared_voice", status, response).await);
    }

    let add_response: AddSharedVoiceResponse = response.json().await?;
    log::info!(
        "[add_shared_voice] Success - new voice_id: {}",
        add_response.voice_id
    );
    Ok(add_response.voice_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_code_and_message_from_current_shape() {
        let body = r#"{"detail":{"type":"payment_required","code":"paid_plan_required","message":"Free users cannot use library voices via the API.","status":"payment_required","request_id":"abc"}}"#;

        let parsed = parse_error_body(body);

        assert_eq!(parsed.code.as_deref(), Some("paid_plan_required"));
        assert_eq!(
            parsed.message.as_deref(),
            Some("Free users cannot use library voices via the API.")
        );
    }

    #[test]
    fn falls_back_to_status_in_legacy_shape() {
        let body = r#"{"detail":{"status":"voice_limit_reached","message":"You have reached your maximum amount of custom voices."}}"#;

        let parsed = parse_error_body(body);

        assert_eq!(parsed.code.as_deref(), Some("voice_limit_reached"));
        assert_eq!(
            parsed.message.as_deref(),
            Some("You have reached your maximum amount of custom voices.")
        );
    }

    #[test]
    fn joins_messages_from_validation_list_shape() {
        let body = r#"{"detail":[{"loc":["body","text"],"msg":"field required","type":"value_error.missing"},{"loc":["body","model_id"],"msg":"invalid model","type":"value_error"}]}"#;

        let parsed = parse_error_body(body);

        assert_eq!(parsed.code, None);
        assert_eq!(
            parsed.message.as_deref(),
            Some("field required; invalid model")
        );
    }

    #[test]
    fn reads_message_from_string_detail() {
        let parsed = parse_error_body(r#"{"detail":"Not Found"}"#);

        assert_eq!(parsed.code, None);
        assert_eq!(parsed.message.as_deref(), Some("Not Found"));
    }

    #[test]
    fn uses_http_reason_when_body_is_not_json() {
        let error = error_from_response(
            reqwest::StatusCode::BAD_GATEWAY,
            "<html><body>502 Bad Gateway</body></html>",
        );

        assert!(matches!(
            error,
            ElevenLabsError::ApiError { status_code: 502, api_code: None, ref message } if message == "Bad Gateway"
        ));
    }

    #[test]
    fn voice_limit_reached_code_is_a_plain_api_error() {
        let body = r#"{"detail":{"status":"voice_limit_reached","message":"Limit reached"}}"#;

        let error = error_from_response(reqwest::StatusCode::BAD_REQUEST, body);

        assert!(matches!(
            error,
            ElevenLabsError::ApiError { status_code: 400, api_code: Some(ref code), ref message }
                if code == "voice_limit_reached" && message == "Limit reached"
        ));
    }

    #[test]
    fn unauthorized_probe_means_missing_permission() {
        let body = r#"{"detail":{"type":"authentication_error","code":"unauthorized","message":"The API key you used is missing the permission voices_read to execute this operation.","status":"authentication_error"}}"#;

        let error = error_from_response(reqwest::StatusCode::UNAUTHORIZED, body);

        assert!(is_missing_permission(&error));
    }

    #[test]
    fn other_probe_failures_are_not_missing_permission() {
        let busy = error_from_response(
            reqwest::StatusCode::SERVICE_UNAVAILABLE,
            r#"{"detail":{"code":"service_unavailable","message":"Down"}}"#,
        );
        let rate_limited = error_from_response(
            reqwest::StatusCode::TOO_MANY_REQUESTS,
            r#"{"detail":{"code":"rate_limit_exceeded","message":"Slow down"}}"#,
        );

        let wrong_key = error_from_response(
            reqwest::StatusCode::UNAUTHORIZED,
            r#"{"detail":{"code":"invalid_api_key","message":"Invalid API key"}}"#,
        );

        assert!(!is_missing_permission(&busy));
        assert!(!is_missing_permission(&wrong_key));
        assert!(!is_missing_permission(&rate_limited));
        assert!(!is_missing_permission(&ElevenLabsError::NoApiKey));
    }
}
