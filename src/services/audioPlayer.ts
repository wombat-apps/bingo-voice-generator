import { readAudioFile } from './tauri';

// Playback goes through <audio> elements, not Web Audio. After the Mac wakes from sleep,
// WebKit's Web Audio output can stay silent while its clock keeps running (the progress bar
// moves but nothing is heard), even on a new AudioContext or after reloading the page;
// <audio> keeps working. Web Audio is only used to decode, which needs no output device.
let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let currentDuration = 0;
let isCurrentlyPlaying = false;
// Bumped on every play/stop so a playback still loading does not start after a newer one
let playToken = 0;
let onPlaybackEndCallback: (() => void) | null = null;
let updateTimer: number | null = null;
let onTimeUpdateCallback: ((time: number) => void) | null = null;

// Separate state for preview playback (voice samples in sidebar)
let previewAudio: HTMLAudioElement | null = null;
let previewUrl: string | null = null;
let previewPendingNext: string | null = null;
let previewToken = 0;

let decodeContext: OfflineAudioContext | null = null;

function decode(data: Uint8Array): Promise<AudioBuffer> {
  if (!decodeContext) {
    decodeContext = new OfflineAudioContext(1, 1, 44100);
  }
  // decodeAudioData detaches the buffer it is given, so pass a copy
  return decodeContext.decodeAudioData(data.slice().buffer);
}

function createAudio(data: Uint8Array): { audio: HTMLAudioElement; url: string } {
  const url = URL.createObjectURL(new Blob([data.slice()], { type: 'audio/mpeg' }));
  return { audio: new Audio(url), url };
}

function releaseAudio(audio: HTMLAudioElement, url: string): void {
  audio.onended = null;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  URL.revokeObjectURL(url);
}

function startTimeUpdateTimer(): void {
  stopTimeUpdateTimer();
  updateTimer = window.setInterval(() => {
    if (isCurrentlyPlaying && onTimeUpdateCallback) {
      onTimeUpdateCallback(getCurrentTime());
    }
  }, 50);
}

function stopTimeUpdateTimer(): void {
  if (updateTimer !== null) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
}

async function startPlayback(data: Uint8Array, token: number): Promise<void> {
  // Decoding gives the exact duration; <audio> only estimates it for MP3
  const audioBuffer = await decode(data);
  if (token !== playToken) return;

  const { audio, url } = createAudio(data);
  currentAudio = audio;
  currentUrl = url;
  currentDuration = audioBuffer.duration;

  audio.onended = () => {
    if (audio !== currentAudio) return;
    isCurrentlyPlaying = false;
    stopTimeUpdateTimer();
    if (onPlaybackEndCallback) {
      onPlaybackEndCallback();
    }
  };

  isCurrentlyPlaying = true;
  try {
    await audio.play();
  } catch (err) {
    if (audio === currentAudio) {
      isCurrentlyPlaying = false;
    }
    throw err;
  }
  startTimeUpdateTimer();
}

export async function playAudioFile(filePath: string): Promise<void> {
  // Stop any currently playing audio
  stop();
  const token = playToken;

  const audioData = await readAudioFile(filePath);
  if (token !== playToken) return;

  await startPlayback(audioData, token);
}

export async function playAudioData(data: Uint8Array): Promise<void> {
  // Stop any currently playing audio
  stop();
  await startPlayback(data, playToken);
}

export function stop(): void {
  playToken++;
  isCurrentlyPlaying = false;
  stopTimeUpdateTimer();
  if (currentAudio && currentUrl) {
    releaseAudio(currentAudio, currentUrl);
  }
  currentAudio = null;
  currentUrl = null;
  currentDuration = 0;
}

export function pause(): void {
  if (!isCurrentlyPlaying || !currentAudio) return;

  isCurrentlyPlaying = false;
  stopTimeUpdateTimer();
  currentAudio.pause();
}

export function resume(): void {
  if (isCurrentlyPlaying || !currentAudio) return;

  const audio = currentAudio;
  isCurrentlyPlaying = true;
  audio.play().catch((err) => {
    console.error('[audioPlayer] Failed to resume playback:', err);
    if (audio === currentAudio) {
      isCurrentlyPlaying = false;
      stopTimeUpdateTimer();
    }
  });
  startTimeUpdateTimer();
}

export function seek(time: number): void {
  if (!currentAudio) return;

  // Clamp time to valid range
  const clampedTime = Math.max(0, Math.min(time, currentDuration));
  currentAudio.currentTime = clampedTime;

  // Notify of new time
  if (onTimeUpdateCallback) {
    onTimeUpdateCallback(clampedTime);
  }
}

export function getCurrentTime(): number {
  return currentAudio?.currentTime ?? 0;
}

export function getDuration(): number {
  return currentDuration;
}

export function setOnTimeUpdate(callback: ((time: number) => void) | null): void {
  onTimeUpdateCallback = callback;
}

export function isPlaying(): boolean {
  return isCurrentlyPlaying;
}

export function setOnPlaybackEnd(callback: (() => void) | null): void {
  onPlaybackEndCallback = callback;
}


export async function getAudioDuration(filePath: string): Promise<number> {
  const audioData = await readAudioFile(filePath);
  const audioBuffer = await decode(audioData);
  return audioBuffer.duration;
}

export async function getAudioDurationFromData(data: Uint8Array): Promise<number> {
  const audioBuffer = await decode(data);
  return audioBuffer.duration;
}

// Waveform generation
export async function generateWaveform(
  filePath: string,
  samples: number = 100
): Promise<number[]> {
  const audioData = await readAudioFile(filePath);
  const audioBuffer = await decode(audioData);

  return extractWaveform(audioBuffer, samples);
}

export async function generateWaveformFromData(
  data: Uint8Array,
  samples: number = 100
): Promise<number[]> {
  const audioBuffer = await decode(data);

  return extractWaveform(audioBuffer, samples);
}

function extractWaveform(audioBuffer: AudioBuffer, samples: number): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const waveform: number[] = [];
  const blockSize = Math.floor(channelData.length / samples);

  for (let i = 0; i < samples; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[start + j]);
    }
    waveform.push(sum / blockSize);
  }

  // Normalize to 0-1 range
  const max = Math.max(...waveform);
  if (max > 0) {
    return waveform.map((v) => v / max);
  }

  return waveform;
}


// Preview playback functions (independent from main player)
// Used for voice sample previews in sidebar - doesn't affect main player state

export function stopPreview(): void {
  previewToken++;
  previewPendingNext = null;
  if (previewAudio && previewUrl) {
    // releaseAudio removes the onended handler before pausing, so it cannot
    // start the pending next file after we've already started a new preview
    releaseAudio(previewAudio, previewUrl);
  }
  previewAudio = null;
  previewUrl = null;
}

export async function playPreview(filePath: string, nextFilePath?: string): Promise<void> {
  // Stop any currently playing preview
  stopPreview();
  const token = previewToken;

  // Store pending next file for sequential playback
  previewPendingNext = nextFilePath || null;

  const audioData = await readAudioFile(filePath);
  if (token !== previewToken) return;

  const { audio, url } = createAudio(audioData);
  previewAudio = audio;
  previewUrl = url;

  // Set up onended callback for sequential preview playback
  audio.onended = () => {
    const nextPath = previewPendingNext;
    stopPreview();
    if (nextPath) {
      playPreview(nextPath).catch(console.error);
    }
  };

  await audio.play();
}

export function isPreviewPlaying(): boolean {
  return previewAudio !== null;
}
