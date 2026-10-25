import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { Voice, VoiceDetails } from '../../types';
import { updateVoice } from '../../services/tauri';
import { errorMessage } from '../../services/errors';
import { detailLabel } from '../../domain/voiceDetails';
import './VoiceModals.css';

interface EditVoiceModalProps {
  /** The Voice being edited; the modal is closed while it is null. */
  voice: Voice | null;
  onClose: () => void;
  onVoiceSaved: (voices: Voice[]) => void;
}

/** Renames a Voice and changes its gender; its Accent and Voice Details stay as they are. */
export function EditVoiceModal({ voice, onClose, onVoiceSaved }: EditVoiceModalProps) {
  const [customName, setCustomName] = useState('');
  const [formGender, setFormGender] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pre-fill with the Voice when the modal opens
  useEffect(() => {
    if (voice) {
      setCustomName(voice.customName);
      setFormGender(voice.gender);
      setFormError(null);
    }
  }, [voice]);

  const handleSave = useCallback(async () => {
    if (!voice) return;
    const trimmedName = customName.trim();
    if (!trimmedName) {
      setFormError('Custom name is required');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const updatedVoice: Voice = {
        ...voice,
        customName: trimmedName,
        gender: formGender || voice.gender,
      };
      const updatedVoices = await updateVoice(updatedVoice);
      onVoiceSaved(updatedVoices);
      onClose();
    } catch (err) {
      console.error('[EditVoiceModal] Failed to save voice:', err);
      setFormError(`Failed to save voice: ${errorMessage(err)}`);
    } finally {
      setIsSaving(false);
    }
  }, [voice, customName, formGender, onVoiceSaved, onClose]);

  if (!voice) return null;

  const isFormValid = customName.trim().length > 0;

  return (
    <div className="modal-overlay" onClick={() => !isSaving && onClose()}>
      <div className="voice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Voice</h2>
          <button type="button" className="btn btn-icon" onClick={onClose} disabled={isSaving}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body form-body">
          <div className="original-voice-info">
            <span className="original-voice-label">ElevenLabs Voice:</span>
            <span className="original-voice-name">{voice.elevenlabsName}</span>
          </div>

          {voice.details && <VoiceDetailsList details={voice.details} />}

          <div className="form-group">
            <label className="form-label" htmlFor="customName">
              Custom Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="customName"
              className="input"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Enter a custom name for this voice"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="gender">
              Gender
            </label>
            <select
              id="gender"
              className="select"
              value={formGender}
              onChange={(e) => setFormGender(e.target.value)}
            >
              <option value="">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>

          {formError && <div className="modal-error">{formError}</div>}
        </div>

        <div className="modal-footer">
          <div className="modal-footer-right">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!isFormValid || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The Voice Details ElevenLabs gave, read-only; a missing one is left out. */
function VoiceDetailsList({ details }: { details: VoiceDetails }) {
  const rows: [string, string | null][] = [
    ['ElevenLabs accent', details.elevenlabsAccent],
    ['Age', details.age],
    ['Use case', details.useCase],
    ['Description', details.description],
  ];
  const shown = rows.filter((row): row is [string, string] => !!row[1]);
  if (shown.length === 0) return null;
  return (
    <dl className="voice-details">
      {shown.map(([label, value]) => (
        <div key={label} className="voice-details-row">
          <dt>{label}</dt>
          <dd>{detailLabel(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
