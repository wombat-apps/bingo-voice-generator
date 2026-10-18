import { invoke } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import type {
  AccountsState,
  Language,
  BingoMode,
  Voice,
  AudioFile,
  NumberAudioPair,
  LanguageId,
  BingoModeId,
  AudioPart,
  ElevenLabsVoice,
  SharedVoicesResponse,
  SubscriptionInfo,
  TtsModelId,
  VoiceSettings,
} from '../types';

// ============================================================================
// ElevenLabs Commands
// ============================================================================

export async function generateSpeech(
  text: string,
  voiceId: string,
  languageCode: string,
  apiKey: string,
  modelId: TtsModelId,
  outputFormat?: string,
  voiceSettings?: VoiceSettings
): Promise<Uint8Array> {
  const result = await invoke<number[]>('generate_speech', {
    text,
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

export async function listElevenLabsVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  return invoke<ElevenLabsVoice[]>('list_voices', { apiKey });
}

export async function listPremadeVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  return invoke<ElevenLabsVoice[]>('list_premade_voices', { apiKey });
}

export async function searchSharedVoices(
  language: LanguageId,
  apiKey: string,
  gender?: string,
  search?: string,
  pageSize?: number
): Promise<SharedVoicesResponse> {
  return invoke<SharedVoicesResponse>('search_shared_voices', {
    language,
    apiKey,
    gender,
    search,
    pageSize,
  });
}

export async function getSubscription(apiKey: string): Promise<SubscriptionInfo> {
  return invoke<SubscriptionInfo>('get_subscription', { apiKey });
}

export async function deleteElevenLabsVoice(voiceId: string, apiKey: string): Promise<void> {
  return invoke('delete_voice', { voiceId, apiKey });
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
  language: LanguageId,
  voice: Voice,
  mode: BingoModeId,
  part: AudioPart
): Promise<AudioFile> {
  return invoke<AudioFile>('save_audio_file', {
    data: Array.from(data),
    number,
    language,
    voice,
    mode,
    part,
  });
}

export async function loadAudioFiles(
  language: LanguageId,
  voice: Voice,
  mode: BingoModeId
): Promise<Map<number, NumberAudioPair>> {
  const result = await invoke<Record<string, NumberAudioPair>>('load_audio_files', {
    language,
    voice,
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
  language: LanguageId,
  voice: Voice,
  mode: BingoModeId,
  part: AudioPart
): Promise<void> {
  return invoke('delete_audio_file', { number, language, voice, mode, part });
}

export async function deleteAllAudioFilesForNumber(
  number: number,
  language: LanguageId,
  voice: Voice,
  mode: BingoModeId
): Promise<void> {
  return invoke('delete_all_audio_files', { number, language, voice, mode });
}

export async function getStorageDirectory(): Promise<string> {
  return invoke<string>('get_storage_directory');
}

export async function readAudioFile(filePath: string): Promise<Uint8Array> {
  const result = await invoke<number[]>('read_audio_file', { filePath });
  return new Uint8Array(result);
}

export interface VoiceDirectoryInfo {
  path: string;
  exists: boolean;
}

export async function getVoiceDirectory(
  language: LanguageId,
  voice: Voice
): Promise<VoiceDirectoryInfo> {
  return invoke<VoiceDirectoryInfo>('get_voice_directory', { language, voice });
}

export async function revealVoiceInFileManager(
  language: LanguageId,
  voice: Voice
): Promise<void> {
  const dirInfo = await getVoiceDirectory(language, voice);
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

export async function saveVoices(voices: Voice[]): Promise<void> {
  return invoke('save_voices', { voices });
}

export async function addVoice(voice: Voice): Promise<Voice[]> {
  return invoke<Voice[]>('add_voice', { voice });
}

export async function createVoice(
  elevenlabsId: string,
  elevenlabsName: string,
  customName: string,
  language: LanguageId,
  gender: string
): Promise<Voice[]> {
  // Tauri expects camelCase field names by default
  const payload = {
    input: {
      elevenlabsId,
      elevenlabsName,
      customName,
      language,
      gender,
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

export async function updateVoice(voice: Voice): Promise<Voice[]> {
  return invoke<Voice[]>('update_voice', { voice });
}

export async function deleteLocalVoice(voiceUuid: string): Promise<Voice[]> {
  return invoke<Voice[]>('delete_local_voice', { voiceUuid });
}

export async function getVoice(voiceUuid: string): Promise<Voice | null> {
  return invoke<Voice | null>('get_voice', { voiceUuid });
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
export async function addAccount(name: string, apiKey: string): Promise<AccountsState> {
  return invoke<AccountsState>('add_account', { name, apiKey });
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
  language: LanguageId,
  mode: BingoModeId,
  part: AudioPart
): Promise<string> {
  return invoke<string>('build_tts_text', { number, language, mode, part });
}

export async function getLanguages(): Promise<Language[]> {
  return invoke<Language[]>('get_languages');
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
