import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Eye, EyeOff, KeyRound, Pencil, Plus, Trash, X } from 'lucide-react';
import {
  confirmDeletion,
  deleteAccount,
  getAccountSubscription,
  renameAccount,
  revealAccountApiKey,
} from '../../services/tauri';
import { AddAccountModal } from './AddAccountModal';
import { SubscriptionUsage } from './SubscriptionUsage';
import type { AccountsState, ElevenLabsAccount, SubscriptionInfo } from '../../types';
import './AccountSwitcher.css';

interface AccountSwitcherProps {
  accountsState: AccountsState;
  /** The Active Account's subscription */
  subscription: SubscriptionInfo | null;
  subscriptionError: string | null;
  onAccountsChange: (state: AccountsState) => void;
  onActiveAccountChange: (accountId: string) => void;
}

function TierBadge({ tier }: { tier: string }) {
  return <span className={`subscription-tier-badge tier-badge--${tier.toLowerCase()}`}>{tier}</span>;
}

/**
 * The Active Account and its usage, anchored at the bottom of the sidebar. Its menu
 * switches, reveals, renames, deletes and adds ElevenLabs Accounts.
 */
export function AccountSwitcher({
  accountsState,
  subscription,
  subscriptionError,
  onAccountsChange,
  onActiveAccountChange,
}: AccountSwitcherProps) {
  const { accounts, activeAccountId } = accountsState;
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  // Full keys the user asked to see, read from the Keychain on demand and forgotten on close
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [tiers, setTiers] = useState<Record<string, string>>({});

  const rootRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    setRevealed({});
    setRenamingId(null);
  }, []);

  // Close on a click outside or Escape (which first cancels a rename)
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeMenu();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (renamingId) setRenamingId(null);
      else closeMenu();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, renamingId, closeMenu]);

  // Load each account's Plan once, the first time the menu shows it
  const requestedIds = useRef(new Set<string>());
  useEffect(() => {
    if (!isMenuOpen) return;
    for (const account of accounts) {
      if (requestedIds.current.has(account.id)) continue;
      requestedIds.current.add(account.id);
      getAccountSubscription(account.id)
        .then((sub) => setTiers((prev) => ({ ...prev, [account.id]: sub.tier })))
        .catch((err) => console.error(`Failed to load account "${account.name}":`, err));
    }
  }, [isMenuOpen, accounts]);

  const tierOf = (id: string) => (id === activeAccountId && subscription ? subscription.tier : tiers[id]);

  const handleSelect = (account: ElevenLabsAccount) => {
    if (renamingId) return;
    if (account.id !== activeAccountId) onActiveAccountChange(account.id);
    closeMenu();
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
    if (!renamingId || !renameValue.trim()) return;
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

  const openAdd = () => {
    closeMenu();
    setIsAddOpen(true);
  };

  const addModal = (
    <AddAccountModal
      isOpen={isAddOpen}
      onClose={() => setIsAddOpen(false)}
      onAccountsChange={onAccountsChange}
    />
  );

  if (accounts.length === 0) {
    return (
      <div className="account-switcher">
        <button type="button" className="btn btn-primary account-switcher-add" onClick={() => setIsAddOpen(true)}>
          <Plus size={14} />
          Add ElevenLabs Account
        </button>
        {addModal}
      </div>
    );
  }

  const activeTier = activeAccount ? tierOf(activeAccount.id) : undefined;

  return (
    <div className="account-switcher" ref={rootRef}>
      {isMenuOpen && (
        <div className="account-menu" role="menu">
          <ul className="account-menu-list">
            {accounts.map((account) => {
              const isActive = account.id === activeAccountId;
              const tier = tierOf(account.id);
              const key = revealed[account.id];
              const isRenaming = renamingId === account.id;
              return (
                <li
                  key={account.id}
                  className={`account-menu-item ${isActive ? 'active' : ''}`}
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => handleSelect(account)}
                >
                  <Check size={14} className="account-menu-check" />
                  <div className="account-menu-info">
                    {isRenaming ? (
                      <form
                        className="account-rename"
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleRename();
                        }}
                      >
                        <input
                          className="input"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => setRenamingId(null)}
                          autoFocus
                        />
                      </form>
                    ) : (
                      <div className="account-menu-primary">
                        <span className="account-name">{account.name}</span>
                        {tier && <TierBadge tier={tier} />}
                      </div>
                    )}
                    <span className={`account-key ${key ? 'revealed' : ''}`}>
                      {key ?? account.keyHint ?? 'No API key in the Keychain'}
                    </span>
                  </div>
                  {!isRenaming && (
                    <div className="account-menu-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm"
                        onClick={() => toggleRevealed(account.id)}
                        title={key ? 'Hide API key' : 'Show API key'}
                      >
                        {key ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm"
                        onClick={() => startRename(account)}
                        title="Rename account"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm account-menu-delete"
                        onClick={() => handleDelete(account)}
                        title="Delete account"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  )}
                  {isRenaming && (
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      title="Cancel"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(null);
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="account-menu-separator" />
          <button type="button" className="account-menu-add" role="menuitem" onClick={openAdd}>
            <Plus size={14} />
            Add Account…
          </button>
        </div>
      )}

      <button
        type="button"
        className={`account-switcher-trigger ${isMenuOpen ? 'open' : ''}`}
        onClick={() => (isMenuOpen ? closeMenu() : setIsMenuOpen(true))}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        title="ElevenLabs Account"
      >
        <KeyRound size={14} className="account-switcher-icon" />
        <span className={`account-name ${activeAccount ? '' : 'placeholder'}`}>
          {activeAccount?.name ?? 'Select an account'}
        </span>
        {activeTier && <TierBadge tier={activeTier} />}
        <ChevronsUpDown size={14} className="account-switcher-chevron" />
      </button>

      {activeAccount && <SubscriptionUsage subscription={subscription} error={subscriptionError} />}

      {addModal}
    </div>
  );
}
