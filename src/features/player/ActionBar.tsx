import { useEffect, useState } from 'react';
import { Play, Pause, Volume2, SkipBack, SkipForward, FileAudio, RefreshCw, Trash2 } from 'lucide-react';
import type { AudioPart, BingoModeId } from '../../types';
import { generateWaveform } from '../../services/audioPlayer';
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
            title={hasAudio ? `Regenerate ${type}` : `Generate ${type}`}
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
  filePath: string | null;
  isPlaying: boolean;
  hasWord: boolean;
  hasDigit: boolean;
  needsDigit: boolean;
  currentTime: number;
  duration: number;
  // Dual panel state
  wordFilePath: string | null;
  digitFilePath: string | null;
  wordDuration: number;
  digitDuration: number;
  wordCurrentTime: number;
  digitCurrentTime: number;
  // Playback actions
  onPlay: () => void;
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSwitchPart: (part: AudioPart) => void;
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
  apiKeyConfigured: boolean;
  voiceSelected: boolean;
  // Audio state for selected number (may differ from playing number)
  selectedHasWord: boolean;
  selectedHasDigit: boolean;
  selectedNeedsDigit: boolean;
}

function getBingo75Letter(number: number): string {
  if (number >= 1 && number <= 15) return 'B';
  if (number >= 16 && number <= 30) return 'I';
  if (number >= 31 && number <= 45) return 'N';
  if (number >= 46 && number <= 60) return 'G';
  return 'O';
}

export function ActionBar({
  selectedNumber,
  playingNumber,
  playingPart,
  mode,
  isPlaying,
  // Dual panel state
  wordFilePath,
  digitFilePath,
  wordDuration,
  digitDuration,
  wordCurrentTime,
  digitCurrentTime,
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
  apiKeyConfigured,
  voiceSelected,
  selectedHasWord,
  selectedHasDigit,
  selectedNeedsDigit,
}: ActionBarProps) {
  // Determine button states
  const canGenerate = apiKeyConfigured && voiceSelected && selectedNumber !== null;

  // Format display number for selected cell
  const displayNumber = selectedNumber !== null
    ? (mode === 'bingo75'
        ? `${getBingo75Letter(selectedNumber)}${selectedNumber}`
        : selectedNumber.toString())
    : null;

  // Labels for panels
  const wordLabel = displayNumber ? `${displayNumber}-W` : 'W';
  const digitLabel = displayNumber ? `${displayNumber}-D` : 'D';

  // Empty state
  if (selectedNumber === null && playingNumber === null) {
    return (
      <div className="action-bar empty">
        <Volume2 size={20} className="text-muted" />
        <span className="text-muted">Click a cell to select it</span>
      </div>
    );
  }

  // Single panel layout for Bingo90 or numbers < 10 (no digit needed)
  if (!selectedNeedsDigit) {
    return (
      <div className="action-bar action-bar-single">
        <div className="action-bar-single-content">
          <div className="action-bar-info">
            <span className="action-bar-number">{displayNumber}</span>
            <span className={`part-indicator ${selectedHasWord ? 'available' : 'unavailable'}`}>
              WORD
            </span>
          </div>

          <PartPanel
            type="word"
            label={displayNumber || 'W'}
            filePath={wordFilePath}
            duration={wordDuration}
            currentTime={wordCurrentTime}
            isPlaying={isPlaying}
            isActive={playingPart === 'word'}
            hasAudio={selectedHasWord}
            isGenerating={isGeneratingWord}
            canGenerate={canGenerate}
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
          filePath={wordFilePath}
          duration={wordDuration}
          currentTime={wordCurrentTime}
          isPlaying={isPlaying}
          isActive={playingPart === 'word'}
          hasAudio={selectedHasWord}
          isGenerating={isGeneratingWord}
          canGenerate={canGenerate}
          onGenerate={onGenerateWord}
          onPlay={onPlayWord}
          onPause={onPause}
          onSeek={onSeek}
          onDelete={() => onDelete('word')}
        />

        <PartPanel
          type="digit"
          label={digitLabel}
          filePath={digitFilePath}
          duration={digitDuration}
          currentTime={digitCurrentTime}
          isPlaying={isPlaying}
          isActive={playingPart === 'digit'}
          hasAudio={selectedHasDigit}
          isGenerating={isGeneratingDigit}
          canGenerate={canGenerate}
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
