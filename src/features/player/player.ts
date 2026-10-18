/**
 * The Player's state machine, kept pure so it can be tested without audio: which number and
 * part is playing, what is queued after it (the Digit after the Word), and how far each part
 * has played. `usePlayer` connects it to `services/audioPlayer.ts`.
 */

import type { AudioPart, NumberAudioPair } from '../../types';

export interface PlayerState {
  number: number | null;
  part: AudioPart | null;
  isPlaying: boolean;
  /** Parts of `number` still to play after `part`. */
  queue: AudioPart[];
  /** Seconds played of each part of the selected number. */
  times: Record<AudioPart, number>;
  /** Bumped every time a part must start playing from the beginning. */
  playId: number;
}

export type PlayerEvent =
  | { type: 'play'; number: number; part: AudioPart; queue?: AudioPart[] }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'tick'; time: number }
  | { type: 'ended' }
  | { type: 'failed' }
  | { type: 'resetTimes' };

export const initialPlayerState: PlayerState = {
  number: null,
  part: null,
  isPlaying: false,
  queue: [],
  times: { word: 0, digit: 0 },
  playId: 0,
};

export function playerReducer(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case 'play':
      return {
        ...state,
        number: event.number,
        part: event.part,
        isPlaying: true,
        queue: event.queue ?? [],
        times: { ...state.times, [event.part]: 0 },
        playId: state.playId + 1,
      };
    case 'pause':
      return { ...state, isPlaying: false };
    case 'stop':
      return { ...state, number: null, part: null, isPlaying: false, queue: [] };
    case 'tick':
      if (!state.part) return state;
      return { ...state, times: { ...state.times, [state.part]: event.time } };
    case 'ended': {
      const [next, ...rest] = state.queue;
      if (next && state.number !== null) {
        return playerReducer(state, { type: 'play', number: state.number, part: next, queue: rest });
      }
      const times = state.part ? { ...state.times, [state.part]: 0 } : state.times;
      return { ...state, isPlaying: false, queue: [], times };
    }
    case 'failed':
      return { ...state, isPlaying: false, queue: [] };
    case 'resetTimes':
      return { ...state, times: { word: 0, digit: 0 } };
  }
}

/** What a click on a number plays: its Word, then its Digit, or only whichever exists. */
export function playNumberEvent(number: number, pair: NumberAudioPair | undefined): PlayerEvent | null {
  if (pair?.wordAudio) {
    return { type: 'play', number, part: 'word', queue: pair.digitAudio ? ['digit'] : [] };
  }
  if (pair?.digitAudio) return { type: 'play', number, part: 'digit' };
  return null;
}

/** The numbers that have any audio, in order. */
export function numbersWithAudio(audioFiles: Map<number, NumberAudioPair>): number[] {
  return [...audioFiles]
    .filter(([, pair]) => pair.wordAudio || pair.digitAudio)
    .map(([number]) => number)
    .sort((a, b) => a - b);
}

/**
 * The number before (-1) or after (+1) `current` among those with audio, wrapping around,
 * or null when `current` has none.
 */
export function neighbour(numbers: number[], current: number, direction: -1 | 1): number | null {
  const index = numbers.indexOf(current);
  if (index === -1) return null;
  return numbers[(index + direction + numbers.length) % numbers.length];
}

/** The file of one part, if it has been generated. */
export function partFile(pair: NumberAudioPair | undefined, part: AudioPart): string | null {
  return (part === 'word' ? pair?.wordAudio : pair?.digitAudio)?.filePath ?? null;
}
