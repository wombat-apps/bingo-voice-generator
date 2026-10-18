import { describe, expect, it } from 'vitest';
import type { AudioFile, AudioPart, NumberAudioPair } from '../../types';
import {
  initialPlayerState,
  neighbour,
  numbersWithAudio,
  playerReducer,
  playNumberEvent,
  type PlayerEvent,
  type PlayerState,
} from './player';

function file(number: number, part: AudioPart): AudioFile {
  return {
    number,
    part,
    accent: 'es-ES',
    voiceUuid: 'v',
    mode: 'bingo90',
    filePath: `/audio/${number}_${part}.mp3`,
    createdAt: '',
  };
}

function pair(number: number, parts: AudioPart[]): NumberAudioPair {
  return {
    number,
    wordAudio: parts.includes('word') ? file(number, 'word') : null,
    digitAudio: parts.includes('digit') ? file(number, 'digit') : null,
  };
}

const run = (events: PlayerEvent[], state: PlayerState = initialPlayerState) =>
  events.reduce(playerReducer, state);

describe('playing a number', () => {
  it('plays the Word, then the Digit, then stops', () => {
    const click = playNumberEvent(45, pair(45, ['word', 'digit']))!;

    const word = run([click]);
    expect(word).toMatchObject({ number: 45, part: 'word', isPlaying: true, queue: ['digit'] });

    const digit = run([{ type: 'ended' }], word);
    expect(digit).toMatchObject({ part: 'digit', isPlaying: true, queue: [] });
    expect(digit.playId).toBe(word.playId + 1);

    const done = run([{ type: 'tick', time: 0.8 }, { type: 'ended' }], digit);
    expect(done).toMatchObject({ part: 'digit', isPlaying: false });
    expect(done.times.digit).toBe(0);
  });

  it("plays the queued Digit of the number playing, even if another number is selected meanwhile", () => {
    const word = run([playNumberEvent(45, pair(45, ['word', 'digit']))!]);

    // Selecting 12 while the Word of 45 plays only resets the times
    const digit = run([{ type: 'resetTimes' }, { type: 'ended' }], word);

    expect(digit).toMatchObject({ number: 45, part: 'digit', isPlaying: true });
  });

  it('plays only the Digit when there is no Word, and nothing when there is no audio', () => {
    expect(playNumberEvent(45, pair(45, ['digit']))).toEqual({ type: 'play', number: 45, part: 'digit' });
    expect(playNumberEvent(7, pair(7, ['word']))).toMatchObject({ part: 'word', queue: [] });
    expect(playNumberEvent(45, undefined)).toBeNull();
  });

  it('keeps the time of each part apart', () => {
    const state = run([
      { type: 'play', number: 45, part: 'word', queue: ['digit'] },
      { type: 'tick', time: 1.2 },
      { type: 'ended' },
      { type: 'tick', time: 0.3 },
    ]);

    expect(state.times).toEqual({ word: 1.2, digit: 0.3 });
    expect(run([{ type: 'resetTimes' }], state).times).toEqual({ word: 0, digit: 0 });
  });

  it('drops the queue when playback fails or a part is played alone, keeps it when paused', () => {
    const queued = run([{ type: 'play', number: 45, part: 'word', queue: ['digit'] }]);

    expect(run([{ type: 'failed' }], queued)).toMatchObject({ isPlaying: false, queue: [] });
    expect(run([{ type: 'play', number: 45, part: 'word' }], queued).queue).toEqual([]);
    expect(run([{ type: 'pause' }], queued)).toMatchObject({ isPlaying: false, queue: ['digit'] });
  });

  it('forgets the number when stopped', () => {
    const state = run([{ type: 'play', number: 45, part: 'word' }, { type: 'stop' }]);

    expect(state).toMatchObject({ number: null, part: null, isPlaying: false });
  });
});

describe('navigation', () => {
  const files = new Map([
    [80, pair(80, ['word'])],
    [3, pair(3, ['word'])],
    [45, pair(45, ['digit'])],
    [50, pair(50, [])],
  ]);

  it('goes through the numbers with audio in order, wrapping around', () => {
    const numbers = numbersWithAudio(files);

    expect(numbers).toEqual([3, 45, 80]);
    expect(neighbour(numbers, 45, 1)).toBe(80);
    expect(neighbour(numbers, 80, 1)).toBe(3);
    expect(neighbour(numbers, 3, -1)).toBe(80);
    expect(neighbour(numbers, 50, 1)).toBeNull();
  });
});
