import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { AccentId, AudioPart, BingoModeId, Formats } from '../../types';
import { previewFormat, saveFormat } from '../../services/tauri';
import { errorMessage } from '../../services/errors';

/** The format being written: `id` is `null` for a new one. */
export interface FormatDraft {
  id: string | null;
  format: string;
}

interface FormatModalProps {
  draft: FormatDraft | null;
  accent: AccentId;
  part: AudioPart;
  mode: BingoModeId;
  previewNumber: number;
  formats: Formats;
  onClose: () => void;
  /** Called with the formats after saving, where the saved one is selected. */
  onSaved: (formats: Formats) => void;
}

/** Adds or edits a Word Format or a Digit Format, previewing it as it is written. */
export function FormatModal({
  draft,
  accent,
  part,
  mode,
  previewNumber,
  formats,
  onClose,
  onSaved,
}: FormatModalProps) {
  const [format, setFormat] = useState('');
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Start from the draft every time it opens
  useEffect(() => {
    if (!draft) return;
    setFormat(draft.format);
    setSaveError(null);
  }, [draft]);

  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    previewFormat(accent, part, mode, previewNumber, format)
      .then((text) => {
        if (cancelled) return;
        setPreview(text);
        setPreviewError(null);
      })
      .catch((err) => !cancelled && setPreviewError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [draft, accent, part, mode, previewNumber, format]);

  useEffect(() => {
    if (!draft) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [draft, isSaving, onClose]);

  if (!draft) return null;

  const handleSave = async () => {
    if (previewError !== null || isSaving) return;
    setIsSaving(true);
    try {
      onSaved(await saveFormat(accent, part, mode, draft.id, format));
      onClose();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const title = `${draft.id ? 'Edit' : 'New'} ${part === 'word' ? 'Word' : 'Digit'} Format`;

  return (
    <div className="modal-overlay" onClick={() => !isSaving && onClose()}>
      <div className="format-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose} title="Close" disabled={isSaving}>
            <X size={16} />
          </button>
        </div>
        <form
          className="format-modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <input
            className="input format-input"
            placeholder={formats.defaultFormat}
            value={format}
            onChange={(e) => {
              setFormat(e.target.value);
              setSaveError(null);
            }}
            autoFocus
          />
          <p className="format-hint">{formats.placeholders.join(', ')}</p>
          {previewError ? (
            <p className="format-error">{previewError}</p>
          ) : (
            <p className="format-preview">{preview}</p>
          )}
          {saveError && <p className="format-error">{saveError}</p>}
          <div className="format-modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={previewError !== null || isSaving}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
