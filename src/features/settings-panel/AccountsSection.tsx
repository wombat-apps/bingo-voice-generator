import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Pencil, Trash2, Check, X } from 'lucide-react';
import {
  addAccount,
  deleteAccount,
  getAccountApiKey,
  getSubscription,
  renameAccount,
} from '../../services/tauri';
import { errorMessage } from '../../services/errors';
import type { AccountsState, ElevenLabsAccount } from '../../types';
import '../sidebar/SubscriptionInfo.css';

interface AccountsSectionProps {
  accountsState: AccountsState;
  onAccountsChange: (state: AccountsState) => void;
}

function maskApiKey(apiKey: string): string {
  return `••••${apiKey.slice(-4)}`;
}

export function AccountsSection({ accountsState, onAccountsChange }: AccountsSectionProps) {
  const { accounts, activeAccountId } = accountsState;

  const [newName, setNewName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [showNewApiKey, setShowNewApiKey] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Keys loaded from the Keychain, and which ones are unmasked
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [tiers, setTiers] = useState<Record<string, string>>({});

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Load each account's key and plan tier once
  const requestedIds = useRef(new Set<string>());
  useEffect(() => {
    for (const account of accounts) {
      if (requestedIds.current.has(account.id)) continue;
      requestedIds.current.add(account.id);
      getAccountApiKey(account.id)
        .then(async (key) => {
          setApiKeys((prev) => ({ ...prev, [account.id]: key }));
          const sub = await getSubscription(key);
          setTiers((prev) => ({ ...prev, [account.id]: sub.tier }));
        })
        .catch((err) => console.error(`Failed to load account "${account.name}":`, err));
    }
  }, [accounts]);

  const handleAdd = async () => {
    setIsAdding(true);
    setAddError(null);
    try {
      const state = await addAccount(newName, newApiKey);
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

  const toggleRevealed = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    const confirmed = window.confirm(
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
            const key = apiKeys[account.id];
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
                    {key ? (revealed.has(account.id) ? key : maskApiKey(key)) : '…'}
                  </span>
                </div>
                {renamingId !== account.id && (
                  <div className="account-item-actions">
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      onClick={() => toggleRevealed(account.id)}
                      title={revealed.has(account.id) ? 'Hide API key' : 'Show API key'}
                      disabled={!key}
                    >
                      {revealed.has(account.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button type="button" className="btn btn-icon btn-sm" onClick={() => startRename(account)} title="Rename account">
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="btn btn-icon btn-sm" onClick={() => handleDelete(account)} title="Delete account">
                      <Trash2 size={14} />
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
        {addError && <div className="account-add-error">{addError}</div>}
      </form>
    </div>
  );
}
