import { X, Trash2 } from 'lucide-react';
import type { ElevenLabsVoice } from '../../types';
import './VoiceLimitModal.css';

interface VoiceLimitModalProps {
  voices: ElevenLabsVoice[];
  onSelectVoice: (voiceId: string) => void;
  onCancel: () => void;
}

function formatDate(unixTimestamp: number | null): string {
  if (unixTimestamp === null) return 'Unknown';
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function VoiceLimitModal({
  voices,
  onSelectVoice,
  onCancel,
}: VoiceLimitModalProps) {
  // Sort voices by most recent first (createdAtUnix descending, nulls last)
  const sortedVoices = [...voices]
    .sort((a, b) => {
      if (a.createdAtUnix === null) return 1;
      if (b.createdAtUnix === null) return -1;
      return b.createdAtUnix - a.createdAtUnix;
    });

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="voice-limit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Voice Limit Reached</h2>
          <button type="button" className="btn btn-icon" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="voice-limit-description">
          <p>
            You've reached ElevenLabs' voice limit. To continue, please select a
            voice to delete:
          </p>
        </div>

        <div className="modal-body">
          {sortedVoices.length === 0 ? (
            <div className="modal-empty">
              No deletable voices found.
            </div>
          ) : (
            <div className="voice-limit-list">
              {sortedVoices.map((voice) => (
                <div key={voice.voiceId} className="voice-limit-item">
                  <div className="voice-limit-info">
                    <span className="voice-limit-name">{voice.name}</span>
                    <div className="voice-limit-meta">
                      <span className="voice-tag">{voice.category}</span>
                      <span className="voice-limit-date">
                        Created: {formatDate(voice.createdAtUnix)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => onSelectVoice(voice.voiceId)}
                    title={`Delete ${voice.name}`}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-footer-right">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
