import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { AudioPart, NumberAudioPair } from '../../types';
import {
  getAudioDuration,
  pause as pauseAudio,
  playAudioFile,
  seek as seekAudio,
  setOnPlaybackEnd,
  setOnTimeUpdate,
  stop as stopAudio,
} from '../../services/audioPlayer';
import {
  initialPlayerState,
  neighbour,
  numbersWithAudio,
  partFile,
  playerReducer,
  playNumberEvent,
} from './player';

export interface PlayerPanel {
  filePath: string | null;
  /** When the file was saved, so a regenerated file with the same path is told apart. */
  createdAt: string | null;
  duration: number;
  time: number;
}

interface UsePlayerOptions {
  audioFiles: Map<number, NumberAudioPair>;
  selectedNumber: number | null;
  /** Previous and Next move the selection to the number they play. */
  selectNumber: (number: number) => void;
}

/**
 * The main player: plays a number's Word then its Digit, one part, or the previous or next
 * number with audio, and reports each part of the selected number as a panel. The only
 * module that drives `services/audioPlayer.ts` (sample previews aside).
 */
export function usePlayer({ audioFiles, selectedNumber, selectNumber }: UsePlayerOptions) {
  const [state, dispatch] = useReducer(playerReducer, initialPlayerState);
  const audioFilesRef = useRef(audioFiles);
  audioFilesRef.current = audioFiles;

  useEffect(() => {
    setOnPlaybackEnd(() => dispatch({ type: 'ended' }));
    setOnTimeUpdate((time) => dispatch({ type: 'tick', time }));
    return () => {
      setOnPlaybackEnd(null);
      setOnTimeUpdate(null);
    };
  }, []);

  // Start the part the state machine asked for. A part with no file ends at once, so the
  // queue moves on.
  useEffect(() => {
    if (state.playId === 0 || state.number === null || !state.part) return;
    const filePath = partFile(audioFilesRef.current.get(state.number), state.part);
    if (!filePath) {
      dispatch({ type: 'ended' });
      return;
    }
    playAudioFile(filePath).catch((error) => {
      console.error('Failed to play audio:', error);
      dispatch({ type: 'failed' });
    });
    // Only a new playId starts playback: the files are read through the ref
  }, [state.playId]);

  // The panels show the selected number's parts, from the start
  const selectedPair = selectedNumber !== null ? audioFiles.get(selectedNumber) : undefined;
  const wordFilePath = partFile(selectedPair, 'word');
  const digitFilePath = partFile(selectedPair, 'digit');
  const [durations, setDurations] = useState<Record<AudioPart, number>>({ word: 0, digit: 0 });
  useEffect(() => {
    const load = (part: AudioPart, filePath: string | null) => {
      if (!filePath) {
        setDurations((prev) => ({ ...prev, [part]: 0 }));
        return;
      }
      getAudioDuration(filePath)
        .then((duration) => setDurations((prev) => ({ ...prev, [part]: duration })))
        .catch(console.error);
    };
    load('word', wordFilePath);
    load('digit', digitFilePath);
    dispatch({ type: 'resetTimes' });
  }, [selectedNumber, audioFiles, wordFilePath, digitFilePath]);

  const playNumber = useCallback((number: number) => {
    const event = playNumberEvent(number, audioFilesRef.current.get(number));
    if (event) dispatch(event);
  }, []);

  /** Plays one part of the selected number, alone. */
  const playPart = useCallback(
    (part: AudioPart, number: number | null = selectedNumber) => {
      if (number !== null) dispatch({ type: 'play', number, part });
    },
    [selectedNumber]
  );

  const pause = useCallback(() => {
    pauseAudio();
    dispatch({ type: 'pause' });
  }, []);

  const stop = useCallback(() => {
    stopAudio();
    dispatch({ type: 'stop' });
  }, []);

  const seek = useCallback((time: number) => {
    seekAudio(time);
    dispatch({ type: 'tick', time });
  }, []);

  const numbers = numbersWithAudio(audioFiles);
  const step = useCallback(
    (direction: -1 | 1) => {
      if (state.number === null) return;
      const target = neighbour(numbersWithAudio(audioFilesRef.current), state.number, direction);
      if (target === null) return;
      const pair = audioFilesRef.current.get(target);
      selectNumber(target);
      dispatch({ type: 'play', number: target, part: pair?.wordAudio ? 'word' : 'digit' });
    },
    [state.number, selectNumber]
  );
  const previous = useCallback(() => step(-1), [step]);
  const next = useCallback(() => step(1), [step]);

  return {
    playingNumber: state.number,
    playingPart: state.part,
    isPlaying: state.isPlaying,
    word: {
      filePath: wordFilePath,
      createdAt: selectedPair?.wordAudio?.createdAt ?? null,
      duration: durations.word,
      time: state.times.word,
    } as PlayerPanel,
    digit: {
      filePath: digitFilePath,
      createdAt: selectedPair?.digitAudio?.createdAt ?? null,
      duration: durations.digit,
      time: state.times.digit,
    } as PlayerPanel,
    canNavigate: numbers.length > 1,
    playNumber,
    playPart,
    pause,
    stop,
    seek,
    previous,
    next,
  };
}
