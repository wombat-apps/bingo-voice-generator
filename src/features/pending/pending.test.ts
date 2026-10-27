import { describe, expect, it, vi } from 'vitest';
import type { AudioFile, SubscriptionInfo } from '../../types';
import {
  RETRY_DELAYS_MS,
  confirmationMessage,
  generatePending,
  generatedAudio,
  totalAudio,
  type PendingPart,
} from './pending';

const file = { filePath: 'x.mp3' } as AudioFile;
const busy = { code: 'API_ERROR', status: 429, apiCode: 'system_busy', message: 'busy' };
const noCredits = { code: 'API_ERROR', status: 402, apiCode: 'insufficient_credits', message: 'no' };

const parts: PendingPart[] = [
  { number: 10, part: 'word' },
  { number: 10, part: 'digit' },
  { number: 11, part: 'word' },
];

function steps(generate: (part: PendingPart) => Promise<AudioFile>, isCancelled = () => false) {
  return {
    generate: vi.fn(generate),
    onGenerated: vi.fn(),
    isCancelled,
    sleep: vi.fn(async () => {}),
  };
}

describe('generatePending', () => {
  it('generates every part in order, one at a time', async () => {
    const s = steps(async () => file);
    expect(await generatePending(parts, s)).toEqual({ status: 'done' });
    expect(s.generate.mock.calls.map(([p]) => p)).toEqual(parts);
    expect(s.onGenerated).toHaveBeenCalledTimes(3);
  });

  it('stops at the first error that is not worth retrying, keeping what was generated', async () => {
    const s = steps(async (p) => {
      if (p.part === 'digit') throw noCredits;
      return file;
    });
    expect(await generatePending(parts, s)).toEqual({ status: 'failed', error: noCredits });
    expect(s.generate).toHaveBeenCalledTimes(2);
    expect(s.onGenerated).toHaveBeenCalledOnce();
    expect(s.sleep).not.toHaveBeenCalled();
  });

  it('retries a busy ElevenLabs with growing waits, then goes on', async () => {
    let failures = 2;
    const s = steps(async () => {
      if (failures-- > 0) throw busy;
      return file;
    });
    expect(await generatePending(parts, s)).toEqual({ status: 'done' });
    expect(s.sleep.mock.calls).toEqual([[RETRY_DELAYS_MS[0]], [RETRY_DELAYS_MS[1]]]);
  });

  it('stops when ElevenLabs is still busy after the last retry', async () => {
    const s = steps(async () => {
      throw busy;
    });
    expect(await generatePending(parts, s)).toEqual({ status: 'failed', error: busy });
    expect(s.generate).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
  });

  it('sends nothing more once cancelled, but keeps the one in flight', async () => {
    let cancelled = false;
    const s = steps(
      async () => {
        cancelled = true;
        return file;
      },
      () => cancelled,
    );
    expect(await generatePending(parts, s)).toEqual({ status: 'cancelled' });
    expect(s.generate).toHaveBeenCalledOnce();
    expect(s.onGenerated).toHaveBeenCalledOnce();
  });
});

describe('totalAudio', () => {
  it('counts every Word and the Digits from 10 up', () => {
    expect(totalAudio('bingo90')).toBe(90 + 81);
    expect(totalAudio('bingo75')).toBe(75 + 66);
  });
});

describe('generatedAudio', () => {
  it('counts the Words and Digits that exist', () => {
    const files = new Map([
      [5, { number: 5, wordAudio: file, digitAudio: null }],
      [45, { number: 45, wordAudio: file, digitAudio: file }],
    ]);
    expect(generatedAudio(files)).toBe(3);
  });
});

describe('confirmationMessage', () => {
  const pending = { parts, characters: 1200 };
  const subscription = (left: number): SubscriptionInfo => ({
    tier: 'creator',
    characterCount: 10000 - left,
    characterLimit: 10000,
    status: 'active',
    nextCharacterCountResetUnix: null,
  });

  it('says how many files, characters and the account', () => {
    expect(confirmationMessage(pending, 'Work', null)).toBe(
      '3 pending audio files, about 1,200 characters, with the account "Work".',
    );
  });

  it('adds the quota left', () => {
    expect(confirmationMessage(pending, 'Work', subscription(5000))).toContain('5,000 characters left');
    expect(confirmationMessage(pending, 'Work', subscription(5000))).not.toContain('more than the quota');
  });

  it('warns, without refusing, when the quota left is not enough', () => {
    expect(confirmationMessage(pending, 'Work', subscription(100))).toContain('more than the quota left');
  });
});
