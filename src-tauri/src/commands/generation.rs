use serde::Serialize;
use tauri::State;
use thiserror::Error;

use super::elevenlabs::{ElevenLabs, ElevenLabsClient, ElevenLabsError};
use crate::models::{
    build_tts_text, AudioFile, AudioFileId, AudioPart, BingoMode, SelectedFormats, Voice,
    VoiceNumber, VoiceSettings,
};
use crate::services::app_dirs::AppDirs;
use crate::services::audio_store::{AudioStore, StorageError};
use crate::services::format_store::FormatError;

#[derive(Debug, Error)]
pub enum GenerationError {
    #[error("Number {0} has no Digit: numbers below 10 only have a Word")]
    NoDigit(u32),
    #[error(transparent)]
    ElevenLabs(#[from] ElevenLabsError),
    #[error("Could not save the audio: {0}")]
    Storage(#[from] StorageError),
    #[error(transparent)]
    Format(#[from] FormatError),
}

/// ElevenLabs errors keep their own shape; the others add `NO_DIGIT`, `STORAGE_ERROR` and
/// `FORMAT_ERROR` codes to it. `src/services/errors.ts` reads them.
impl Serialize for GenerationError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let code = match self {
            GenerationError::ElevenLabs(e) => return e.serialize(serializer),
            GenerationError::NoDigit(_) => "NO_DIGIT",
            GenerationError::Storage(_) => "STORAGE_ERROR",
            GenerationError::Format(_) => "FORMAT_ERROR",
        };
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("code", code)?;
        map.serialize_entry("message", &self.to_string())?;
        map.end()
    }
}

/// Generates the Word or the Digit of `number` with `voice` and the Active Account, in the
/// formats selected for its Language, and saves its Original Audio and Trimmed Audio,
/// replacing any already there.
#[tauri::command]
pub async fn generate_audio(
    elevenlabs: State<'_, ElevenLabs>,
    dirs: State<'_, AppDirs>,
    number: u32,
    voice: Voice,
    mode: BingoMode,
    part: AudioPart,
    settings: VoiceSettings,
) -> Result<AudioFile, GenerationError> {
    let client = elevenlabs.active_client(&dirs).await?;
    let formats = dirs
        .format_store()
        .selected_formats(voice.accent.language())
        .await?;
    let id = VoiceNumber::new(voice.accent, voice.uuid, mode, number).with_part(part);
    generate(
        &client,
        &dirs.audio_store(),
        &voice,
        id,
        &settings,
        &formats,
    )
    .await
}

/// The text is built for the Voice's Accent first, so a number with no such part fails
/// before spending characters. Once ElevenLabs has answered, the audio is always kept as
/// the Original Audio, even if trimming fails.
async fn generate(
    client: &ElevenLabsClient,
    store: &AudioStore,
    voice: &Voice,
    id: AudioFileId,
    settings: &VoiceSettings,
    formats: &SelectedFormats,
) -> Result<AudioFile, GenerationError> {
    let AudioFileId {
        accent,
        mode,
        number,
        part,
        ..
    } = id;
    let tts = build_tts_text(number, accent, mode, part, formats)
        .ok_or(GenerationError::NoDigit(number))?;
    log::info!(
        "[generate_audio] {} {:?} {:?} in {} with {} ({})",
        number,
        part,
        mode,
        accent.raw_value(),
        voice.elevenlabs_id,
        settings.model_id
    );
    let original = client
        .text_to_speech(
            &voice.elevenlabs_id,
            accent.elevenlabs_code(),
            &tts,
            settings,
        )
        .await?;
    Ok(store.save(&id, original).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Accent, VoiceKind};
    use wiremock::matchers::{body_partial_json, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn voice() -> Voice {
        Voice::new(
            "el-voice".into(),
            "Name".into(),
            None,
            Accent::PeninsularSpanish,
            None,
            VoiceKind::Default,
        )
    }

    async fn setup(response: ResponseTemplate) -> (MockServer, tempfile::TempDir, AudioStore) {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v1/text-to-speech/el-voice"))
            .and(body_partial_json(
                serde_json::json!({ "language_code": "es" }),
            ))
            .respond_with(response)
            .mount(&server)
            .await;
        let dir = tempfile::tempdir().unwrap();
        let store = AudioStore::new(dir.path().to_path_buf());
        (server, dir, store)
    }

    fn id(voice: &Voice, mode: BingoMode, number: u32, part: AudioPart) -> AudioFileId {
        VoiceNumber::new(voice.accent, voice.uuid, mode, number).with_part(part)
    }

    fn client(server: &MockServer) -> ElevenLabsClient {
        ElevenLabs::new(server.uri()).client_for_key("key".into())
    }

    #[tokio::test]
    async fn saves_what_elevenlabs_returned_as_the_original_and_the_trimmed_audio() {
        let (server, _dir, store) =
            setup(ResponseTemplate::new(200).set_body_bytes(b"not an mp3".to_vec())).await;
        let voice = voice();

        let file = generate(
            &client(&server),
            &store,
            &voice,
            id(&voice, BingoMode::Bingo75, 45, AudioPart::Word),
            &VoiceSettings::default(),
            &SelectedFormats::default(),
        )
        .await
        .unwrap();

        assert!(file.file_path.ends_with("n45_word.mp3"));
        assert_eq!(file.id.accent, Accent::PeninsularSpanish);
        let loaded = store
            .load(voice.accent, voice.uuid, BingoMode::Bingo75)
            .await
            .unwrap();
        assert!(loaded[&45].word_audio.is_some());
        assert_eq!(store.read(&file.file_path).await.unwrap(), b"not an mp3");
    }

    #[tokio::test]
    async fn the_word_is_sent_in_the_selected_word_format() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(body_partial_json(
                serde_json::json!({ "text": "\u{a1}N CUARENTA Y CINCO!" }),
            ))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(b"mp3".to_vec()))
            .expect(1)
            .mount(&server)
            .await;
        let dir = tempfile::tempdir().unwrap();
        let store = AudioStore::new(dir.path().to_path_buf());
        let voice = voice();

        generate(
            &client(&server),
            &store,
            &voice,
            id(&voice, BingoMode::Bingo75, 45, AudioPart::Word),
            &VoiceSettings::default(),
            &SelectedFormats {
                word_75: Some("\u{a1}{LETTER} {NUM}!".into()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn a_failed_request_saves_nothing() {
        let (server, _dir, store) = setup(ResponseTemplate::new(402).set_body_string(
            r#"{"detail":{"code":"paid_plan_required","message":"Free users cannot"}}"#,
        ))
        .await;
        let voice = voice();

        let error = generate(
            &client(&server),
            &store,
            &voice,
            id(&voice, BingoMode::Bingo90, 45, AudioPart::Word),
            &VoiceSettings::default(),
            &SelectedFormats::default(),
        )
        .await
        .unwrap_err();

        assert!(matches!(error, GenerationError::ElevenLabs(_)));
        assert_eq!(
            serde_json::to_value(&error).unwrap()["apiCode"],
            "paid_plan_required"
        );
        assert!(store
            .load(voice.accent, voice.uuid, BingoMode::Bingo90)
            .await
            .unwrap()
            .is_empty());
    }

    #[tokio::test]
    async fn the_digit_of_a_number_below_10_is_refused_before_calling_elevenlabs() {
        let (server, _dir, store) = setup(ResponseTemplate::new(200)).await;

        let error = generate(
            &client(&server),
            &store,
            &voice(),
            id(&voice(), BingoMode::Bingo90, 7, AudioPart::Digit),
            &VoiceSettings::default(),
            &SelectedFormats::default(),
        )
        .await
        .unwrap_err();

        assert_eq!(serde_json::to_value(&error).unwrap()["code"], "NO_DIGIT");
        assert!(server.received_requests().await.unwrap().is_empty());
    }
}
