import { X, SlidersVertical } from 'lucide-react';
import { VoiceSettings } from '../sidebar/VoiceSettings';
import type { VoiceSettings as VoiceSettingsType } from '../../types';
import './SettingsPanel.css';

interface SettingsPanelProps {
  isOpen: boolean;
  voiceSettings: VoiceSettingsType;
  onClose: () => void;
  onVoiceSettingsChange: (settings: VoiceSettingsType) => void;
}

export function SettingsPanel({
  isOpen,
  voiceSettings,
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

        <div className="settings-panel-content">
          {/* Voice Settings */}
          <section className="settings-section">
            <VoiceSettings
              settings={voiceSettings}
              onChange={onVoiceSettingsChange}
            />
          </section>
        </div>
    </aside>
  );
}
