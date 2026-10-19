import { useState, useCallback } from 'react';
import { EighthNotes, Star, Play } from 'lucide-react';
import { AccountSwitcher } from '../accounts';
import { VoiceContextMenu } from './VoiceContextMenu';
import { unavailableReason as planUnavailableReason } from '../../domain/plan';
import { detailLabel } from '../../domain/voiceDetails';
import { groupVoicesByKind } from '../../domain/voiceList';
import type { AccountsState, Accent, Voice, VoiceKind, AccentId, SubscriptionInfo as SubscriptionInfoType } from '../../types';
import './Sidebar.css';

/** The header over each kind of Voice, in ElevenLabs' terms (see GLOSSARY.md). */
const VOICE_GROUP_TITLES: Record<VoiceKind, { title: string; hint: string }> = {
  default: { title: 'Default', hint: 'any plan' },
  library: { title: 'Library', hint: 'paid plans' },
};

interface SidebarProps {
  accents: Accent[];
  voices: Voice[];
  selectedAccent: AccentId;
  selectedVoice: Voice | null;
  hasApiKey: boolean;
  accountsState: AccountsState;
  subscription: SubscriptionInfoType | null;
  subscriptionError: string | null;
  voiceHasRecordings: Map<string, boolean>;
  platform: string;
  onAccentChange: (accent: AccentId) => void;
  onAccountsChange: (state: AccountsState) => void;
  onActiveAccountChange: (accountId: string) => void;
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
  subscriptionError,
  voiceHasRecordings,
  platform,
  onAccentChange,
  onAccountsChange,
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

  const voiceGroups = groupVoicesByKind(voices.filter((v) => v.accent === selectedAccent));
  const currentAccent = accents.find((l) => l.id === selectedAccent);

  const renderVoice = (voice: Voice) => {
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
          <span className="voice-badges">
            <span className={`badge badge-${voice.gender}`}>{voice.gender}</span>
            {voice.details?.elevenlabsAccent && (
              <span className="badge badge-accent" title="ElevenLabs accent">
                {detailLabel(voice.details.elevenlabsAccent)}
              </span>
            )}
          </span>
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
  };

  return (
    <div className="sidebar">
      <div className="sidebar-section sidebar-top">
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

      <div className="sidebar-section sidebar-voices">
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
          {voiceGroups.length === 0 ? (
            <p className="text-muted text-center">
              No voices for {currentAccent?.displayName || selectedAccent}.
              <br />
              Click "Add Voice" to get started.
            </p>
          ) : (
            voiceGroups.map((group) =>
              group.kind ? (
                <div key={group.kind} className="voice-group">
                  <div className="voice-group-header">
                    <span>{VOICE_GROUP_TITLES[group.kind].title}</span>
                    <span className="voice-group-hint">{VOICE_GROUP_TITLES[group.kind].hint}</span>
                  </div>
                  {group.voices.map(renderVoice)}
                </div>
              ) : (
                <div key="unknown" className="voice-group">
                  {group.voices.map(renderVoice)}
                </div>
              )
            )
          )}
        </div>
      </div>

      {/* Active Account and its subscription - anchored at bottom */}
      <div className="sidebar-account">
        <AccountSwitcher
          accountsState={accountsState}
          subscription={subscription}
          subscriptionError={subscriptionError}
          onAccountsChange={onAccountsChange}
          onActiveAccountChange={onActiveAccountChange}
        />
      </div>

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
