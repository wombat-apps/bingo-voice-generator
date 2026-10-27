import { AudioLines } from 'lucide-react';
import type { BingoModeId } from '../../types';
import type { PendingProgress } from './usePendingGeneration';
import './PendingHeader.css';

interface PendingHeaderProps {
  mode: BingoModeId;
  /** Audio files the Voice has in the Bingo Mode, and how many it has once nothing is pending. */
  generated: number;
  total: number;
  progress: PendingProgress | null;
  /** Why the Pending Audio cannot be generated now, shown as the button's tooltip. */
  disabledReason: string | null;
  onGenerate: () => void;
  onCancel: () => void;
}

export function PendingHeader({ mode, generated, total, progress, disabledReason, onGenerate, onCancel }: PendingHeaderProps) {
  return (
    <div className={`pending-header pending-header--${mode}`}>
      <span className="pending-header-count">
        {generated} / {total} audio files
      </span>
      {progress ? (
        <>
          <span className="pending-header-progress">
            <span className="spinner-small" />
            Generating {Math.min(progress.done + 1, progress.total)} of {progress.total}…
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
            disabled={progress.isCancelling}
            title="Let the file in progress finish and stop"
          >
            {progress.isCancelling ? 'Cancelling…' : 'Cancel'}
          </button>
        </>
      ) : (
        generated < total && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onGenerate}
            disabled={disabledReason !== null}
            title={disabledReason ?? 'Generate every Word and Digit still missing, one after another'}
          >
            <AudioLines size={14} />
            Generate Pending
          </button>
        )
      )}
    </div>
  );
}
