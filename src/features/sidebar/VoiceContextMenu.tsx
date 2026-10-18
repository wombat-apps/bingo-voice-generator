import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, Pencil, Trash2 } from 'lucide-react';
import './VoiceContextMenu.css';

interface VoiceContextMenuProps {
  position: { x: number; y: number };
  hasRecordings: boolean;
  platform: string;
  onShowInFileManager: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function VoiceContextMenu({
  position,
  hasRecordings,
  platform,
  onShowInFileManager,
  onEdit,
  onDelete,
  onClose,
}: VoiceContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Get platform-aware label for "Show in Finder"
  const getShowInFileManagerLabel = useCallback(() => {
    switch (platform) {
      case 'macos':
        return 'Show in Finder';
      case 'windows':
        return 'Show in Explorer';
      default:
        return 'Open Folder';
    }
  }, [platform]);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Adjust horizontal position
    if (position.x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 8;
    }

    // Adjust vertical position
    if (position.y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 8;
    }

    menu.style.left = `${adjustedX}px`;
    menu.style.top = `${adjustedY}px`;
  }, [position]);

  const handleShowInFileManager = () => {
    onShowInFileManager();
    onClose();
  };

  const handleEdit = () => {
    onEdit();
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="voice-context-menu"
      style={{ left: position.x, top: position.y }}
    >
      <button
        type="button"
        className="voice-context-menu-item"
        onClick={handleShowInFileManager}
        disabled={!hasRecordings}
      >
        <FolderOpen size={14} />
        <span>{getShowInFileManagerLabel()}</span>
      </button>
      <button
        type="button"
        className="voice-context-menu-item"
        onClick={handleEdit}
      >
        <Pencil size={14} />
        <span>Edit</span>
      </button>
      <div className="voice-context-menu-divider" />
      <button
        type="button"
        className="voice-context-menu-item voice-context-menu-item-danger"
        onClick={handleDelete}
      >
        <Trash2 size={14} />
        <span>Delete</span>
      </button>
    </div>,
    document.body
  );
}
