import { X, Settings } from 'lucide-react';
import { VoiceSettings } from '../sidebar/VoiceSettings';
import { AccountsSection } from './AccountsSection';
import type { AccountsState, VoiceSettings as VoiceSettingsType } from '../../types';
import './SettingsPanel.css';

interface SettingsPanelProps {
  isOpen: boolean;
  accountsState: AccountsState;
  voiceSettings: VoiceSettingsType;
  onClose: () => void;
  onAccountsChange: (state: AccountsState) => void;
  onVoiceSettingsChange: (settings: VoiceSettingsType) => void;
}

export function SettingsPanel({
  isOpen,
  accountsState,
  voiceSettings,
  onClose,
  onAccountsChange,
  onVoiceSettingsChange,
}: SettingsPanelProps) {
  return (
    <aside className={`settings-panel ${isOpen ? 'open' : ''}`}>
        <header className="settings-panel-header">
          <h2 className="settings-panel-title">
            <Settings size={18} />
            ElevenLabs Settings
          </h2>
          <button
            type="button"
            className="settings-panel-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </header>

        <div className="settings-panel-content">
          {/* ElevenLabs Accounts */}
          <section className="settings-section">
            <h3 className="settings-section-title">ElevenLabs Accounts</h3>
            <AccountsSection accountsState={accountsState} onAccountsChange={onAccountsChange} />
          </section>

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
