import { invoke } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import type {
  AccountsState,
  AddAccountResult,
  Accent,
  Voice,
  VoiceKind,
  AudioFile,
  NumberAudioPair,
  AccentId,
  BingoModeId,
  AudioPart,
  DefaultVoice,
  SharedVoicesResponse,
  LibraryVoiceSort,
  SubscriptionInfo,
  VoiceSettings,
} from '../types';

// ============================================================================
// ElevenLabs Commands
// ============================================================================

// ElevenLabs commands use the Active Account: its API key never leaves Rust.

/**
 * Generates the Word or the Digit of `number` with `voice`, in its Accent, and saves its
 * Original Audio and Trimmed Audio, replacing any already there.
 */
export async function generateAudio(
  number: number,
  voice: Voice,
  mode: BingoModeId,
  part: AudioPart,
  settings: VoiceSettings
): Promise<AudioFile> {
  return invoke<AudioFile>('generate_audio', { number, voice, mode, part, settings });
}

export async function listDefaultVoices(
  accent: AccentId,
  gender?: string
): Promise<DefaultVoice[]> {
  return invoke<DefaultVoice[]>('list_default_voices', { accent, gender });
}

export async function searchLibraryVoices(
  accent: AccentId,
  gender?: string,
  search?: string,
  sort?: LibraryVoiceSort,
  pageSize?: number
): Promise<SharedVoicesResponse> {
  return invoke<SharedVoicesResponse>('search_library_voices', {
    accent,
    gender,
    search,
    sort,
    pageSize,
  });
}

/** The subscription of any saved ElevenLabs Account, active or not. */
export async function getAccountSubscription(accountId: string): Promise<SubscriptionInfo> {
  return invoke<SubscriptionInfo>('get_account_subscription', { accountId });
}

export async function addLibraryVoice(
  publicOwnerId: string,
  voiceId: string,
  newName: string
): Promise<string> {
  return invoke<string>('add_library_voice', { publicOwnerId, voiceId, newName });
}

// ============================================================================
// Storage Commands
// ============================================================================

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

/** UUIDs of the Accent's Voices with at least one Trimmed Audio in this Bingo Mode. */
export async function voicesWithTrimmedAudio(accent: AccentId, mode: BingoModeId): Promise<string[]> {
  return invoke<string[]>('voices_with_trimmed_audio', { accent, mode });
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
export async function backfillVoiceKinds(): Promise<Voice[]> {
  return invoke<Voice[]>('backfill_voice_kinds');
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

/** The full API key, only to show it when the user asks to. */
export async function revealAccountApiKey(accountId: string): Promise<string> {
  return invoke<string>('reveal_account_api_key', { accountId });
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

export async function getAccents(): Promise<Accent[]> {
  return invoke<Accent[]>('get_accents');
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
