// Accent types (see GLOSSARY.md)
export type AccentId =
  | 'es-ES' | 'es-419' | 'es-AR'
  | 'en-US' | 'en-GB' | 'en-NZ' | 'en-IN'
  | 'fr-FR' | 'fr-CA'
  | 'pt-BR' | 'pt-PT'
  | 'it-IT' | 'de-DE' | 'ru-RU' | 'tr-TR' | 'hi-IN' | 'ja-JP';

export interface Accent {
  id: AccentId;
  displayName: string;
  flag: string;
  elevenlabsCode: string;
  elevenlabsAccent: string;
}

// Bingo mode types
export type BingoModeId = 'bingo90' | 'bingo75';

export interface BingoMode {
  id: BingoModeId;
  displayName: string;
  maxNumber: number;
  gridColumns: number;
}

// Audio part types
export type AudioPart = 'word' | 'digit';

// What is sent to ElevenLabs for one part: the spoken text and its unspoken context
export interface TtsText {
  text: string;
  previousText: string;
  nextText: string | null;
}

// Voice types
/** Default Voice or Library Voice; see GLOSSARY.md. */
export type VoiceKind = 'default' | 'library';

export interface Voice {
  uuid: string;
  elevenlabsId: string;
  elevenlabsName: string;
  customName: string;
  accent: AccentId;
  gender: string;
  favorite: boolean;
  /** null for Voices saved before kinds were stored, until `backfillVoiceKinds` runs. */
  kind: VoiceKind | null;
}

// Audio file types
export interface AudioFile {
  number: number;
  part: AudioPart;
  accent: AccentId;
  voiceUuid: string;
  mode: BingoModeId;
  filePath: string;
  createdAt: string;
  duration: number;
}

export interface NumberAudioPair {
  number: number;
  wordAudio: AudioFile | null;
  digitAudio: AudioFile | null;
}

// ElevenLabs types
export interface DefaultVoice {
  voiceId: string;
  name: string;
  gender: string | null;
  accent: string | null;
  age: string | null;
  description: string | null;
  previewUrl: string | null;
}

export interface SharedVoice {
  voiceId: string;
  name: string;
  accent: string | null;
  gender: string | null;
  age: string | null;
  language: string | null;
  locale: string | null;
  description: string | null;
  previewUrl: string | null;
  category: string | null;
  useCase: string | null;
  freeUsersAllowed: boolean | null;
  publicOwnerId: string | null;
}

export interface SharedVoicesResponse {
  voices: SharedVoice[];
  hasMore: boolean;
  /** The Accent's label found no voices, so these are from its whole Language. */
  wholeLanguage: boolean;
}

// ElevenLabs accounts (API keys stay in the Keychain)
export interface ElevenLabsAccount {
  id: string;
  name: string;
}

export interface AccountsState {
  accounts: ElevenLabsAccount[];
  activeAccountId: string | null;
}

/** API key permissions the app checks when an account is added. */
export type ApiKeyPermission = 'voices_read';

export interface AddAccountResult {
  state: AccountsState;
  /** Checked permissions the key lacks. The account is saved anyway. */
  missingPermissions: ApiKeyPermission[];
}

export interface SubscriptionInfo {
  tier: string;
  characterCount: number;
  characterLimit: number;
  status: string;
  nextCharacterCountResetUnix: number | null;
}

// Generation state
export interface GenerationProgress {
  current: number;
  total: number;
  isGenerating: boolean;
  currentNumber: number | null;
  currentPart: AudioPart | null;
  error: string | null;
}

// TTS Model types
export type TtsModelId =
  | 'eleven_v4'
  | 'eleven_v4_turbo'
  | 'eleven_v3'
  | 'eleven_multilingual_v2';

export interface TtsModel {
  id: TtsModelId;
  name: string;
  description: string;
}

export const TTS_MODELS: TtsModel[] = [
  { id: 'eleven_v4', name: 'Eleven v4', description: 'Highest quality' },
  { id: 'eleven_v4_turbo', name: 'Eleven v4 Turbo', description: 'Fast, lower cost' },
  { id: 'eleven_v3', name: 'Eleven v3', description: 'Previous gen, expressive' },
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Stable, reliable numbers' },
];

export function isTtsModelId(value: unknown): value is TtsModelId {
  return TTS_MODELS.some((model) => model.id === value);
}

// Voice settings for ElevenLabs TTS
export type StabilityPreset = 'creative' | 'natural' | 'robust';

export interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
  modelId: TtsModelId;
}

export const STABILITY_PRESETS: Record<StabilityPreset, { value: number; label: string }> = {
  creative: { value: 0.0, label: 'Creative' },
  natural: { value: 0.5, label: 'Natural' },
  robust: { value: 1.0, label: 'Robust' },
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.85,
  style: 0.9,
  useSpeakerBoost: true,
  speed: 1.0,
  modelId: 'eleven_v4',
};

// App state
export interface AppState {
  accent: AccentId;
  mode: BingoModeId;
  selectedVoice: Voice | null;
  audioFiles: Map<number, NumberAudioPair>;
  playingNumber: number | null;
  playingPart: AudioPart | null;
}

/** Serialized `ElevenLabsError` from src-tauri/src/commands/elevenlabs.rs. */
export type ElevenLabsError =
  | { code: 'NO_API_KEY' | 'NETWORK_ERROR'; message: string }
  | { code: 'API_ERROR'; status: number; apiCode: string | null; message: string };
