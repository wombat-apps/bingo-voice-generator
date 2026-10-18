import { describe, expect, it } from 'vitest';
import { columnLetter, displayNumber, gridOrder, hasDigit, numberStatus } from './bingo';

describe('Bingo Mode rules', () => {
  it('splits Bingo 75 into five columns of fifteen, like BingoMode in Rust', () => {
    expect([1, 15, 16, 45, 46, 75].map(columnLetter)).toEqual(['B', 'B', 'I', 'N', 'G', 'O']);
    expect(displayNumber(45, 'bingo75')).toBe('N45');
    expect(displayNumber(45, 'bingo90')).toBe('45');
  });

  it('fills the Bingo 75 grid down its columns', () => {
    expect(gridOrder('bingo75').slice(0, 6)).toEqual([1, 16, 31, 46, 61, 2]);
    expect(gridOrder('bingo90')).toHaveLength(90);
  });

  it('only needs a Digit from 10 up', () => {
    expect(hasDigit(9)).toBe(false);
    expect(hasDigit(10)).toBe(true);
  });

  it('marks a number complete with its Word and, if it has one, its Digit', () => {
    const audio = { filePath: '', number: 0, part: 'word', accent: 'es-ES', voiceUuid: '', mode: 'bingo90', createdAt: '' } as const;
    const word = { number: 45, wordAudio: audio, digitAudio: null };

    expect(numberStatus(45, word)).toBe('partial');
    expect(numberStatus(7, { ...word, number: 7 })).toBe('complete');
    expect(numberStatus(45, { ...word, digitAudio: audio })).toBe('complete');
    expect(numberStatus(45, undefined)).toBe('empty');
  });
});
