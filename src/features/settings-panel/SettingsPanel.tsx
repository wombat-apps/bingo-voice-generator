import { useState } from 'react';
import { X, Settings, Eye, EyeOff, Check } from 'lucide-react';
import { VoiceSettings } from '../sidebar/VoiceSettings';
import type { VoiceSettings as VoiceSettingsType } from '../../types';
import './SettingsPanel.css';

interface SettingsPanelProps {
  isOpen: boolean;
  apiKey: string;
  hasApiKey: boolean;
  voiceSettings: VoiceSettingsType;
  onClose: () => void;
  onApiKeyChange: (apiKey: string) => void;
  onApiKeySave: () => void;
  onVoiceSettingsChange: (settings: VoiceSettingsType) => void;
}

export function SettingsPanel({
  isOpen,
  apiKey,
  hasApiKey,
  voiceSettings,
  onClose,
  onApiKeyChange,
  onApiKeySave,
  onVoiceSettingsChange,
}: SettingsPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false);

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
          {/* API Key Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">API Key</h3>
            <div className="api-key-section">
              <div className="api-key-input-wrapper">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="input"
                  placeholder="Enter ElevenLabs API key..."
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                />
                <div className="api-key-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                    title={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={onApiKeySave}
                    disabled={!apiKey}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div className={`api-key-status ${hasApiKey ? 'saved' : 'not-saved'}`}>
                {hasApiKey ? (
                  <>
                    <Check size={12} />
                    <span>API key saved</span>
                  </>
                ) : (
                  <span>No API key configured</span>
                )}
              </div>
            </div>
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
