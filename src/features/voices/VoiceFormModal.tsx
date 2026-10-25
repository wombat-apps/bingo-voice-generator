import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Play, Square, Check, Search, User, ArrowLeft, Users, Star } from 'lucide-react';
import type { SharedVoice, LibraryVoiceSort, AccentId, SubscriptionInfo, Voice, VoiceDetails, VoiceKind } from '../../types';
import { searchLibraryVoices, createVoice, updateVoice, addLibraryVoice, listDefaultVoices } from '../../services/tauri';
import { errorMessage, isSharingDisabled, SHARING_DISABLED_MESSAGE } from '../../services/errors';
import { detailLabel } from '../../domain/voiceDetails';
import { unavailableReason as planUnavailableReason, worksOnEveryPlan } from '../../domain/plan';
import './VoiceFormModal.css';

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

interface VoiceFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  voice: Voice | null;
  currentAccent: AccentId;
  /** Every Voice in the app: an ElevenLabs voice already added in the current Accent cannot be picked again. */
  voices: Voice[];
  /** Searches again when the Active Account changes. */
  activeAccountId: string | null;
  subscription: SubscriptionInfo | null;
  onClose: () => void;
  onVoiceSaved: (voices: Voice[]) => void;
}

type AddStep = 'search' | 'form';

export function VoiceFormModal({
  isOpen,
  mode,
  voice,
  currentAccent,
  voices,
  activeAccountId,
  subscription,
  onClose,
  onVoiceSaved,
}: VoiceFormModalProps) {
  // The Voices of the current Accent by ElevenLabs voice: one can be added at most once per Accent
  const addedVoices = new Map(
    voices.filter((v) => v.accent === currentAccent).map((v) => [v.elevenlabsId, v])
  );

  // Search state (add mode)
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

  // Add mode step state
  const [addStep, setAddStep] = useState<AddStep>('search');
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption | null>(null);

  // Form state
  const [customName, setCustomName] = useState('');
  const [formGender, setFormGender] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize form state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && voice) {
        // Edit mode: pre-fill with existing voice data
        setCustomName(voice.customName);
        setFormGender(voice.gender);
        setAddStep('form');
      } else {
        // Add mode: reset to search step
        setAddStep('search');
        setSelectedVoice(null);
        setCustomName('');
        setFormGender('');
        setSearchQuery('');
        setAppliedQuery('');
        setGenderFilter('');
        setSort('trending');
        setSearchResults([]);
        setWholeLanguage(false);
      }
      setFormError(null);
      setSearchError(null);
    }
  }, [isOpen, mode, voice]);

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
    if (isOpen && mode === 'add') {
      fetchVoices();
    }
  }, [isOpen, mode, fetchVoices]);

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

  // Why the Active Account's Plan cannot generate with the selected voice, or null if it can
  const selectedUnavailableReason = selectedVoice
    ? planUnavailableReason(selectedVoice.kind, subscription)
    : null;

  const handleSelectVoice = useCallback((voiceOption: VoiceOption) => {
    setSelectedVoice(voiceOption);
    setCustomName(voiceOption.name);
    setFormGender(voiceOption.gender || 'unknown');
    setAddStep('form');
  }, []);

  const handleBack = useCallback(() => {
    setAddStep('search');
    setFormError(null);
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedName = customName.trim();
    if (!trimmedName) {
      setFormError('Custom name is required');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (mode === 'add' && selectedVoice) {
        let voiceIdToUse = selectedVoice.voiceId;

        // Save Library Voices in the account so they stay usable during the notice period if
        // their owner stops sharing them. Not needed to use them, and voice ids are the same in
        // every account (docs/elevenlabs-plans.md), so a failure is only logged, except a voice
        // its owner stopped sharing: generating fails too, so it is not added. Skipped when the
        // Plan cannot use them: ElevenLabs saves the voice on its own the first time an account
        // whose Plan allows it generates with it.
        if (selectedVoice.kind === 'library' && !selectedUnavailableReason) {
          if (!selectedVoice.publicOwnerId) {
            console.error('[VoiceFormModal] Library Voice has no public owner ID, not saving it in the account');
          } else {
            try {
              voiceIdToUse = await addLibraryVoice(
                selectedVoice.publicOwnerId,
                selectedVoice.voiceId,
                trimmedName
              );
            } catch (err) {
              console.error('[VoiceFormModal] Failed to save the Library Voice in the account:', err);
              if (isSharingDisabled(err)) {
                setFormError(SHARING_DISABLED_MESSAGE);
                return;
              }
            }
          }
        }

        // Create local voice record
        const updatedVoices = await createVoice(
          voiceIdToUse,
          selectedVoice.name,
          trimmedName,
          currentAccent,
          formGender || 'unknown',
          selectedVoice.kind,
          {
            elevenlabsAccent: selectedVoice.accent,
            age: selectedVoice.age,
            description: selectedVoice.description,
            useCase: selectedVoice.useCase,
          }
        );
        onVoiceSaved(updatedVoices);
      } else if (mode === 'edit' && voice) {
        // Update existing voice (keep its Accent)
        const updatedVoice: Voice = {
          ...voice,
          customName: trimmedName,
          gender: formGender || voice.gender,
        };
        const updatedVoices = await updateVoice(updatedVoice);
        onVoiceSaved(updatedVoices);
      }
      handleClose();
    } catch (err) {
      console.error('[VoiceFormModal] Failed to save voice:', err);
      setFormError(`Failed to save voice: ${errorMessage(err)}`);
    } finally {
      setIsSaving(false);
    }
  }, [mode, selectedVoice, voice, customName, currentAccent, formGender, onVoiceSaved, selectedUnavailableReason]);

  const handleClose = useCallback(() => {
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    setPlayingVoiceId(null);
    setSearchQuery('');
    setAppliedQuery('');
    setGenderFilter('');
    setSort('trending');
    setAddStep('search');
    setSelectedVoice(null);
    setFormError(null);
    setSearchError(null);
    onClose();
  }, [audioElement, onClose]);

  const isFormValid = customName.trim().length > 0;

  if (!isOpen) return null;

  const showSearchStep = mode === 'add' && addStep === 'search';
  const showFormStep = mode === 'edit' || addStep === 'form';

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="voice-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'add' ? 'Add Voice' : 'Edit Voice'}
          </h2>
          <button type="button" className="btn btn-icon" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {mode === 'add' && (
          <div className="step-indicator">
            <div className={`step ${addStep === 'search' ? 'active' : 'completed'}`}>
              <span className="step-number">{addStep === 'form' ? <Check size={14} /> : '1'}</span>
              <span className="step-label">Select Voice</span>
            </div>
            <div className="step-divider" />
            <div className={`step ${addStep === 'form' ? 'active' : ''}`}>
              <span className="step-number">2</span>
              <span className="step-label">Customize</span>
            </div>
          </div>
        )}

        {showSearchStep && (
          <>
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
                              onClick={() => handleSelectVoice(voiceOption)}
                            >
                              Select
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {showFormStep && (
          <>
            <div className="modal-body form-body">
              {mode === 'add' && selectedVoice && (
                <div className="original-voice-info">
                  <span className="original-voice-label">ElevenLabs Voice:</span>
                  <span className="original-voice-name">{selectedVoice.name}</span>
                </div>
              )}

              {mode === 'add' && selectedUnavailableReason && (
                <div className="modal-warning">
                  {selectedUnavailableReason}: podrás añadirla, pero no generar audio con ella
                  mientras la cuenta activa esté en el plan Free.
                </div>
              )}

              {mode === 'edit' && voice && (
                <div className="original-voice-info">
                  <span className="original-voice-label">ElevenLabs Voice:</span>
                  <span className="original-voice-name">{voice.elevenlabsName}</span>
                </div>
              )}

              {mode === 'edit' && voice?.details && <VoiceDetailsList details={voice.details} />}

              <div className="form-group">
                <label className="form-label" htmlFor="customName">
                  Custom Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="customName"
                  className="input"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter a custom name for this voice"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="gender">
                  Gender
                </label>
                <select
                  id="gender"
                  className="select"
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value)}
                >
                  <option value="">Unknown</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>

              {formError && <div className="modal-error">{formError}</div>}
            </div>

            <div className="modal-footer">
              {mode === 'add' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleBack}
                  disabled={isSaving}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              <div className="modal-footer-right">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClose}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!isFormValid || isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The Voice Details ElevenLabs gave, read-only; a missing one is left out. */
function VoiceDetailsList({ details }: { details: VoiceDetails }) {
  const rows: [string, string | null][] = [
    ['ElevenLabs accent', details.elevenlabsAccent],
    ['Age', details.age],
    ['Use case', details.useCase],
    ['Description', details.description],
  ];
  const shown = rows.filter((row): row is [string, string] => !!row[1]);
  if (shown.length === 0) return null;
  return (
    <dl className="voice-details">
      {shown.map(([label, value]) => (
        <div key={label} className="voice-details-row">
          <dt>{label}</dt>
          <dd>{detailLabel(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
