import { useMemo } from 'react';
import type { BingoModeId, NumberAudioPair } from '../../types';
import { BingoCell } from './BingoCell';
import './BingoGrid.css';

interface BingoGridProps {
  mode: BingoModeId;
  audioFiles: Map<number, NumberAudioPair>;
  selectedNumber: number | null;
  onCellClick: (number: number) => void;
}

export function BingoGrid({
  mode,
  audioFiles,
  selectedNumber,
  onCellClick,
}: BingoGridProps) {
  const gridConfig = useMemo(() => {
    return mode === 'bingo90'
      ? { maxNumber: 90, columns: 10 }
      : { maxNumber: 75, columns: 5 };
  }, [mode]);

  const numbers = useMemo(() => {
    if (mode === 'bingo90') {
      // Bingo 90: sequential order
      return Array.from({ length: 90 }, (_, i) => i + 1);
    }

    // Bingo 75: order by columns (B-I-N-G-O)
    // Each column has 15 numbers
    const numbersPerColumn = 15;
    const columns = 5;
    const result: number[] = [];

    for (let row = 0; row < numbersPerColumn; row++) {
      for (let col = 0; col < columns; col++) {
        result.push(col * numbersPerColumn + row + 1);
      }
    }

    return result;
  }, [mode]);

  const bingo75Letters = ['B', 'I', 'N', 'G', 'O'];

  return (
    <div className={`bingo-grid-container bingo-grid-container--${mode}`}>
      {mode === 'bingo75' && (
        <div className="bingo-grid-header">
          {bingo75Letters.map((letter) => (
            <div key={letter} className="bingo-letter">
              {letter}
            </div>
          ))}
        </div>
      )}

      <div
        className="bingo-grid"
        style={{
          gridTemplateColumns: `repeat(${gridConfig.columns}, 1fr)`,
        }}
      >
        {numbers.map((number) => {
          const audioPair = audioFiles.get(number);
          return (
            <BingoCell
              key={number}
              number={number}
              mode={mode}
              hasWord={!!audioPair?.wordAudio}
              hasDigit={!!audioPair?.digitAudio}
              isSelected={selectedNumber === number}
              onClick={onCellClick}
            />
          );
        })}
      </div>
    </div>
  );
}
