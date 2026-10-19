import { SegmentedControl } from '../../components';
import type { VoiceSettings as VoiceSettingsType, StabilityPreset, TtsModelId } from '../../types';
import { STABILITY_PRESETS, TTS_MODELS } from '../../types';
import './VoiceSettings.css';

interface VoiceSettingsProps {
  settings: VoiceSettingsType;
  onChange: (settings: VoiceSettingsType) => void;
}

export function VoiceSettings({ settings, onChange }: VoiceSettingsProps) {
  const handleStabilityPreset = (preset: StabilityPreset) => {
    onChange({ ...settings, stability: STABILITY_PRESETS[preset].value });
  };

  const handleSliderChange = (key: keyof VoiceSettingsType, value: number) => {
    onChange({ ...settings, [key]: value });
  };

  const handleToggle = (key: keyof VoiceSettingsType, value: boolean) => {
    onChange({ ...settings, [key]: value });
  };

  const handleModelChange = (modelId: TtsModelId) => {
    onChange({ ...settings, modelId });
  };

  // Determine which stability preset is currently active
  const getCurrentStabilityPreset = (): StabilityPreset | null => {
    for (const [key, preset] of Object.entries(STABILITY_PRESETS)) {
      if (settings.stability === preset.value) {
        return key as StabilityPreset;
      }
    }
    return null;
  };

  const currentStabilityPreset = getCurrentStabilityPreset();

  return (
    <div className="voice-settings">
      <div className="voice-settings-content">
        {/* Stability - Segmented Control */}
        <div className="setting-group">
          <label className="setting-label">Stability</label>
          <SegmentedControl
            options={Object.entries(STABILITY_PRESETS).map(([key, preset]) => ({
              value: key as StabilityPreset,
              label: preset.label,
            }))}
            value={currentStabilityPreset || 'natural'}
            onChange={handleStabilityPreset}
          />
        </div>

        {/* Similarity Boost - Slider */}
        <div className="setting-group">
          <div className="setting-header">
            <label className="setting-label">Similarity Boost</label>
            <span className="setting-value">{settings.similarityBoost.toFixed(2)}</span>
          </div>
          <input
            type="range"
            className="slider"
            min="0"
            max="1"
            step="0.01"
            value={settings.similarityBoost}
            onChange={(e) => handleSliderChange('similarityBoost', parseFloat(e.target.value))}
          />
        </div>

        {/* Style - Slider */}
        <div className="setting-group">
          <div className="setting-header">
            <label className="setting-label">Style</label>
            <span className="setting-value">{settings.style.toFixed(2)}</span>
          </div>
          <input
            type="range"
            className="slider"
            min="0"
            max="1"
            step="0.01"
            value={settings.style}
            onChange={(e) => handleSliderChange('style', parseFloat(e.target.value))}
          />
        </div>

        {/* Speed - Slider */}
        <div className="setting-group">
          <div className="setting-header">
            <label className="setting-label">Speed</label>
            <span className="setting-value">{settings.speed.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            className="slider"
            min="0.7"
            max="1.2"
            step="0.01"
            value={settings.speed}
            onChange={(e) => handleSliderChange('speed', parseFloat(e.target.value))}
          />
        </div>

        {/* Speaker Boost - Toggle */}
        <div className="setting-group setting-row">
          <label className="setting-label">Speaker Boost</label>
          <button
            type="button"
            className={`toggle ${settings.useSpeakerBoost ? 'active' : ''}`}
            onClick={() => handleToggle('useSpeakerBoost', !settings.useSpeakerBoost)}
            aria-pressed={settings.useSpeakerBoost}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {/* TTS Model - Select */}
        <div className="setting-group">
          <label className="setting-label">TTS Model</label>
          <select
            className="select"
            value={settings.modelId}
            onChange={(e) => handleModelChange(e.target.value as TtsModelId)}
          >
            {TTS_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} - {model.description}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
