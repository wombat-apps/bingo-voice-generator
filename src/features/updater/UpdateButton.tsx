import { useEffect, useRef, useState } from 'react';
import { ArrowDownCircle } from 'lucide-react';
import type { UpdateInfo } from '../../types';
import { installBlockedReason, truncateNotes } from './update';
import './UpdateButton.css';

const MAX_NOTES_LENGTH = 400;

interface UpdateButtonProps {
  update: UpdateInfo;
  isGenerating: boolean;
  isInstalling: boolean;
  onInstall: () => void;
  onLater: () => void;
}

/** "Update to X" in the header, with a popover to install the update or leave it for later. */
export function UpdateButton({ update, isGenerating, isInstalling, onInstall, onLater }: UpdateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const notes = truncateNotes(update.notes, MAX_NOTES_LENGTH);
  const blockedReason = installBlockedReason({ isGenerating, isInstalling });

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="update-button">
      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <ArrowDownCircle size={14} />
        Update to {update.version}
      </button>
      {isOpen && (
        <div className="update-popover" role="dialog" aria-label={`Update to ${update.version}`}>
          <div className="update-popover-title">Version {update.version} is available</div>
          {notes && <p className="update-popover-notes">{notes}</p>}
          <div className="update-popover-actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={onLater}>
              Later
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onInstall}
              disabled={blockedReason !== null}
              title={blockedReason ?? undefined}
            >
              Install and Restart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
