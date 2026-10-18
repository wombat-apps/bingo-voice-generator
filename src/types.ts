// Language types
export type LanguageId = 'es-ES' | 'en-US' | 'en-GB' | 'fr-FR' | 'pt-BR' | 'it-IT';

export interface Language {
  id: LanguageId;
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

// Voice types
export interface Voice {
  uuid: string;
  elevenlabsId: string;
  elevenlabsName: string;
  customName: string;
  language: LanguageId;
  gender: string;
  favorite: boolean;
}

// Audio file types
export interface AudioFile {
  number: number;
  part: AudioPart;
  language: LanguageId;
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
export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  category: string;
  createdAtUnix: number | null;
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
  language: LanguageId;
  mode: BingoModeId;
  selectedVoice: Voice | null;
  audioFiles: Map<number, NumberAudioPair>;
  playingNumber: number | null;
  playingPart: AudioPart | null;
}
