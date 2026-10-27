import { useCallback, useRef, useState } from 'react';
import type { AccentId, AudioFile, BingoModeId, SubscriptionInfo, Voice, VoiceSettings } from '../../types';
import { confirmGeneration, generateAudio, pendingAudio } from '../../services/tauri';
import { confirmationMessage, generatePending, type PendingPart } from './pending';

export interface PendingProgress {
  /** Files generated so far in this batch. */
  done: number;
  total: number;
  isCancelling: boolean;
}

interface Options {
  accent: AccentId;
  voice: Voice | null;
  mode: BingoModeId;
  settings: VoiceSettings;
  accountName: string;
  subscription: SubscriptionInfo | null;
  onGenerated: (part: PendingPart, file: AudioFile) => void;
  onError: (err: unknown) => void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Generates the Pending Audio of the selected Voice and Bingo Mode after the user confirms.
 * `progress` is null when no batch is running; the app locks what it generates with meanwhile.
 */
export function usePendingGeneration({
  accent,
  voice,
  mode,
  settings,
  accountName,
  subscription,
  onGenerated,
  onError,
}: Options) {
  const [progress, setProgress] = useState<PendingProgress | null>(null);
  const runningRef = useRef(false);
  const cancelledRef = useRef(false);

  const start = useCallback(async () => {
    if (!voice || runningRef.current) return;
    runningRef.current = true;
    try {
      const pending = await pendingAudio(accent, voice, mode);
      if (pending.parts.length === 0) return;
      const confirmed = await confirmGeneration(
        'Generate Pending Audio',
        confirmationMessage(pending, accountName, subscription),
      );
      if (!confirmed) return;

      cancelledRef.current = false;
      setProgress({ done: 0, total: pending.parts.length, isCancelling: false });
      const outcome = await generatePending(pending.parts, {
        generate: ({ number, part }) => generateAudio(number, voice, mode, part, settings),
        onGenerated: (part, file) => {
          onGenerated(part, file);
          setProgress((p) => p && { ...p, done: p.done + 1 });
        },
        isCancelled: () => cancelledRef.current,
        sleep,
      });
      if (outcome.status === 'failed') {
        console.error('Failed to generate the Pending Audio:', outcome.error);
        onError(outcome.error);
      }
    } catch (err) {
      console.error('Failed to list the Pending Audio:', err);
      onError(err);
    } finally {
      runningRef.current = false;
      setProgress(null);
    }
  }, [accent, voice, mode, settings, accountName, subscription, onGenerated, onError]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setProgress((p) => p && { ...p, isCancelling: true });
  }, []);

  return { progress, start, cancel };
}
