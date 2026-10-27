/**
 * Rules for generating all the Pending Audio of a Voice in a Bingo Mode (see GLOSSARY.md):
 * one file after another, retrying only what ElevenLabs asks to retry, stopping at any
 * other error.
 */

import type { AudioFile, AudioPart, BingoModeId, NumberAudioPair, PendingAudio, SubscriptionInfo } from '../../types';
import { hasDigit, maxNumber } from '../../domain/bingo';
import { isElevenLabsError } from '../../services/errors';

export type PendingPart = PendingAudio['parts'][number];

/** Waits before each retry of a busy or rate-limited request (docs/elevenlabs-plans.md). */
export const RETRY_DELAYS_MS = [2000, 4000, 8000];

/** Errors ElevenLabs asks to retry with backoff; any other stops the batch. */
export function isRetryable(err: unknown): boolean {
  return (
    isElevenLabsError(err) &&
    err.code === 'API_ERROR' &&
    (err.apiCode === 'rate_limit_exceeded' || err.apiCode === 'system_busy')
  );
}

export type BatchOutcome = { status: 'done' | 'cancelled' } | { status: 'failed'; error: unknown };

export interface BatchSteps {
  generate: (part: PendingPart) => Promise<AudioFile>;
  onGenerated: (part: PendingPart, file: AudioFile) => void;
  /** Checked before each request: a cancelled batch lets the one in flight finish. */
  isCancelled: () => boolean;
  sleep: (ms: number) => Promise<void>;
}

/** Generates `parts` in order, one at a time. */
export async function generatePending(parts: PendingPart[], steps: BatchSteps): Promise<BatchOutcome> {
  for (const part of parts) {
    for (let attempt = 0; ; attempt++) {
      if (steps.isCancelled()) return { status: 'cancelled' };
      try {
        steps.onGenerated(part, await steps.generate(part));
        break;
      } catch (error) {
        if (!isRetryable(error) || attempt >= RETRY_DELAYS_MS.length) return { status: 'failed', error };
        await steps.sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }
  return { status: 'done' };
}

/** Every audio file a Voice has in a Bingo Mode once nothing is pending. */
export function totalAudio(mode: BingoModeId): number {
  let total = 0;
  for (let number = 1; number <= maxNumber(mode); number++) total += hasDigit(number) ? 2 : 1;
  return total;
}

/** The audio files a Voice has in a Bingo Mode. */
export function generatedAudio(audioFiles: Map<number, NumberAudioPair>): number {
  let count = 0;
  for (const pair of audioFiles.values()) count += (pair.wordAudio ? 1 : 0) + (pair.digitAudio ? 1 : 0);
  return count;
}

/** `audioFiles` with `file` in place of its part. */
export function withAudio(
  audioFiles: Map<number, NumberAudioPair>,
  number: number,
  part: AudioPart,
  file: AudioFile,
): Map<number, NumberAudioPair> {
  const next = new Map(audioFiles);
  const existing = next.get(number) ?? { number, wordAudio: null, digitAudio: null };
  next.set(number, part === 'word' ? { ...existing, wordAudio: file } : { ...existing, digitAudio: file });
  return next;
}

/** What the confirmation says before generating `pending` with the Active Account. */
export function confirmationMessage(
  pending: PendingAudio,
  accountName: string,
  subscription: SubscriptionInfo | null,
): string {
  const files = pending.parts.length;
  const lines = [
    `${files} pending audio ${files === 1 ? 'file' : 'files'}, about ${pending.characters.toLocaleString('en')} characters, with the account "${accountName}".`,
  ];
  if (subscription) {
    const left = Math.max(0, subscription.characterLimit - subscription.characterCount);
    lines.push(`${left.toLocaleString('en')} characters left in its quota.`);
    if (pending.characters > left) {
      lines.push('That is more than the quota left: generating will stop when it runs out.');
    }
  }
  return lines.join('\n\n');
}
