import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Pencil, Plus, Trash } from 'lucide-react';
import type { AccentId, AudioPart, BingoModeId, Formats } from '../../types';
import { confirmDeletion, deleteFormat, listFormats, previewFormat, selectFormat } from '../../services/tauri';
import { errorMessage } from '../../services/errors';
import { FormatModal, type FormatDraft } from './FormatModal';
import './FormatSettings.css';

/** The key of the Default format in `previews`, which has no id. */
const DEFAULT_KEY = '';

/** The number previewed when none is selected, or when it has no Digit: it has one and, in
 * Bingo 75, the letter O. */
const SAMPLE_NUMBER = 75;

interface FormatSettingsProps {
  title: string;
  accent: AccentId;
  part: AudioPart;
  /** The Word's Bingo Mode; the Digit ignores it. */
  mode: BingoModeId;
  /** The number the preview shows, when one is selected in the grid. */
  number: number | null;
}

/**
 * Picks, adds, edits and deletes the Word Formats of one Bingo Mode, or the Digit Formats,
 * of the Accent's Language. The selection applies to every Voice of that Language. See
 * GLOSSARY.md.
 */
export function FormatSettings({ title, accent, part, mode, number }: FormatSettingsProps) {
  const [formats, setFormats] = useState<Formats>({
    formats: [],
    defaultFormat: '',
    placeholders: [],
    selectedId: null,
  });
  // Each format written with the previewed number, by id
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [draft, setDraft] = useState<FormatDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDraft(null);
    setIsMenuOpen(false);
    setError(null);
    listFormats(accent, part, mode)
      .then((list) => !cancelled && setFormats(list))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [accent, part, mode]);

  const hasPart = number !== null && (part === 'word' || number >= 10);
  const previewNumber = hasPart ? number : SAMPLE_NUMBER;

  useEffect(() => {
    let cancelled = false;
    const entries: [string, string | null][] = [
      [DEFAULT_KEY, null],
      ...formats.formats.map((f): [string, string] => [f.id, f.format]),
    ];
    Promise.allSettled(entries.map(([, format]) => previewFormat(accent, part, mode, previewNumber, format))).then(
      (results) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') next[entries[i][0]] = result.value;
        });
        setPreviews(next);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [accent, part, mode, previewNumber, formats.formats]);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  // Close on a click outside or Escape
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeMenu();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, closeMenu]);

  const selected = formats.formats.find((f) => f.id === formats.selectedId) ?? null;

  const run = async (action: () => Promise<Formats>) => {
    try {
      setFormats(await action());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleSelect = (id: string | null) => {
    closeMenu();
    if (id !== formats.selectedId) run(() => selectFormat(accent, part, mode, id));
  };

  const openDraft = (next: FormatDraft) => {
    closeMenu();
    setDraft(next);
  };

  const handleDelete = async (id: string, format: string) => {
    const parts = part === 'word' ? 'Words' : 'Digits';
    const confirmed = await confirmDeletion(
      'Delete format',
      `Delete ${format}? ${parts} already generated with it are kept.`
    );
    if (confirmed) await run(() => deleteFormat(accent, part, mode, id));
  };

  const rows = [
    { id: null, key: DEFAULT_KEY, format: formats.defaultFormat },
    ...formats.formats.map((f) => ({ id: f.id, key: f.id, format: f.format })),
  ];
  const selectedKey = formats.selectedId ?? DEFAULT_KEY;

  return (
    <div className="setting-group format-settings" ref={rootRef}>
      <label className="setting-label">{title}</label>

      <div className="format-picker">
        <button
          type="button"
          className={`format-trigger ${isMenuOpen ? 'open' : ''}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          <div className="format-info">
            <span className="format-text">{selected?.format ?? formats.defaultFormat}</span>
            <span className="format-sample">{previews[selectedKey]}</span>
          </div>
          <ChevronsUpDown size={14} className="format-trigger-chevron" />
        </button>

        {isMenuOpen && (
          <div className="format-menu" role="menu">
            <ul className="format-menu-list">
              {rows.map((row) => {
                const { id } = row;
                const isActive = row.key === selectedKey;
                return (
                  <li
                    key={row.key}
                    className={`format-menu-item ${isActive ? 'active' : ''}`}
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => handleSelect(id)}
                  >
                    <Check size={14} className="format-menu-check" />
                    <div className="format-info">
                      <span className="format-text">{row.format}</span>
                      <span className="format-sample">{previews[row.key]}</span>
                    </div>
                    {id !== null && (
                      <div className="format-menu-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          onClick={() => openDraft({ id, format: row.format })}
                          title="Edit format"
                          aria-label="Edit format"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-sm format-menu-delete"
                          onClick={() => {
                            closeMenu();
                            handleDelete(id, row.format);
                          }}
                          title="Delete format"
                          aria-label="Delete format"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="format-menu-separator" />
            <button
              type="button"
              className="format-menu-add"
              role="menuitem"
              onClick={() => openDraft({ id: null, format: selected?.format ?? formats.defaultFormat })}
            >
              <Plus size={14} />
              New format…
            </button>
          </div>
        )}
      </div>

      {error && <p className="format-error">{error}</p>}

      <FormatModal
        draft={draft}
        accent={accent}
        part={part}
        mode={mode}
        previewNumber={previewNumber}
        formats={formats}
        onClose={() => setDraft(null)}
        onSaved={(next) => {
          setFormats(next);
          setError(null);
        }}
      />
    </div>
  );
}
