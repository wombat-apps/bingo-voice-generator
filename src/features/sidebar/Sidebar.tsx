import { useState, useCallback } from 'react';
import { EighthNotes, Star, Play } from 'lucide-react';
import { SubscriptionInfo } from './SubscriptionInfo';
import { VoiceContextMenu } from './VoiceContextMenu';
import { unavailableReason as planUnavailableReason } from '../../domain/plan';
import type { AccountsState, Accent, Voice, AccentId, SubscriptionInfo as SubscriptionInfoType } from '../../types';
import './Sidebar.css';

interface SidebarProps {
  accents: Accent[];
  voices: Voice[];
  selectedAccent: AccentId;
  selectedVoice: Voice | null;
  hasApiKey: boolean;
  accountsState: AccountsState;
  subscription: SubscriptionInfoType | null;
  voiceHasRecordings: Map<string, boolean>;
  platform: string;
  onAccentChange: (accent: AccentId) => void;
  onActiveAccountChange: (accountId: string | null) => void;
  onVoiceChange: (voice: Voice | null) => void;
  onOpenVoiceForm: (voice?: Voice) => void;
  onToggleFavorite: (voice: Voice) => void;
  onPlayVoiceSample: (voice: Voice) => void;
  onShowVoiceInFileManager: (voice: Voice) => void;
  onDeleteVoice: (voice: Voice) => void;
}

export function Sidebar({
  accents,
  voices,
  selectedAccent,
  selectedVoice,
  hasApiKey,
  accountsState,
  subscription,
  voiceHasRecordings,
  platform,
  onAccentChange,
  onActiveAccountChange,
  onVoiceChange,
  onOpenVoiceForm,
  onToggleFavorite,
  onPlayVoiceSample,
  onShowVoiceInFileManager,
  onDeleteVoice,
}: SidebarProps) {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    voice: Voice;
    position: { x: number; y: number };
  } | null>(null);

  const handleContextMenu = useCallback((event: React.MouseEvent, voice: Voice) => {
    event.preventDefault();
    setContextMenu({
      voice,
      position: { x: event.clientX, y: event.clientY },
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Filter by Accent, then sort: favorites first, then alphabetically
  const filteredVoices = voices
    .filter((v) => v.accent === selectedAccent)
    .sort((a, b) => {
      // Favorites first
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      // Then alphabetically by custom name
      return a.customName.localeCompare(b.customName);
    });
  const currentAccent = accents.find((l) => l.id === selectedAccent);

  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <div className="form-group">
          <label className="form-label">Accent</label>
          <select
            className="select"
            value={selectedAccent}
            onChange={(e) => onAccentChange(e.target.value as AccentId)}
          >
            {accents.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.flag} {lang.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-section-title">
            <EighthNotes size={16} />
            Voices
          </h3>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onOpenVoiceForm()}
            disabled={!hasApiKey}
          >
            + Add Voice
          </button>
        </div>

        <div className="voice-list">
          {filteredVoices.length === 0 ? (
            <p className="text-muted text-center">
              No voices for {currentAccent?.displayName || selectedAccent}.
              <br />
              Click "Add Voice" to get started.
            </p>
          ) : (
            filteredVoices.map((voice) => {
              const unavailableReason = planUnavailableReason(voice.kind, subscription);
              return (
                <div
                  key={voice.uuid}
                  className={`voice-item ${selectedVoice?.uuid === voice.uuid ? 'active' : ''} ${unavailableReason ? 'is-unavailable' : ''}`}
                  onContextMenu={(e) => handleContextMenu(e, voice)}
                >
                  <button
                    type="button"
                    className={`btn btn-icon btn-sm voice-favorite ${voice.favorite ? 'is-favorite' : ''}`}
                    onClick={() => onToggleFavorite(voice)}
                    title={voice.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star size={14} fill={voice.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className="voice-item-content"
                    onClick={() => onVoiceChange(voice)}
                  >
                    <span className="voice-name">{voice.customName}</span>
                    <span className={`badge badge-${voice.gender}`}>{voice.gender}</span>
                    {unavailableReason && (
                      <span className="unavailable-reason">{unavailableReason}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm voice-play"
                    onClick={() => onPlayVoiceSample(voice)}
                    disabled={!voiceHasRecordings.get(voice.uuid)}
                    title={voiceHasRecordings.get(voice.uuid) ? 'Play sample' : 'No recordings'}
                  >
                    <Play size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Account and its subscription - anchored at bottom */}
      {accountsState.accounts.length > 0 && (
        <div className="sidebar-actions">
          <div className="form-group">
            <label className="form-label">ElevenLabs Account</label>
            <select
              className="select"
              value={accountsState.activeAccountId ?? ''}
              onChange={(e) => onActiveAccountChange(e.target.value || null)}
            >
              {accountsState.activeAccountId === null && (
                <option value="">Select an account…</option>
              )}
              {accountsState.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          {subscription && <SubscriptionInfo subscription={subscription} />}
        </div>
      )}

      {/* Voice context menu */}
      {contextMenu && (
        <VoiceContextMenu
          position={contextMenu.position}
          hasRecordings={voiceHasRecordings.get(contextMenu.voice.uuid) || false}
          platform={platform}
          onShowInFileManager={() => onShowVoiceInFileManager(contextMenu.voice)}
          onEdit={() => onOpenVoiceForm(contextMenu.voice)}
          onDelete={() => onDeleteVoice(contextMenu.voice)}
          onClose={handleCloseContextMenu}
        />
      )}
    </div>
  );
}
