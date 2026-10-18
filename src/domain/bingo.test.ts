import { describe, expect, it } from 'vitest';
import { columnLetter, displayNumber, gridColumns, gridOrder, hasDigit, maxNumber, numberStatus } from './bingo';

describe('Bingo Mode rules', () => {
  it('splits Bingo 75 into five columns of fifteen, like BingoMode in Rust', () => {
    expect([1, 15, 16, 45, 46, 75].map(columnLetter)).toEqual(['B', 'B', 'I', 'N', 'G', 'O']);
    expect([0, 76].map(columnLetter)).toEqual([undefined, undefined]);
    expect(displayNumber(45, 'bingo75')).toBe('N45');
    expect(displayNumber(45, 'bingo90')).toBe('45');
  });

  it('plays Bingo 90 on ten columns and Bingo 75 on one per letter', () => {
    expect([maxNumber('bingo90'), gridColumns('bingo90')]).toEqual([90, 10]);
    expect([maxNumber('bingo75'), gridColumns('bingo75')]).toEqual([75, 5]);
  });

  it('fills the Bingo 75 grid down its columns and the Bingo 90 grid along its rows', () => {
    expect(gridOrder('bingo75').slice(0, 6)).toEqual([1, 16, 31, 46, 61, 2]);
    expect(gridOrder('bingo75').slice(-2)).toEqual([60, 75]);
    expect(gridOrder('bingo90').slice(0, 11)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
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
