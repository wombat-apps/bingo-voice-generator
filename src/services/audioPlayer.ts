import { readAudioFile } from './tauri';

let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let onPlaybackEndCallback: (() => void) | null = null;

// Seek support state
let currentAudioBuffer: AudioBuffer | null = null;
let startTime: number = 0;
let pauseOffset: number = 0;
let isCurrentlyPlaying: boolean = false;
let updateTimer: number | null = null;
let onTimeUpdateCallback: ((time: number) => void) | null = null;

// Separate state for preview playback (voice samples in sidebar)
let previewAudioContext: AudioContext | null = null;
let previewBufferSource: AudioBufferSourceNode | null = null;
let previewPendingNext: string | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function getPreviewAudioContext(): AudioContext {
  if (!previewAudioContext) {
    previewAudioContext = new AudioContext();
  }
  return previewAudioContext;
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

export async function playAudioFile(filePath: string): Promise<void> {
  // Stop any currently playing audio
  stop();

  const ctx = getAudioContext();

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  // Read audio data from file
  const audioData = await readAudioFile(filePath);

  // Decode audio data
  const audioBuffer = await ctx.decodeAudioData(audioData.buffer);

  // Store buffer for seek support
  currentAudioBuffer = audioBuffer;
  pauseOffset = 0;

  // Create source node
  currentSource = ctx.createBufferSource();
  currentSource.buffer = audioBuffer;
  currentSource.connect(ctx.destination);

  // Set up onended callback
  currentSource.onended = () => {
    // Only trigger end callback if we weren't seeking/stopping
    if (isCurrentlyPlaying) {
      isCurrentlyPlaying = false;
      stopTimeUpdateTimer();
      currentSource = null;
      if (onPlaybackEndCallback) {
        onPlaybackEndCallback();
      }
    }
  };

  // Start playback
  startTime = ctx.currentTime;
  isCurrentlyPlaying = true;
  currentSource.start(0);
  startTimeUpdateTimer();
}

export async function playAudioData(data: Uint8Array): Promise<void> {
  // Stop any currently playing audio
  stop();

  const ctx = getAudioContext();

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  // Decode audio data
  const audioBuffer = await ctx.decodeAudioData(data.buffer.slice(0));

  // Store buffer for seek support
  currentAudioBuffer = audioBuffer;
  pauseOffset = 0;

  // Create source node
  currentSource = ctx.createBufferSource();
  currentSource.buffer = audioBuffer;
  currentSource.connect(ctx.destination);

  // Set up onended callback
  currentSource.onended = () => {
    // Only trigger end callback if we weren't seeking/stopping
    if (isCurrentlyPlaying) {
      isCurrentlyPlaying = false;
      stopTimeUpdateTimer();
      currentSource = null;
      if (onPlaybackEndCallback) {
        onPlaybackEndCallback();
      }
    }
  };

  // Start playback
  startTime = ctx.currentTime;
  isCurrentlyPlaying = true;
  currentSource.start(0);
  startTimeUpdateTimer();
}

export function stop(): void {
  isCurrentlyPlaying = false;
  stopTimeUpdateTimer();
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      // Ignore errors if already stopped
    }
    currentSource = null;
  }
  currentAudioBuffer = null;
  pauseOffset = 0;
}

export function pause(): void {
  if (!isCurrentlyPlaying || !currentSource) return;

  // Calculate current position
  const ctx = getAudioContext();
  pauseOffset = ctx.currentTime - startTime + pauseOffset;

  // Stop the source (but keep the buffer)
  isCurrentlyPlaying = false;
  stopTimeUpdateTimer();
  try {
    currentSource.stop();
  } catch {
    // Ignore errors if already stopped
  }
  currentSource = null;
}

export function resume(): void {
  if (isCurrentlyPlaying || !currentAudioBuffer) return;

  const ctx = getAudioContext();

  // Create new source from stored buffer
  currentSource = ctx.createBufferSource();
  currentSource.buffer = currentAudioBuffer;
  currentSource.connect(ctx.destination);

  currentSource.onended = () => {
    if (isCurrentlyPlaying) {
      isCurrentlyPlaying = false;
      stopTimeUpdateTimer();
      currentSource = null;
      if (onPlaybackEndCallback) {
        onPlaybackEndCallback();
      }
    }
  };

  // Start from pause position
  startTime = ctx.currentTime - pauseOffset;
  isCurrentlyPlaying = true;
  currentSource.start(0, pauseOffset);
  startTimeUpdateTimer();
}

export function seek(time: number): void {
  if (!currentAudioBuffer) return;

  const wasPlaying = isCurrentlyPlaying;

  // Stop current source
  if (currentSource) {
    isCurrentlyPlaying = false;
    try {
      currentSource.stop();
    } catch {
      // Ignore errors
    }
    currentSource = null;
  }

  // Clamp time to valid range
  const clampedTime = Math.max(0, Math.min(time, currentAudioBuffer.duration));

  if (wasPlaying) {
    // Resume from new position
    const ctx = getAudioContext();
    currentSource = ctx.createBufferSource();
    currentSource.buffer = currentAudioBuffer;
    currentSource.connect(ctx.destination);

    currentSource.onended = () => {
      if (isCurrentlyPlaying) {
        isCurrentlyPlaying = false;
        stopTimeUpdateTimer();
        currentSource = null;
        if (onPlaybackEndCallback) {
          onPlaybackEndCallback();
        }
      }
    };

    pauseOffset = 0;
    startTime = ctx.currentTime - clampedTime;
    isCurrentlyPlaying = true;
    currentSource.start(0, clampedTime);
    startTimeUpdateTimer();
  } else {
    // Just update the pause offset
    pauseOffset = clampedTime;
  }

  // Notify of new time
  if (onTimeUpdateCallback) {
    onTimeUpdateCallback(clampedTime);
  }
}

export function getCurrentTime(): number {
  if (!currentAudioBuffer) return 0;

  if (isCurrentlyPlaying) {
    const ctx = getAudioContext();
    return ctx.currentTime - startTime;
  }

  return pauseOffset;
}

export function getDuration(): number {
  return currentAudioBuffer?.duration ?? 0;
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
  const ctx = getAudioContext();
  const audioData = await readAudioFile(filePath);
  const audioBuffer = await ctx.decodeAudioData(audioData.buffer.slice(0));
  return audioBuffer.duration;
}

export async function getAudioDurationFromData(data: Uint8Array): Promise<number> {
  const ctx = getAudioContext();
  const audioBuffer = await ctx.decodeAudioData(data.buffer.slice(0));
  return audioBuffer.duration;
}

// Waveform generation
export async function generateWaveform(
  filePath: string,
  samples: number = 100
): Promise<number[]> {
  const ctx = getAudioContext();
  const audioData = await readAudioFile(filePath);
  const audioBuffer = await ctx.decodeAudioData(audioData.buffer.slice(0));

  return extractWaveform(audioBuffer, samples);
}

export async function generateWaveformFromData(
  data: Uint8Array,
  samples: number = 100
): Promise<number[]> {
  const ctx = getAudioContext();
  const audioBuffer = await ctx.decodeAudioData(data.buffer.slice(0));

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
  previewPendingNext = null;
  if (previewBufferSource) {
    // Remove the onended handler BEFORE stopping to prevent it from
    // triggering after we've already started a new preview
    previewBufferSource.onended = null;
    try {
      previewBufferSource.stop();
    } catch {
      // Ignore errors if already stopped
    }
    previewBufferSource = null;
  }
}

export async function playPreview(filePath: string, nextFilePath?: string): Promise<void> {
  // Stop any currently playing preview
  stopPreview();

  const ctx = getPreviewAudioContext();

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  // Store pending next file for sequential playback
  previewPendingNext = nextFilePath || null;

  // Read audio data from file
  const audioData = await readAudioFile(filePath);

  // Decode audio data
  const audioBuffer = await ctx.decodeAudioData(audioData.buffer.slice(0));

  // Create source node
  previewBufferSource = ctx.createBufferSource();
  previewBufferSource.buffer = audioBuffer;
  previewBufferSource.connect(ctx.destination);

  // Set up onended callback for sequential preview playback
  previewBufferSource.onended = () => {
    previewBufferSource = null;
    // If there's a pending next file, play it
    if (previewPendingNext) {
      const nextPath = previewPendingNext;
      previewPendingNext = null;
      playPreview(nextPath).catch(console.error);
    }
  };

  // Start playback
  previewBufferSource.start(0);
}

export function isPreviewPlaying(): boolean {
  return previewBufferSource !== null;
}
