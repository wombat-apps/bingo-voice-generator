import { invoke } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import type {
  AccountsState,
  AddAccountResult,
  Accent,
  BingoMode,
  Voice,
  VoiceKind,
  AudioFile,
  NumberAudioPair,
  AccentId,
  BingoModeId,
  AudioPart,
  DefaultVoice,
  SharedVoicesResponse,
  SharedVoiceSort,
  SubscriptionInfo,
  TtsModelId,
  TtsText,
  VoiceSettings,
} from '../types';

// ============================================================================
// ElevenLabs Commands
// ============================================================================

export async function generateSpeech(
  tts: TtsText,
  voiceId: string,
  languageCode: string,
  apiKey: string,
  modelId: TtsModelId,
  outputFormat?: string,
  voiceSettings?: VoiceSettings
): Promise<Uint8Array> {
  const result = await invoke<number[]>('generate_speech', {
    text: tts.text,
    previousText: tts.previousText,
    nextText: tts.nextText,
    voiceId,
    languageCode,
    apiKey,
    modelId,
    outputFormat,
    speed: voiceSettings?.speed,
    stability: voiceSettings?.stability,
    similarityBoost: voiceSettings?.similarityBoost,
    style: voiceSettings?.style,
    useSpeakerBoost: voiceSettings?.useSpeakerBoost,
  });
  return new Uint8Array(result);
}

export async function listDefaultVoices(
  accent: AccentId,
  apiKey: string,
  gender?: string
): Promise<DefaultVoice[]> {
  return invoke<DefaultVoice[]>('list_default_voices', { accent, apiKey, gender });
}

export async function searchSharedVoices(
  accent: AccentId,
  apiKey: string,
  gender?: string,
  search?: string,
  sort?: SharedVoiceSort,
  pageSize?: number
): Promise<SharedVoicesResponse> {
  return invoke<SharedVoicesResponse>('search_shared_voices', {
    accent,
    apiKey,
    gender,
    search,
    sort,
    pageSize,
  });
}

export async function getSubscription(apiKey: string): Promise<SubscriptionInfo> {
  return invoke<SubscriptionInfo>('get_subscription', { apiKey });
}

export async function addSharedVoice(
  publicOwnerId: string,
  voiceId: string,
  newName: string,
  apiKey: string
): Promise<string> {
  return invoke<string>('add_shared_voice', { publicOwnerId, voiceId, newName, apiKey });
}

// ============================================================================
// Storage Commands
// ============================================================================

export async function saveAudioFile(
  data: Uint8Array,
  number: number,
  accent: AccentId,
  voice: Voice,
  mode: BingoModeId,
  part: AudioPart
): Promise<AudioFile> {
  return invoke<AudioFile>('save_audio_file', {
    data: Array.from(data),
    number,
    accent,
    voice,
    mode,
    part,
  });
}

export async function loadAudioFiles(
  accent: AccentId,
  voice: Voice,
  mode: BingoModeId
): Promise<Map<number, NumberAudioPair>> {
  const result = await invoke<Record<string, NumberAudioPair>>('load_audio_files', {
    accent,
    voiceUuid: voice.uuid,
    mode,
  });

  const map = new Map<number, NumberAudioPair>();
  for (const [key, value] of Object.entries(result)) {
    map.set(parseInt(key, 10), value);
  }
  return map;
}

export async function deleteAudioFile(
  number: number,
  accent: AccentId,
  voice: Voice,
  mode: BingoModeId,
  part: AudioPart
): Promise<void> {
  return invoke('delete_audio_file', { number, accent, voiceUuid: voice.uuid, mode, part });
}

export async function deleteAllAudioFilesForNumber(
  number: number,
  accent: AccentId,
  voice: Voice,
  mode: BingoModeId
): Promise<void> {
  return invoke('delete_all_audio_files', { number, accent, voiceUuid: voice.uuid, mode });
}

/** UUIDs of the Accent's Voices with at least one recording in this Bingo Mode. */
export async function voicesWithRecordings(accent: AccentId, mode: BingoModeId): Promise<string[]> {
  return invoke<string[]>('voices_with_recordings', { accent, mode });
}

export async function readAudioFile(filePath: string): Promise<Uint8Array> {
  const result = await invoke<number[]>('read_audio_file', { filePath });
  return new Uint8Array(result);
}

interface VoiceDirectoryInfo {
  path: string;
  exists: boolean;
}

export async function revealVoiceInFileManager(
  accent: AccentId,
  voice: Voice
): Promise<void> {
  const dirInfo = await invoke<VoiceDirectoryInfo>('get_voice_directory', {
    accent,
    voiceUuid: voice.uuid,
  });
  if (dirInfo.exists) {
    await revealItemInDir(dirInfo.path);
  }
}

// ============================================================================
// Voices Commands
// ============================================================================

export async function loadVoices(): Promise<Voice[]> {
  return invoke<Voice[]>('load_voices');
}

export async function createVoice(
  elevenlabsId: string,
  elevenlabsName: string,
  customName: string,
  accent: AccentId,
  gender: string,
  kind: VoiceKind
): Promise<Voice[]> {
  // Tauri expects camelCase field names by default
  const payload = {
    input: {
      elevenlabsId,
      elevenlabsName,
      customName,
      accent,
      gender,
      kind,
    },
  };

  console.log('[createVoice] Sending to Rust:', JSON.stringify(payload, null, 2));

  try {
    const result = await invoke<Voice[]>('create_voice', payload);
    console.log('[createVoice] Received from Rust:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('[createVoice] Error from Rust:', error);
    throw error;
  }
}

/** Stores the kind of Voices saved without one; asks ElevenLabs only if some Voice lacks it. */
export async function backfillVoiceKinds(apiKey: string): Promise<Voice[]> {
  return invoke<Voice[]>('backfill_voice_kinds', { apiKey });
}

export async function updateVoice(voice: Voice): Promise<Voice[]> {
  return invoke<Voice[]>('update_voice', { voice });
}

export async function deleteLocalVoice(voiceUuid: string): Promise<Voice[]> {
  return invoke<Voice[]>('delete_local_voice', { voiceUuid });
}

// ============================================================================
// Account Commands
// ============================================================================

export async function listAccounts(): Promise<AccountsState> {
  return invoke<AccountsState>('list_accounts');
}

export async function getAccountApiKey(accountId: string): Promise<string> {
  return invoke<string>('get_account_api_key', { accountId });
}

/** Validates the key against ElevenLabs before saving it. */
export async function addAccount(name: string, apiKey: string): Promise<AddAccountResult> {
  return invoke<AddAccountResult>('add_account', { name, apiKey });
}

export async function renameAccount(accountId: string, name: string): Promise<AccountsState> {
  return invoke<AccountsState>('rename_account', { accountId, name });
}

export async function deleteAccount(accountId: string): Promise<AccountsState> {
  return invoke<AccountsState>('delete_account', { accountId });
}

export async function setActiveAccount(accountId: string | null): Promise<AccountsState> {
  return invoke<AccountsState>('set_active_account', { accountId });
}

// ============================================================================
// Utility Commands
// ============================================================================

export async function buildTtsText(
  number: number,
  accent: AccentId,
  mode: BingoModeId,
  part: AudioPart
): Promise<TtsText> {
  return invoke<TtsText>('build_tts_text', { number, accent, mode, part });
}

export async function getAccents(): Promise<Accent[]> {
  return invoke<Accent[]>('get_accents');
}

export async function getBingoModes(): Promise<BingoMode[]> {
  return invoke<BingoMode[]>('get_bingo_modes');
}

// ============================================================================
// Platform Detection
// ============================================================================

export interface PlatformInfo {
  os: string;
  osVersion: string;
  hasVibrancy: boolean;
  vibrancyType: string;
}

export async function getPlatformInfo(): Promise<PlatformInfo> {
  return invoke<PlatformInfo>('get_platform_info');
}
