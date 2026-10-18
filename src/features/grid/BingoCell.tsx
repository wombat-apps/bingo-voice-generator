import { memo } from 'react';
import type { BingoModeId, NumberAudioPair } from '../../types';
import { displayNumber, numberStatus } from '../../domain/bingo';
import './BingoCell.css';

interface BingoCellProps {
  number: number;
  mode: BingoModeId;
  audio: NumberAudioPair | undefined;
  isSelected: boolean;
  onClick: (number: number) => void;
}

export const BingoCell = memo(function BingoCell({
  number,
  mode,
  audio,
  isSelected,
  onClick,
}: BingoCellProps) {
  const classes = ['bingo-cell', `cell-${numberStatus(number, audio)}`];
  if (isSelected) classes.push('cell-selected');

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick(number);
  };

  return (
    <button className={classes.join(' ')} onClick={handleClick} title={displayNumber(number, mode)}>
      <span className="cell-number">{number}</span>
    </button>
  );
});
