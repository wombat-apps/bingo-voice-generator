import { useMemo } from 'react';
import type { BingoModeId, NumberAudioPair } from '../../types';
import { COLUMN_LETTERS, gridColumns, gridOrder } from '../../domain/bingo';
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
  const numbers = useMemo(() => gridOrder(mode), [mode]);

  return (
    <div className={`bingo-grid-container bingo-grid-container--${mode}`}>
      {mode === 'bingo75' && (
        <div className="bingo-grid-header">
          {COLUMN_LETTERS.map((letter) => (
            <div key={letter} className="bingo-letter">
              {letter}
            </div>
          ))}
        </div>
      )}

      <div
        className="bingo-grid"
        style={{
          gridTemplateColumns: `repeat(${gridColumns(mode)}, 1fr)`,
        }}
      >
        {numbers.map((number) => (
          <BingoCell
            key={number}
            number={number}
            mode={mode}
            audio={audioFiles.get(number)}
            isSelected={selectedNumber === number}
            onClick={onCellClick}
          />
        ))}
      </div>
    </div>
  );
}
