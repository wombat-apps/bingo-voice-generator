import { memo } from 'react';
import type { BingoModeId } from '../../types';
import './BingoCell.css';

interface BingoCellProps {
  number: number;
  mode: BingoModeId;
  hasWord: boolean;
  hasDigit: boolean;
  isSelected: boolean;
  onClick: (number: number) => void;
}

function getBingo75Letter(number: number): string {
  if (number >= 1 && number <= 15) return 'B';
  if (number >= 16 && number <= 30) return 'I';
  if (number >= 31 && number <= 45) return 'N';
  if (number >= 46 && number <= 60) return 'G';
  return 'O';
}

export const BingoCell = memo(function BingoCell({
  number,
  mode,
  hasWord,
  hasDigit,
  isSelected,
  onClick,
}: BingoCellProps) {
  const displayNumber = mode === 'bingo75'
    ? `${getBingo75Letter(number)}${number}`
    : number.toString();

  const getCellClass = () => {
    const classes = ['bingo-cell'];

    // Numbers below 10 have no Digit: their Word is enough.
    const needsDigit = number >= 10;
    if (hasWord && (hasDigit || !needsDigit)) {
      classes.push('cell-complete');
    } else if (hasWord || hasDigit) {
      classes.push('cell-partial');
    } else {
      classes.push('cell-empty');
    }

    if (isSelected) {
      classes.push('cell-selected');
    }

    return classes.join(' ');
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick(number);
  };

  return (
    <button
      className={getCellClass()}
      onClick={handleClick}
      title={`${displayNumber}`}
    >
      <span className="cell-number">{number}</span>
    </button>
  );
});
