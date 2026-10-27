import { X, SlidersVertical } from 'lucide-react';
import { VoiceSettings } from '../sidebar/VoiceSettings';
import { FormatSettings } from '../formats';
import type { AccentId, VoiceSettings as VoiceSettingsType } from '../../types';
import './SettingsPanel.css';

interface SettingsPanelProps {
  isOpen: boolean;
  voiceSettings: VoiceSettingsType;
  accent: AccentId;
  /** The number selected in the grid, which the format previews show. */
  number: number | null;
  /** While the Pending Audio is generated, its settings and formats cannot change. */
  locked: boolean;
  onClose: () => void;
  onVoiceSettingsChange: (settings: VoiceSettingsType) => void;
}

export function SettingsPanel({
  isOpen,
  voiceSettings,
  accent,
  number,
  locked,
  onClose,
  onVoiceSettingsChange,
}: SettingsPanelProps) {
  return (
    <aside className={`settings-panel ${isOpen ? 'open' : ''}`}>
        <header className="settings-panel-header">
          <h2 className="settings-panel-title">
            <SlidersVertical size={18} />
            Voice Settings
          </h2>
          <button
            type="button"
            className="settings-panel-close"
            onClick={onClose}
            aria-label="Close Voice Settings"
          >
            <X size={20} />
          </button>
        </header>

        <div className={`settings-panel-content${locked ? ' is-locked' : ''}`} inert={locked}>
          {/* Voice Settings */}
          <section className="settings-section">
            <VoiceSettings
              settings={voiceSettings}
              onChange={onVoiceSettingsChange}
            />
          </section>

          {/* Word Formats and Digit Formats of the Accent's Language */}
          <section className="settings-section">
            <h3 className="settings-section-title">Formats</h3>
            <FormatSettings title="Word · Bingo 90" accent={accent} part="word" mode="bingo90" number={number} />
            <FormatSettings title="Word · Bingo 75" accent={accent} part="word" mode="bingo75" number={number} />
            <FormatSettings title="Digit" accent={accent} part="digit" mode="bingo90" number={number} />
          </section>
        </div>
    </aside>
  );
}
