/**
 * The Bingo Mode rules the UI needs (see GLOSSARY.md). They mirror `BingoMode` in
 * src-tauri/src/models/bingo_mode.rs and `AudioPart::exists_for` in audio_part.rs.
 */

import type { BingoModeId, NumberAudioPair } from '../types';

export const COLUMN_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;

const NUMBERS_PER_COLUMN = 15;

export function maxNumber(mode: BingoModeId): number {
  return mode === 'bingo90' ? 90 : 75;
}

/** Columns of the grid: Bingo 75 has one per letter. */
export function gridColumns(mode: BingoModeId): number {
  return mode === 'bingo90' ? 10 : COLUMN_LETTERS.length;
}

/** The numbers in the order the grid fills its rows: Bingo 75 goes down its columns. */
export function gridOrder(mode: BingoModeId): number[] {
  if (mode === 'bingo90') {
    return Array.from({ length: maxNumber(mode) }, (_, i) => i + 1);
  }
  const result: number[] = [];
  for (let row = 0; row < NUMBERS_PER_COLUMN; row++) {
    for (let column = 0; column < COLUMN_LETTERS.length; column++) {
      result.push(column * NUMBERS_PER_COLUMN + row + 1);
    }
  }
  return result;
}

/** The Bingo 75 letter of `number` (`'N'` for 45), or undefined outside 1–75, like `BingoMode::column` in Rust. */
export function columnLetter(number: number): string | undefined {
  if (number < 1) return undefined;
  return COLUMN_LETTERS[Math.floor((number - 1) / NUMBERS_PER_COLUMN)];
}

/** How a caller names the number: `'N45'` in Bingo 75, `'45'` in Bingo 90. */
export function displayNumber(number: number, mode: BingoModeId): string {
  return mode === 'bingo75' ? `${columnLetter(number) ?? ''}${number}` : number.toString();
}

/** Numbers below 10 have no Digit: their Word is enough. */
export function hasDigit(number: number): boolean {
  return number >= 10;
}

export type NumberStatus = 'complete' | 'partial' | 'empty';

/** Complete when it has its Word and, if it has one, its Digit. */
export function numberStatus(number: number, pair: NumberAudioPair | undefined): NumberStatus {
  const word = !!pair?.wordAudio;
  const digit = !!pair?.digitAudio;
  if (word && (digit || !hasDigit(number))) return 'complete';
  if (word || digit) return 'partial';
  return 'empty';
}
