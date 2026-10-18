use reqwest::{Method, RequestBuilder, Response, StatusCode};
use serde::{de::DeserializeOwned, Serialize};
use thiserror::Error;
use tokio::sync::Mutex;
use uuid::Uuid;

use super::types::{
    AddSharedVoiceResponse, ElevenLabsVoice, LibraryVoiceSort, SharedVoicesResponse,
    SubscriptionInfo, VoicesResponse,
};
use crate::models::{Accent, TtsText, VoiceSettings};
use crate::services::account_store::AccountsError;
use crate::services::app_dirs::AppDirs;

const BASE_URL: &str = "https://api.elevenlabs.io";

#[derive(Debug, Error)]
pub enum ElevenLabsError {
    #[error("No Active Account")]
    NoActiveAccount,
    #[error("Could not read the account's API key: {0}")]
    Account(String),
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

impl From<AccountsError> for ElevenLabsError {
    fn from(error: AccountsError) -> Self {
        ElevenLabsError::Account(error.to_string())
    }
}

/// Serializes to `{code, message}`, plus `status` and `apiCode` for `API_ERROR`, which
/// `src/services/errors.ts` reads.
impl Serialize for ElevenLabsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(None)?;
        let code = match self {
            ElevenLabsError::NoActiveAccount => "NO_ACTIVE_ACCOUNT",
            ElevenLabsError::Account(_) => "ACCOUNT_ERROR",
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

fn error_from_response(status: StatusCode, body: &str) -> ElevenLabsError {
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

/// Managed by Tauri: one HTTP client for the whole app, and the Active Account's key,
/// read from the Keychain only when the Active Account changes.
pub struct ElevenLabs {
    http: reqwest::Client,
    base_url: String,
    active_key: Mutex<Option<(Uuid, String)>>,
}

impl Default for ElevenLabs {
    fn default() -> Self {
        Self::new(BASE_URL)
    }
}

impl ElevenLabs {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url: base_url.into(),
            active_key: Mutex::new(None),
        }
    }

    /// A client for a key that may not be saved yet, such as one being added.
    pub fn client_for_key(&self, api_key: String) -> ElevenLabsClient {
        ElevenLabsClient {
            http: self.http.clone(),
            base_url: self.base_url.clone(),
            api_key,
        }
    }

    /// A client for any saved ElevenLabs Account.
    pub fn client_for_account(
        &self,
        dirs: &AppDirs,
        account_id: Uuid,
    ) -> Result<ElevenLabsClient, ElevenLabsError> {
        Ok(self.client_for_key(dirs.account_store().api_key(account_id)?))
    }

    /// A client for the Active Account, or `NoActiveAccount` when there is none.
    pub async fn active_client(&self, dirs: &AppDirs) -> Result<ElevenLabsClient, ElevenLabsError> {
        let store = dirs.account_store();
        let id = store
            .active_account_id()
            .await?
            .ok_or(ElevenLabsError::NoActiveAccount)?;
        let mut cached = self.active_key.lock().await;
        let key = match cached.as_ref() {
            Some((cached_id, key)) if *cached_id == id => key.clone(),
            _ => {
                let key = store.api_key(id)?;
                *cached = Some((id, key.clone()));
                key
            }
        };
        Ok(self.client_for_key(key))
    }

    /// Drops the cached key of a deleted account, so it does not outlive the account.
    pub async fn forget_account(&self, account_id: Uuid) {
        let mut cached = self.active_key.lock().await;
        if matches!(cached.as_ref(), Some((id, _)) if *id == account_id) {
            *cached = None;
        }
    }
}

/// One ElevenLabs API key's view of the API. Every request goes through `send`, which adds
/// the key, logs failures with their raw body and classifies them into `ElevenLabsError`.
pub struct ElevenLabsClient {
    http: reqwest::Client,
    base_url: String,
    api_key: String,
}

impl ElevenLabsClient {
    fn request(&self, method: Method, path: &str) -> RequestBuilder {
        self.http
            .request(method, format!("{}{}", self.base_url, path))
            .header("xi-api-key", &self.api_key)
    }

    async fn send(
        &self,
        label: &str,
        request: RequestBuilder,
    ) -> Result<Response, ElevenLabsError> {
        let response = request.send().await?;
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }
        let body = response.text().await.unwrap_or_default();
        log::error!("[{}] ElevenLabs API error ({}): {}", label, status, body);
        Err(error_from_response(status, &body))
    }

    async fn get_json<T: DeserializeOwned>(
        &self,
        label: &str,
        path: &str,
    ) -> Result<T, ElevenLabsError> {
        Ok(self
            .send(label, self.request(Method::GET, path))
            .await?
            .json()
            .await?)
    }

    /// The untrimmed MP3 for `tts`, said by `voice_id` in `language_code`.
    pub async fn text_to_speech(
        &self,
        voice_id: &str,
        language_code: &str,
        tts: &TtsText,
        settings: &VoiceSettings,
    ) -> Result<Vec<u8>, ElevenLabsError> {
        let body = speech_body(language_code, tts, settings);
        log::debug!("[text_to_speech] voice_id={}, body={}", voice_id, body);
        let path = format!(
            "/v1/text-to-speech/{}?output_format=mp3_44100_128",
            urlencoding::encode(voice_id)
        );
        let response = self
            .send(
                "text_to_speech",
                self.request(Method::POST, &path).json(&body),
            )
            .await?;
        let bytes = response.bytes().await?.to_vec();
        log::info!("[text_to_speech] Received {} bytes", bytes.len());
        Ok(bytes)
    }

    /// Every Default Voice, optionally only those of one gender.
    pub async fn default_voices(
        &self,
        gender: Option<&str>,
    ) -> Result<Vec<ElevenLabsVoice>, ElevenLabsError> {
        let mut path = "/v2/voices?page_size=100&voice_type=default".to_string();
        if let Some(g) = gender.filter(|g| !g.is_empty()) {
            path.push_str(&format!("&gender={}", urlencoding::encode(g)));
        }
        let response: VoicesResponse = self.get_json("default_voices", &path).await?;
        Ok(response.voices)
    }

    /// Library Voices in the Language of `accent`, under `accent_label` if given.
    pub async fn library_voices(
        &self,
        accent: Accent,
        accent_label: Option<&str>,
        gender: Option<&str>,
        search: Option<&str>,
        sort: LibraryVoiceSort,
        page_size: u32,
    ) -> Result<SharedVoicesResponse, ElevenLabsError> {
        let path = shared_voices_path(accent, accent_label, gender, search, sort, page_size);
        self.get_json("shared_voices", &path).await
    }

    pub async fn subscription(&self) -> Result<SubscriptionInfo, ElevenLabsError> {
        self.get_json("subscription", "/v1/user/subscription").await
    }

    /// Saves a Library Voice in the account and returns its new voice id.
    pub async fn add_library_voice(
        &self,
        public_owner_id: &str,
        voice_id: &str,
        new_name: &str,
    ) -> Result<String, ElevenLabsError> {
        let path = format!(
            "/v1/voices/add/{}/{}",
            urlencoding::encode(public_owner_id),
            urlencoding::encode(voice_id)
        );
        let request = self
            .request(Method::POST, &path)
            .json(&serde_json::json!({ "new_name": new_name }));
        let response: AddSharedVoiceResponse =
            self.send("add_shared_voice", request).await?.json().await?;
        Ok(response.voice_id)
    }

    /// Checks `voices_read` with the cheapest voice listing (one Default Voice, no side
    /// effects). Returns `false` only when the permission is missing: other failures are
    /// logged and ignored.
    pub async fn has_voices_read(&self) -> bool {
        let request = self.request(Method::GET, "/v2/voices?page_size=1&voice_type=default");
        let result = async {
            let response = request.send().await?;
            let status = response.status();
            if status.is_success() {
                return Ok(());
            }
            // A missing permission is an expected outcome here, so it is not logged as an error.
            let body = response.text().await.unwrap_or_default();
            Err(error_from_response(status, &body))
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
}

/// The text-to-speech body. Eleven v3 does not support context (request stitching), so it
/// gets the bare text.
fn speech_body(language_code: &str, tts: &TtsText, settings: &VoiceSettings) -> serde_json::Value {
    let mut body = serde_json::json!({
        "text": tts.text,
        "model_id": settings.model_id,
        "language_code": language_code,
        "speed": settings.speed,
        "voice_settings": {
            "stability": settings.stability,
            "similarity_boost": settings.similarity_boost,
            "style": settings.style,
            "use_speaker_boost": settings.use_speaker_boost,
        },
    });
    if settings.model_id != "eleven_v3" {
        body["previous_text"] = serde_json::json!(tts.previous_text);
        body["next_text"] = serde_json::json!(tts.next_text);
    }
    body
}

fn shared_voices_path(
    accent: Accent,
    accent_label: Option<&str>,
    gender: Option<&str>,
    search: Option<&str>,
    sort: LibraryVoiceSort,
    page_size: u32,
) -> String {
    let mut path = format!(
        "/v1/shared-voices?language={}&page_size={}&sort={}",
        accent.elevenlabs_code(),
        page_size,
        sort.as_str()
    );
    let mut push = |key: &str, value: Option<&str>| {
        if let Some(v) = value.filter(|v| !v.is_empty()) {
            path.push_str(&format!("&{}={}", key, urlencoding::encode(v)));
        }
    };
    push("accent", accent_label);
    push("gender", gender);
    push("search", search);
    path
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use wiremock::matchers::{body_partial_json, header, method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn forget_account_drops_only_that_accounts_cached_key() {
        let elevenlabs = ElevenLabs::new("http://unused");
        let id = Uuid::new_v4();
        *elevenlabs.active_key.lock().await = Some((id, "key".into()));

        elevenlabs.forget_account(Uuid::new_v4()).await;
        assert!(elevenlabs.active_key.lock().await.is_some());

        elevenlabs.forget_account(id).await;
        assert!(elevenlabs.active_key.lock().await.is_none());
    }

    pub(crate) fn tts(next_text: Option<&str>) -> TtsText {
        TtsText {
            text: "¡Cuarenta y cinco!".into(),
            previous_text: "Bingo caller".into(),
            next_text: next_text.map(Into::into),
        }
    }

    pub(crate) fn settings(model_id: &str) -> VoiceSettings {
        VoiceSettings {
            model_id: model_id.into(),
            ..VoiceSettings::default()
        }
    }

    async fn client(server: &MockServer) -> ElevenLabsClient {
        ElevenLabs::new(server.uri()).client_for_key("key".into())
    }

    #[tokio::test]
    async fn text_to_speech_sends_the_key_settings_and_context() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v1/text-to-speech/voice"))
            .and(header("xi-api-key", "key"))
            .and(body_partial_json(serde_json::json!({
                "text": "¡Cuarenta y cinco!",
                "model_id": "eleven_v4",
                "language_code": "es",
                "previous_text": "Bingo caller",
                "next_text": "cuatro cinco",
                "voice_settings": { "stability": 0.5, "use_speaker_boost": true },
            })))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(b"mp3".to_vec()))
            .expect(1)
            .mount(&server)
            .await;

        let audio = client(&server)
            .await
            .text_to_speech(
                "voice",
                "es",
                &tts(Some("cuatro cinco")),
                &settings("eleven_v4"),
            )
            .await
            .unwrap();

        assert_eq!(audio, b"mp3");
    }

    #[test]
    fn eleven_v3_gets_no_context() {
        let body = speech_body("es", &tts(Some("cuatro cinco")), &settings("eleven_v3"));

        assert!(body.get("previous_text").is_none());
        assert!(body.get("next_text").is_none());
    }

    #[tokio::test]
    async fn failed_requests_are_classified_by_code() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v1/user/subscription"))
            .respond_with(ResponseTemplate::new(402).set_body_string(
                r#"{"detail":{"code":"paid_plan_required","message":"Free users cannot"}}"#,
            ))
            .mount(&server)
            .await;

        let error = client(&server).await.subscription().await.unwrap_err();

        assert!(matches!(
            error,
            ElevenLabsError::ApiError { status_code: 402, api_code: Some(ref code), .. }
                if code == "paid_plan_required"
        ));
    }

    #[tokio::test]
    async fn has_voices_read_is_false_only_for_a_missing_permission() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/voices"))
            .and(query_param("page_size", "1"))
            .respond_with(ResponseTemplate::new(401).set_body_string(
                r#"{"detail":{"code":"unauthorized","message":"missing the permission voices_read"}}"#,
            ))
            .mount(&server)
            .await;

        assert!(!client(&server).await.has_voices_read().await);

        let down = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(503))
            .mount(&down)
            .await;
        assert!(client(&down).await.has_voices_read().await);
    }

    #[test]
    fn errors_serialize_to_the_shape_errors_ts_reads() {
        let api = serde_json::to_value(error_from_response(
            StatusCode::TOO_MANY_REQUESTS,
            r#"{"detail":{"code":"rate_limit_exceeded","message":"Slow down"}}"#,
        ))
        .unwrap();
        let none = serde_json::to_value(ElevenLabsError::NoActiveAccount).unwrap();

        assert_eq!(
            api,
            serde_json::json!({"code": "API_ERROR", "status": 429, "apiCode": "rate_limit_exceeded", "message": "Slow down"})
        );
        assert_eq!(none["code"], "NO_ACTIVE_ACCOUNT");
    }

    #[test]
    fn shared_voices_url_encodes_the_accent_label() {
        let url = shared_voices_path(
            Accent::LatinAmericanSpanish,
            Some("latin american"),
            Some("female"),
            None,
            LibraryVoiceSort::ClonedByCount,
            50,
        );

        assert_eq!(
            url,
            "/v1/shared-voices?language=es&page_size=50&sort=cloned_by_count&accent=latin%20american&gender=female"
        );
    }

    #[test]
    fn shared_voices_url_without_label_searches_the_whole_language() {
        let url = shared_voices_path(
            Accent::NewZealandEnglish,
            None,
            None,
            Some(""),
            LibraryVoiceSort::default(),
            20,
        );

        assert_eq!(
            url,
            "/v1/shared-voices?language=en&page_size=20&sort=trending"
        );
    }

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
            StatusCode::BAD_GATEWAY,
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

        let error = error_from_response(StatusCode::BAD_REQUEST, body);

        assert!(matches!(
            error,
            ElevenLabsError::ApiError { status_code: 400, api_code: Some(ref code), ref message }
                if code == "voice_limit_reached" && message == "Limit reached"
        ));
    }

    #[test]
    fn unauthorized_probe_means_missing_permission() {
        let body = r#"{"detail":{"type":"authentication_error","code":"unauthorized","message":"The API key you used is missing the permission voices_read to execute this operation.","status":"authentication_error"}}"#;

        let error = error_from_response(StatusCode::UNAUTHORIZED, body);

        assert!(is_missing_permission(&error));
    }

    #[test]
    fn other_probe_failures_are_not_missing_permission() {
        let busy = error_from_response(
            StatusCode::SERVICE_UNAVAILABLE,
            r#"{"detail":{"code":"service_unavailable","message":"Down"}}"#,
        );
        let rate_limited = error_from_response(
            StatusCode::TOO_MANY_REQUESTS,
            r#"{"detail":{"code":"rate_limit_exceeded","message":"Slow down"}}"#,
        );

        let wrong_key = error_from_response(
            StatusCode::UNAUTHORIZED,
            r#"{"detail":{"code":"invalid_api_key","message":"Invalid API key"}}"#,
        );

        assert!(!is_missing_permission(&busy));
        assert!(!is_missing_permission(&wrong_key));
        assert!(!is_missing_permission(&rate_limited));
        assert!(!is_missing_permission(&ElevenLabsError::NoActiveAccount));
    }
}
