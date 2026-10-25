import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Play, Square, Check, Search, User, Users, Star, Plus } from 'lucide-react';
import type { SharedVoice, LibraryVoiceSort, AccentId, SubscriptionInfo, Voice, VoiceKind } from '../../types';
import { searchLibraryVoices, createVoice, addLibraryVoice, listDefaultVoices } from '../../services/tauri';
import { errorMessage, isSharingDisabled, SHARING_DISABLED_MESSAGE } from '../../services/errors';
import { unavailableReason as planUnavailableReason, worksOnEveryPlan } from '../../domain/plan';
import './VoiceModals.css';

const SORT_OPTIONS: { value: LibraryVoiceSort; label: string }[] = [
  { value: 'trending', label: 'Trending' },
  { value: 'cloned_by_count', label: 'Most added' },
  { value: 'usage_character_count_1y', label: 'Most used' },
  { value: 'created_date', label: 'Newest' },
];

/** How long typing must pause before the text is searched. */
const SEARCH_DELAY_MS = 400;

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// Extended type for combined voice list
interface VoiceOption extends SharedVoice {
  kind: VoiceKind;
}

interface AddVoicesModalProps {
  isOpen: boolean;
  currentAccent: AccentId;
  /** Every Voice in the app: an ElevenLabs voice already added in the current Accent cannot be added again. */
  voices: Voice[];
  /** Searches again when the Active Account changes. */
  activeAccountId: string | null;
  subscription: SubscriptionInfo | null;
  onClose: () => void;
  /** Called after each Voice is added, with every Voice in the app and the one just added. */
  onVoiceAdded: (voices: Voice[], added: Voice) => void;
}

/**
 * Searches the Default Voices and the Voice Library, and adds a Voice with one click per row,
 * named and gendered as ElevenLabs has it; it stays open to add more. Edit Voice renames it later.
 */
export function AddVoicesModal({
  isOpen,
  currentAccent,
  voices,
  activeAccountId,
  subscription,
  onClose,
  onVoiceAdded,
}: AddVoicesModalProps) {
  // The Voices of the current Accent by ElevenLabs voice: one can be added at most once per Accent
  const addedVoices = new Map(
    voices.filter((v) => v.accent === currentAccent).map((v) => [v.elevenlabsId, v])
  );

  // Search state
  const [searchResults, setSearchResults] = useState<VoiceOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // The Voice Library has no voices under the Accent's label, so results span its Language
  const [wholeLanguage, setWholeLanguage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('');
  // Orders only the Library Voices: Default Voices stay first, as they are
  const [sort, setSort] = useState<LibraryVoiceSort>('trending');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Adding state, per ElevenLabs voice: several can be added at once
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addedCount, setAddedCount] = useState(0);
  // create_voice reads and rewrites the whole Voice list, so Voices are created one at a time
  const createQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  // Reset when the modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setAppliedQuery('');
      setGenderFilter('');
      setSort('trending');
      setSearchResults([]);
      setWholeLanguage(false);
      setSearchError(null);
      setAddingIds(new Set());
      setAddErrors({});
      setAddedCount(0);
    }
  }, [isOpen]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

  // The text being searched: the typed text once typing pauses, or at once on Enter or Search
  const [appliedQuery, setAppliedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setAppliedQuery(searchQuery), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  // Only the latest search may show its results
  const latestSearchRef = useRef(0);

  const fetchVoices = useCallback(async () => {
    if (!activeAccountId) return;
    const query = appliedQuery;
    const searchId = ++latestSearchRef.current;

    setIsSearching(true);
    setSearchError(null);

    try {
      // Fetch both Default Voices and Library Voices in parallel
      const [defaultVoices, sharedResponse] = await Promise.all([
        listDefaultVoices(currentAccent, genderFilter || undefined),
        searchLibraryVoices(
          currentAccent,
          genderFilter || undefined,
          query || undefined,
          sort,
          50
        ),
      ]);

      // Convert Default Voices to VoiceOption format
      const defaultOptions: VoiceOption[] = defaultVoices
        .filter((v) => !query || v.name.toLowerCase().includes(query.toLowerCase()))
        .map((v) => ({
          ...v,
          language: null,
          locale: null,
          category: 'premade',
          publicOwnerId: null,
          clonedByCount: null,
          featured: null,
          kind: 'default',
        }));

      // Convert shared voices to VoiceOption format
      if (searchId !== latestSearchRef.current) return;

      const sharedOptions: VoiceOption[] = sharedResponse.voices.map((v) => ({
        ...v,
        kind: 'library',
      }));

      // Combine: Default Voices first (free), then Library Voices
      setSearchResults([...defaultOptions, ...sharedOptions]);
      setWholeLanguage(sharedResponse.wholeLanguage);
    } catch (err) {
      if (searchId !== latestSearchRef.current) return;
      setSearchError(`Failed to fetch voices: ${errorMessage(err)}`);
      setSearchResults([]);
      setWholeLanguage(false);
    } finally {
      if (searchId === latestSearchRef.current) setIsSearching(false);
    }
  }, [currentAccent, activeAccountId, genderFilter, sort, appliedQuery]);

  // Searches the typed text now, or searches again when it is already the applied one
  const searchNow = () => {
    if (searchQuery === appliedQuery) fetchVoices();
    else setAppliedQuery(searchQuery);
  };

  // Search again when the modal opens and whenever the text, the gender filter or the order changes
  useEffect(() => {
    if (isOpen) {
      fetchVoices();
    }
  }, [isOpen, fetchVoices]);

  const handlePreview = useCallback(
    (voiceOption: VoiceOption) => {
      if (!voiceOption.previewUrl) return;

      // Stop current playback
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }

      if (playingVoiceId === voiceOption.voiceId) {
        setPlayingVoiceId(null);
        return;
      }

      const audio = new Audio(voiceOption.previewUrl);
      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);
      audio.play();

      setAudioElement(audio);
      setPlayingVoiceId(voiceOption.voiceId);
    },
    [audioElement, playingVoiceId]
  );

  const handleAdd = useCallback(async (voiceOption: VoiceOption) => {
    const id = voiceOption.voiceId;
    setAddingIds((ids) => new Set(ids).add(id));
    setAddErrors((errors) => {
      const next = { ...errors };
      delete next[id];
      return next;
    });

    try {
      let voiceIdToUse = id;

      // Save Library Voices in the account so they stay usable during the notice period if
      // their owner stops sharing them. Not needed to use them, and voice ids are the same in
      // every account (docs/elevenlabs-plans.md), so a failure is only logged, except a voice
      // its owner stopped sharing: generating fails too, so it is not added. Skipped when the
      // Plan cannot use them: ElevenLabs saves the voice on its own the first time an account
      // whose Plan allows it generates with it.
      if (voiceOption.kind === 'library' && !planUnavailableReason(voiceOption.kind, subscription)) {
        if (!voiceOption.publicOwnerId) {
          console.error('[AddVoicesModal] Library Voice has no public owner ID, not saving it in the account');
        } else {
          try {
            voiceIdToUse = await addLibraryVoice(voiceOption.publicOwnerId, id, voiceOption.name);
          } catch (err) {
            console.error('[AddVoicesModal] Failed to save the Library Voice in the account:', err);
            if (isSharingDisabled(err)) {
              setAddErrors((errors) => ({ ...errors, [id]: SHARING_DISABLED_MESSAGE }));
              return;
            }
          }
        }
      }

      // Create the Voice, named and gendered as ElevenLabs has it
      const created = createQueueRef.current.then(() =>
        createVoice(
          voiceIdToUse,
          voiceOption.name,
          voiceOption.name,
          currentAccent,
          voiceOption.gender || 'unknown',
          voiceOption.kind,
          {
            elevenlabsAccent: voiceOption.accent,
            age: voiceOption.age,
            description: voiceOption.description,
            useCase: voiceOption.useCase,
          }
        )
      );
      createQueueRef.current = created.catch(() => undefined);
      const updatedVoices = await created;
      const added = updatedVoices.find(
        (v) => v.accent === currentAccent && v.elevenlabsId === voiceIdToUse
      );
      if (added) {
        onVoiceAdded(updatedVoices, added);
        setAddedCount((count) => count + 1);
      }
    } catch (err) {
      console.error('[AddVoicesModal] Failed to add voice:', err);
      setAddErrors((errors) => ({ ...errors, [id]: `Failed to add voice: ${errorMessage(err)}` }));
    } finally {
      setAddingIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    }
  }, [currentAccent, subscription, onVoiceAdded]);

  const handleClose = useCallback(() => {
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    setPlayingVoiceId(null);
    onClose();
  }, [audioElement, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="voice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Voice</h2>
          <button type="button" className="btn btn-icon" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-filters">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="input search-input"
              placeholder="Search voices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') searchNow();
              }}
            />
          </div>

          <select
            className="select gender-select"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
          >
            <option value="">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="neutral">Neutral</option>
          </select>

          <select
            className="select sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as LibraryVoiceSort)}
            title="Order of the Library Voices"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={searchNow}
            disabled={isSearching}
          >
            {isSearching ? 'Loading...' : 'Search'}
          </button>
        </div>

        {searchError && <div className="modal-error">{searchError}</div>}
        {wholeLanguage && !searchError && (
          <div className="modal-warning">
            The Voice Library has no voices labelled with this accent. Showing every Library
            Voice in the language: check each one's accent tag and preview.
          </div>
        )}

        <div className="modal-body">
          {isSearching && searchResults.length === 0 ? (
            <div className="modal-loading">Loading voices...</div>
          ) : searchResults.length === 0 ? (
            <div className="modal-empty">
              {appliedQuery
                ? 'No voices in this language match your search. Try a different search.'
                : 'No voices found for this accent. Try a different search.'}
            </div>
          ) : (
            <div className="voice-picker-list">
              {searchResults.map((voiceOption) => {
                const addedVoice = addedVoices.get(voiceOption.voiceId);
                const isAdding = addingIds.has(voiceOption.voiceId);
                const addError = addErrors[voiceOption.voiceId];
                // Already added: the Plan only matters when generating with the Voice
                const unavailableReason = addedVoice
                  ? null
                  : planUnavailableReason(voiceOption.kind, subscription);
                return (
                  <div
                    key={voiceOption.voiceId}
                    className={`voice-picker-item ${unavailableReason ? 'is-unavailable' : ''} ${addedVoice ? 'is-added' : ''}`}
                  >
                    <div className="voice-picker-info">
                      <div className="voice-picker-avatar">
                        <User size={20} />
                      </div>
                      <div className="voice-picker-details">
                        <span className="voice-picker-name">
                          {voiceOption.name}
                          {voiceOption.featured && (
                            <span className="badge badge-featured" title="Featured by ElevenLabs">
                              <Star size={10} />
                              Featured
                            </span>
                          )}
                        </span>
                        <span className="voice-picker-meta">
                          {voiceOption.gender && <span className={`badge badge-${voiceOption.gender}`}>{voiceOption.gender}</span>}
                          {voiceOption.accent && <span className="voice-tag">{voiceOption.accent}</span>}
                          {voiceOption.age && <span className="voice-tag">{voiceOption.age}</span>}
                          {voiceOption.clonedByCount != null && (
                            <span
                              className="voice-added-by"
                              title={`Added by ${voiceOption.clonedByCount.toLocaleString('en')} ElevenLabs users`}
                            >
                              <Users size={12} />
                              {compactNumber.format(voiceOption.clonedByCount)}
                            </span>
                          )}
                          {worksOnEveryPlan(voiceOption.kind) && (
                            <span className="badge badge-default" title="Default Voice: works on every ElevenLabs Plan">Default</span>
                          )}
                        </span>
                        {unavailableReason && (
                          <span className="unavailable-reason">{unavailableReason}</span>
                        )}
                        {addedVoice && addedVoice.customName !== voiceOption.name && (
                          <span className="added-as">Added as {addedVoice.customName}</span>
                        )}
                        {addError && <span className="voice-row-error">{addError}</span>}
                        {voiceOption.description && (
                          <span className="voice-picker-description">{voiceOption.description}</span>
                        )}
                      </div>
                    </div>
                    <div className="voice-picker-actions">
                      {voiceOption.previewUrl && (
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          onClick={() => handlePreview(voiceOption)}
                          title="Preview voice"
                        >
                          {playingVoiceId === voiceOption.voiceId ? (
                            <Square size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
                      )}
                      {addedVoice ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled
                          title="Already added in this accent"
                        >
                          <Check size={14} />
                          Added
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAdd(voiceOption)}
                          disabled={isAdding}
                        >
                          <Plus size={14} />
                          {isAdding ? 'Adding...' : 'Add'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {addedCount > 0 && (
            <span className="added-count">
              {addedCount} {addedCount === 1 ? 'voice' : 'voices'} added
            </span>
          )}
          <div className="modal-footer-right">
            <button type="button" className="btn btn-primary" onClick={handleClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
