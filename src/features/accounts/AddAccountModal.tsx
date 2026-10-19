import { useEffect, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { addAccount } from '../../services/tauri';
import { errorMessage } from '../../services/errors';
import type { AccountsState, ApiKeyPermission } from '../../types';
import './AddAccountModal.css';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountsChange: (state: AccountsState) => void;
}

/** What does not work without each checked permission. See docs/elevenlabs-plans.md. */
const PERMISSION_EFFECTS: Record<ApiKeyPermission, string> = {
  voices_read: 'no se podrán listar las voces predeterminadas ni las de la biblioteca al añadir una voz',
};

interface PermissionWarning {
  accountName: string;
  missingPermissions: ApiKeyPermission[];
}

export function AddAccountModal({ isOpen, onClose, onAccountsChange }: AddAccountModalProps) {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // Shown after saving an account whose key lacks permissions, instead of closing
  const [permissionWarning, setPermissionWarning] = useState<PermissionWarning | null>(null);

  // Start empty every time it opens
  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setApiKey('');
    setShowApiKey(false);
    setAddError(null);
    setPermissionWarning(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isAdding) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAdding, onClose]);

  if (!isOpen) return null;

  const handleAdd = async () => {
    setIsAdding(true);
    setAddError(null);
    try {
      const { state, missingPermissions } = await addAccount(name, apiKey);
      onAccountsChange(state);
      if (missingPermissions.length > 0) {
        setPermissionWarning({ accountName: name.trim(), missingPermissions });
      } else {
        onClose();
      }
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !isAdding && onClose()}>
      <div className="add-account-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add ElevenLabs Account</h2>
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose} title="Close" disabled={isAdding}>
            <X size={16} />
          </button>
        </div>

        {permissionWarning ? (
          <div className="add-account-body">
            <div className="account-add-warning" role="alert">
              <span>
                La cuenta "{permissionWarning.accountName}" se ha guardado, pero a su API key le faltan
                permisos:
              </span>
              <ul>
                {permissionWarning.missingPermissions.map((permission) => (
                  <li key={permission}>
                    <code>{permission}</code>: {PERMISSION_EFFECTS[permission]}.
                  </li>
                ))}
              </ul>
            </div>
            <div className="add-account-footer">
              <button type="button" className="btn btn-primary btn-sm" onClick={onClose} autoFocus>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            className="add-account-body"
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
          >
            <input
              className="input"
              placeholder="Account name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <div className="api-key-input-wrapper">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="input"
                placeholder="ElevenLabs API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="account-add-help">
              La API key necesita los permisos <code>text_to_speech</code> (generar audio),{' '}
              <code>voices_read</code> (listar voces), <code>voices_write</code> (guardar en la cuenta
              las voces de la biblioteca; sin él se añaden igualmente, pero sin preaviso si su autor deja
              de compartirlas) y <code>user_read</code> (ver el plan). Al añadir la cuenta solo se
              comprueban <code>user_read</code> y <code>voices_read</code>: comprobar los demás gastaría
              caracteres o guardaría una voz.
            </p>
            {addError && <div className="account-add-error">{addError}</div>}
            <div className="add-account-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={isAdding}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!name.trim() || !apiKey.trim() || isAdding}
              >
                {isAdding ? 'Checking…' : 'Add Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
