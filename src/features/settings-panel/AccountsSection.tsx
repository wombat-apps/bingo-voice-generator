import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Pencil, Trash, Check, X } from 'lucide-react';
import {
  addAccount,
  confirmDeletion,
  deleteAccount,
  getAccountSubscription,
  renameAccount,
  revealAccountApiKey,
} from '../../services/tauri';
import { errorMessage } from '../../services/errors';
import type { AccountsState, ApiKeyPermission, ElevenLabsAccount } from '../../types';
import '../sidebar/SubscriptionInfo.css';

interface AccountsSectionProps {
  accountsState: AccountsState;
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

export function AccountsSection({ accountsState, onAccountsChange }: AccountsSectionProps) {
  const { accounts, activeAccountId } = accountsState;

  const [newName, setNewName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [showNewApiKey, setShowNewApiKey] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [permissionWarning, setPermissionWarning] = useState<PermissionWarning | null>(null);

  // Full keys the user asked to see, read from the Keychain on demand
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [tiers, setTiers] = useState<Record<string, string>>({});

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Load each account's plan tier once
  const requestedIds = useRef(new Set<string>());
  useEffect(() => {
    for (const account of accounts) {
      if (requestedIds.current.has(account.id)) continue;
      requestedIds.current.add(account.id);
      getAccountSubscription(account.id)
        .then((sub) => setTiers((prev) => ({ ...prev, [account.id]: sub.tier })))
        .catch((err) => console.error(`Failed to load account "${account.name}":`, err));
    }
  }, [accounts]);

  const handleAdd = async () => {
    setIsAdding(true);
    setAddError(null);
    setPermissionWarning(null);
    try {
      const { state, missingPermissions } = await addAccount(newName, newApiKey);
      if (missingPermissions.length > 0) {
        setPermissionWarning({ accountName: newName.trim(), missingPermissions });
      }
      setNewName('');
      setNewApiKey('');
      setShowNewApiKey(false);
      onAccountsChange(state);
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setIsAdding(false);
    }
  };

  const toggleRevealed = async (id: string) => {
    if (revealed[id]) {
      setRevealed(({ [id]: _hidden, ...rest }) => rest);
      return;
    }
    try {
      const key = await revealAccountApiKey(id);
      setRevealed((prev) => ({ ...prev, [id]: key }));
    } catch (err) {
      console.error('Failed to read the API key:', err);
    }
  };

  const startRename = (account: ElevenLabsAccount) => {
    setRenamingId(account.id);
    setRenameValue(account.name);
  };

  const handleRename = async () => {
    if (!renamingId) return;
    try {
      onAccountsChange(await renameAccount(renamingId, renameValue));
      setRenamingId(null);
    } catch (err) {
      console.error('Failed to rename account:', err);
    }
  };

  const handleDelete = async (account: ElevenLabsAccount) => {
    const confirmed = await confirmDeletion(
      'Delete Account',
      `Are you sure you want to delete the account "${account.name}"?\n\nIts API key will be removed from the Keychain.`
    );
    if (!confirmed) return;
    try {
      onAccountsChange(await deleteAccount(account.id));
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  return (
    <div className="accounts-section">
      {accounts.length === 0 ? (
        <p className="accounts-empty">No accounts saved</p>
      ) : (
        <ul className="accounts-list">
          {accounts.map((account) => {
            const key = revealed[account.id];
            const tier = tiers[account.id];
            const isActive = account.id === activeAccountId;
            return (
              <li key={account.id} className={`account-item ${isActive ? 'active' : ''}`}>
                <div className="account-item-info">
                  {renamingId === account.id ? (
                    <form
                      className="account-rename"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRename();
                      }}
                    >
                      <input
                        className="input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="btn btn-icon btn-sm" title="Save name" disabled={!renameValue.trim()}>
                        <Check size={14} />
                      </button>
                      <button type="button" className="btn btn-icon btn-sm" title="Cancel" onClick={() => setRenamingId(null)}>
                        <X size={14} />
                      </button>
                    </form>
                  ) : (
                    <div className="account-item-primary">
                      <span className="account-name">{account.name}</span>
                      {tier && (
                        <span className={`subscription-tier-badge tier-badge--${tier.toLowerCase()}`}>{tier}</span>
                      )}
                      {isActive && <span className="account-active-label">Active</span>}
                    </div>
                  )}
                  <span className="account-key">
                    {key ?? account.keyHint ?? '…'}
                  </span>
                </div>
                {renamingId !== account.id && (
                  <div className="account-item-actions">
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      onClick={() => toggleRevealed(account.id)}
                      title={key ? 'Hide API key' : 'Show API key'}
                    >
                      {key ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button type="button" className="btn btn-icon btn-sm" onClick={() => startRename(account)} title="Rename account">
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="btn btn-icon btn-sm" onClick={() => handleDelete(account)} title="Delete account">
                      <Trash size={14} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="account-add"
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
      >
        <input
          className="input"
          placeholder="Account name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <div className="api-key-input-wrapper">
          <input
            type={showNewApiKey ? 'text' : 'password'}
            className="input"
            placeholder="ElevenLabs API key..."
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
          />
          <div className="api-key-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-icon"
              onClick={() => setShowNewApiKey(!showNewApiKey)}
              title={showNewApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showNewApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!newName.trim() || !newApiKey.trim() || isAdding}
            >
              {isAdding ? 'Checking…' : 'Add'}
            </button>
          </div>
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
        {permissionWarning && (
          <div className="account-add-warning" role="alert">
            <div className="account-add-warning-header">
              <span>
                La cuenta "{permissionWarning.accountName}" se ha guardado, pero a su API key le faltan
                permisos:
              </span>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                title="Cerrar aviso"
                onClick={() => setPermissionWarning(null)}
              >
                <X size={14} />
              </button>
            </div>
            <ul>
              {permissionWarning.missingPermissions.map((permission) => (
                <li key={permission}>
                  <code>{permission}</code>: {PERMISSION_EFFECTS[permission]}.
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}
