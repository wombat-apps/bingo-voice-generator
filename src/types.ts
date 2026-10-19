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

// Audio part types
export type AudioPart = 'word' | 'digit';

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
  /** null for Voices saved before details were stored, until `backfillVoiceDetails` finds them. */
  details: VoiceDetails | null;
}

/** How ElevenLabs describes the voice, kept from when the Voice was added; see GLOSSARY.md. */
export interface VoiceDetails {
  /** ElevenLabs' free-form label (e.g. "castilian"), not the Voice's Accent. */
  elevenlabsAccent: string | null;
  age: string | null;
  description: string | null;
  useCase: string | null;
}

// Audio file types
/** A number of one Voice in one Bingo Mode: its Word and its Digit, whichever exist. */
export interface VoiceNumber {
  accent: AccentId;
  voiceUuid: string;
  mode: BingoModeId;
  number: number;
}

/** The Word or the Digit of a `VoiceNumber`: what names one audio file. */
export interface AudioFileId extends VoiceNumber {
  part: AudioPart;
}

export interface AudioFile extends AudioFileId {
  filePath: string;
  createdAt: string;
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
  useCase: string | null;
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
  publicOwnerId: string | null;
  /** How many ElevenLabs users have added the voice: the Voice Library has no rating. */
  clonedByCount: number | null;
  featured: boolean | null;
}

/** The orders the Voice Library can return its voices in. */
export type LibraryVoiceSort = 'trending' | 'cloned_by_count' | 'usage_character_count_1y' | 'created_date';

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
  /** The last characters of the API key, e.g. `••••a1b2`. */
  keyHint: string | null;
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
  /** Whether the model uses Style and Speed; Eleven v4 ignores them (see docs/elevenlabs-plans.md). */
  usesStyleAndSpeed: boolean;
}

export const TTS_MODELS: TtsModel[] = [
  { id: 'eleven_v4', name: 'Eleven v4', description: 'Highest quality', usesStyleAndSpeed: false },
  { id: 'eleven_v4_turbo', name: 'Eleven v4 Turbo', description: 'Fast, lower cost', usesStyleAndSpeed: false },
  { id: 'eleven_v3', name: 'Eleven v3', description: 'Previous gen, expressive', usesStyleAndSpeed: true },
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Stable, reliable numbers', usesStyleAndSpeed: true },
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

/**
 * Serialized `ElevenLabsError` (src-tauri/src/commands/elevenlabs/client.rs), or a
 * `GenerationError` (src-tauri/src/commands/generation.rs), which adds `NO_DIGIT`,
 * `STORAGE_ERROR` and `FORMAT_ERROR`.
 */
export type ElevenLabsError =
  | {
      code: 'NO_ACTIVE_ACCOUNT' | 'ACCOUNT_ERROR' | 'NETWORK_ERROR' | 'NO_DIGIT' | 'STORAGE_ERROR' | 'FORMAT_ERROR';
      message: string;
    }
  | { code: 'API_ERROR'; status: number; apiCode: string | null; message: string };

/**
 * A Word Format or a Digit Format the user added (see GLOSSARY.md). The Default one is not
 * listed: it is `selectedId: null`.
 */
export interface PartFormat {
  id: string;
  language: string;
  part: AudioPart;
  /** The Bingo Mode of a Word Format; a Digit Format has none. */
  bingoMode?: BingoModeId;
  format: string;
}

/** The formats of one Language and Audio Part (and, for the Word, Bingo Mode). */
export interface Formats {
  formats: PartFormat[];
  /** The text of the Default one, in the same syntax. */
  defaultFormat: string;
  /** The placeholders these formats can use, such as `{num}`. */
  placeholders: string[];
  selectedId: string | null;
}

/** An update `check_for_update` found and `install_update` will install. */
export interface UpdateInfo {
  version: string;
  notes: string | null;
}
