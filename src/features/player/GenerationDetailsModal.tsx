import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { TTS_MODELS, type GenerationDetails } from '../../types';

interface GenerationDetailsModalProps {
  /** E.g. "How N45-W was generated". */
  title: string;
  details: GenerationDetails;
  onClose: () => void;
}

/** Shows how one audio file was generated, to regenerate it the same way. Rendered in
 * `document.body`: the player is inside a transformed container, which would make the
 * fixed overlay relative to it instead of the window. */
export function GenerationDetailsModal({ title, details, onClose }: GenerationDetailsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { settings } = details;
  const model = TTS_MODELS.find((m) => m.id === settings.modelId)?.name ?? settings.modelId;
  const rows: [string, string][] = [
    ['Format', details.format],
    ['Text sent', details.text],
    ['TTS Model', model],
    ['Stability', settings.stability.toFixed(2)],
    ['Similarity', settings.similarityBoost.toFixed(2)],
    ['Style', settings.style.toFixed(2)],
    ['Speed', settings.speed.toFixed(2)],
    ['Speaker boost', settings.useSpeakerBoost ? 'On' : 'Off'],
    ['ElevenLabs voice', details.elevenlabsVoiceId],
    ['Generated', new Date(details.generatedAt).toLocaleString()],
  ];

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="generation-details-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
        <dl className="generation-details">
          {rows.map(([label, value]) => (
            <div key={label} className="generation-details-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>,
    document.body
  );
}
