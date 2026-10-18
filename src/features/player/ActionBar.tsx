import { useEffect, useState } from 'react';
import { Play, Pause, Volume2, SkipBack, SkipForward, FileAudio, RefreshCw, Trash2 } from 'lucide-react';
import type { AudioPart, BingoModeId } from '../../types';
import { generateWaveform } from '../../services/audioPlayer';
import { displayNumber } from '../../domain/bingo';
import type { PlayerPanel } from './usePlayer';
import { WaveformSlider } from './WaveformSlider';
import './ActionBar.css';

// PartPanel - Independent panel for word or digit with waveform and controls
interface PartPanelProps {
  type: 'word' | 'digit';
  label: string;
  filePath: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  isActive: boolean;
  hasAudio: boolean;
  isGenerating: boolean;
  canGenerate: boolean;
  /** Shown as the generate button's tooltip instead of the default one. */
  generateDisabledReason: string | null;
  onGenerate: () => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onDelete: () => void;
}

function PartPanel({
  type,
  label,
  filePath,
  duration,
  currentTime,
  isPlaying,
  isActive,
  hasAudio,
  isGenerating,
  canGenerate,
  generateDisabledReason,
  onGenerate,
  onPlay,
  onPause,
  onSeek,
  onDelete,
}: PartPanelProps) {
  const [waveform, setWaveform] = useState<number[]>([]);

  useEffect(() => {
    if (filePath) {
      generateWaveform(filePath, 40)
        .then(setWaveform)
        .catch(console.error);
    } else {
      setWaveform([]);
    }
  }, [filePath]);

  const panelClass = `part-panel part-panel-${type} ${isActive ? 'active' : ''} ${hasAudio ? 'has-audio' : ''}`;

  return (
    <div className={panelClass}>
      <div className="part-panel-header">
        <span className="part-panel-label">{type === 'word' ? 'WORD' : 'DIGIT'}</span>
        <span className="part-panel-badge">{label}</span>
      </div>

      <div className="part-panel-content">
        <div className="part-panel-waveform">
          {hasAudio ? (
            <WaveformSlider
              waveform={waveform}
              progress={duration > 0 ? currentTime / duration : 0}
              duration={duration}
              currentTime={currentTime}
              isPlaying={isPlaying && isActive}
              onSeek={onSeek}
            />
          ) : (
            <div className="waveform-placeholder-small">
              <span className="text-muted">No audio</span>
            </div>
          )}
        </div>

        <div className="part-panel-controls">
          {isPlaying && isActive ? (
            <button className="btn btn-icon btn-xs" onClick={onPause} title="Pause" disabled={!hasAudio}>
              <Pause size={18} />
            </button>
          ) : (
            <button className="btn btn-icon btn-xs" onClick={onPlay} title="Play" disabled={!hasAudio}>
              <Play size={18} />
            </button>
          )}
          <button
            className="btn btn-icon btn-xs"
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
            title={generateDisabledReason ?? (hasAudio ? `Regenerate ${type}` : `Generate ${type}`)}
          >
            {isGenerating ? (
              <span className="spinner-small" />
            ) : hasAudio ? (
              <RefreshCw size={18} />
            ) : (
              <FileAudio size={18} />
            )}
          </button>
          <button className="btn btn-icon btn-xs btn-delete" onClick={onDelete} title={`Delete ${type}`} disabled={!hasAudio || isGenerating}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActionBarProps {
  // Selection state
  selectedNumber: number | null;
  // Playback state
  playingNumber: number | null;
  playingPart: AudioPart | null;
  mode: BingoModeId;
  isPlaying: boolean;
  // The selected number's Word and Digit
  word: PlayerPanel;
  digit: PlayerPanel;
  // Playback actions
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  canNavigate: boolean;
  // Dual panel playback actions
  onPlayWord: () => void;
  onPlayDigit: () => void;
  // Generation actions
  onGenerateWord: () => void;
  onGenerateDigit: () => void;
  onDelete: (part: AudioPart | 'all') => void;
  // State for action buttons
  isGeneratingWord: boolean;
  isGeneratingDigit: boolean;
  /** Why the Active Account cannot generate at all (none, or no key), or null. */
  accountUnavailableReason: string | null;
  voiceSelected: boolean;
  /** Why the Active Account's Plan cannot generate with the selected Voice, or null. */
  voiceUnavailableReason: string | null;
  // Audio state for selected number (may differ from playing number)
  selectedHasWord: boolean;
  selectedHasDigit: boolean;
  selectedNeedsDigit: boolean;
}

export function ActionBar({
  selectedNumber,
  playingNumber,
  playingPart,
  mode,
  isPlaying,
  word,
  digit,
  // Playback actions
  onPause,
  onPrevious,
  onNext,
  onSeek,
  canNavigate,
  // Dual panel playback actions
  onPlayWord,
  onPlayDigit,
  // Generation actions
  onGenerateWord,
  onGenerateDigit,
  onDelete,
  isGeneratingWord,
  isGeneratingDigit,
  accountUnavailableReason,
  voiceSelected,
  voiceUnavailableReason,
  selectedHasWord,
  selectedHasDigit,
  selectedNeedsDigit,
}: ActionBarProps) {
  // Determine button states
  const canGenerate =
    accountUnavailableReason === null && voiceSelected && voiceUnavailableReason === null && selectedNumber !== null;

  // Format display number for selected cell
  const selectedLabel = selectedNumber !== null ? displayNumber(selectedNumber, mode) : null;

  // Labels for panels
  const wordLabel = selectedLabel ? `${selectedLabel}-W` : 'W';
  const digitLabel = selectedLabel ? `${selectedLabel}-D` : 'D';

  // Empty state
  if (selectedNumber === null && playingNumber === null) {
    return (
      <div className="action-bar empty">
        <Volume2 size={20} className="text-muted" />
        <span className="text-muted">Click a cell to select it</span>
      </div>
    );
  }

  // Single panel layout for numbers < 10, which have no Digit
  if (!selectedNeedsDigit) {
    return (
      <div className="action-bar action-bar-single">
        <div className="action-bar-single-content">
          <div className="action-bar-info">
            <span className="action-bar-number">{selectedLabel}</span>
            <span className={`part-indicator ${selectedHasWord ? 'available' : 'unavailable'}`}>
              WORD
            </span>
          </div>

          <PartPanel
            type="word"
            label={selectedLabel || 'W'}
            filePath={word.filePath}
            duration={word.duration}
            currentTime={word.time}
            isPlaying={isPlaying}
            isActive={playingPart === 'word'}
            hasAudio={selectedHasWord}
            isGenerating={isGeneratingWord}
            canGenerate={canGenerate}
            generateDisabledReason={accountUnavailableReason ?? voiceUnavailableReason}
            onGenerate={onGenerateWord}
            onPlay={onPlayWord}
            onPause={onPause}
            onSeek={onSeek}
            onDelete={() => onDelete('word')}
          />

          <div className="action-bar-controls">
            <button
              className="btn btn-icon"
              onClick={onPrevious}
              title="Previous"
              disabled={!canNavigate}
            >
              <SkipBack size={20} />
            </button>
            <button
              className="btn btn-icon"
              onClick={onNext}
              title="Next"
              disabled={!canNavigate}
            >
              <SkipForward size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dual panel layout (Split Panels - Propuesta 3)
  return (
    <div className="action-bar action-bar-split">
      {/* Top row: Two panels side by side */}
      <div className="action-bar-panels">
        <PartPanel
          type="word"
          label={wordLabel}
          filePath={word.filePath}
          duration={word.duration}
          currentTime={word.time}
          isPlaying={isPlaying}
          isActive={playingPart === 'word'}
          hasAudio={selectedHasWord}
          isGenerating={isGeneratingWord}
          canGenerate={canGenerate}
          generateDisabledReason={accountUnavailableReason ?? voiceUnavailableReason}
          onGenerate={onGenerateWord}
          onPlay={onPlayWord}
          onPause={onPause}
          onSeek={onSeek}
          onDelete={() => onDelete('word')}
        />

        <PartPanel
          type="digit"
          label={digitLabel}
          filePath={digit.filePath}
          duration={digit.duration}
          currentTime={digit.time}
          isPlaying={isPlaying}
          isActive={playingPart === 'digit'}
          hasAudio={selectedHasDigit}
          isGenerating={isGeneratingDigit}
          canGenerate={canGenerate}
          generateDisabledReason={accountUnavailableReason ?? voiceUnavailableReason}
          onGenerate={onGenerateDigit}
          onPlay={onPlayDigit}
          onPause={onPause}
          onSeek={onSeek}
          onDelete={() => onDelete('digit')}
        />
      </div>
    </div>
  );
}
