import { useState, useEffect, useCallback } from 'react';
import { X, Play, Square, Check, Search, User, ArrowLeft } from 'lucide-react';
import type { SharedVoice, LanguageId, Voice } from '../../types';
import { searchSharedVoices, createVoice, updateVoice, addSharedVoice, listPremadeVoices } from '../../services/tauri';
import { errorMessage } from '../../services/errors';
import './VoiceFormModal.css';

// Extended type for combined voice list
interface VoiceOption extends SharedVoice {
  isPremade: boolean;
}

interface VoiceFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  voice: Voice | null;
  currentLanguage: LanguageId;
  apiKey: string;
  onClose: () => void;
  onVoiceSaved: (voices: Voice[]) => void;
}

type AddStep = 'search' | 'form';

export function VoiceFormModal({
  isOpen,
  mode,
  voice,
  currentLanguage,
  apiKey,
  onClose,
  onVoiceSaved,
}: VoiceFormModalProps) {
  // Search state (add mode)
  const [searchResults, setSearchResults] = useState<VoiceOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('');
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
        setGenderFilter('');
        setSearchResults([]);
        fetchVoices();
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

  const fetchVoices = useCallback(async () => {
    if (!apiKey) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      // Fetch both premade and shared voices in parallel
      const [premadeVoices, sharedResponse] = await Promise.all([
        listPremadeVoices(apiKey),
        searchSharedVoices(
          currentLanguage,
          apiKey,
          genderFilter || undefined,
          searchQuery || undefined,
          50
        ),
      ]);

      // Convert premade voices to VoiceOption format
      const premadeOptions: VoiceOption[] = premadeVoices
        .filter((v) => {
          // Apply gender filter if set
          if (genderFilter) {
            const voiceGender = v.name.toLowerCase().includes('female') ? 'female' : 'male';
            if (voiceGender !== genderFilter) return false;
          }
          // Apply search filter if set
          if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
          }
          return true;
        })
        .map((v) => ({
          voiceId: v.voiceId,
          name: v.name,
          accent: null,
          gender: null,
          age: null,
          language: null,
          locale: null,
          description: null,
          previewUrl: null,
          category: v.category,
          useCase: null,
          freeUsersAllowed: true, // Premade voices are free
          publicOwnerId: null,
          isPremade: true,
        }));

      // Convert shared voices to VoiceOption format
      const sharedOptions: VoiceOption[] = sharedResponse.voices.map((v) => ({
        ...v,
        isPremade: false,
      }));

      // Combine: premade first (free), then shared
      setSearchResults([...premadeOptions, ...sharedOptions]);
    } catch (err) {
      setSearchError(`Failed to fetch voices: ${errorMessage(err)}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [currentLanguage, apiKey, genderFilter, searchQuery]);

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

        // Only call addSharedVoice for non-premade voices (library voices)
        if (!selectedVoice.isPremade) {
          if (!selectedVoice.publicOwnerId) {
            throw new Error('Voice does not have a public owner ID');
          }
          voiceIdToUse = await addSharedVoice(
            selectedVoice.publicOwnerId,
            selectedVoice.voiceId,
            trimmedName,
            apiKey
          );
        }

        // Create local voice record
        const updatedVoices = await createVoice(
          voiceIdToUse,
          selectedVoice.name,
          trimmedName,
          currentLanguage,
          formGender || 'unknown'
        );
        onVoiceSaved(updatedVoices);
      } else if (mode === 'edit' && voice) {
        // Update existing voice (keep original language)
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
  }, [mode, selectedVoice, voice, customName, currentLanguage, formGender, onVoiceSaved]);

  const handleClose = useCallback(() => {
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    setPlayingVoiceId(null);
    setSearchQuery('');
    setGenderFilter('');
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
              </select>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={fetchVoices}
                disabled={isSearching}
              >
                {isSearching ? 'Loading...' : 'Search'}
              </button>
            </div>

            {searchError && <div className="modal-error">{searchError}</div>}

            <div className="modal-body">
              {isSearching && searchResults.length === 0 ? (
                <div className="modal-loading">Loading voices...</div>
              ) : searchResults.length === 0 ? (
                <div className="modal-empty">
                  No voices found for this language. Try a different search.
                </div>
              ) : (
                <div className="voice-picker-list">
                  {searchResults.map((voiceOption) => (
                    <div key={voiceOption.voiceId} className="voice-picker-item">
                      <div className="voice-picker-info">
                        <div className="voice-picker-avatar">
                          <User size={20} />
                        </div>
                        <div className="voice-picker-details">
                          <span className="voice-picker-name">{voiceOption.name}</span>
                          <span className="voice-picker-meta">
                            {voiceOption.gender && <span className={`badge badge-${voiceOption.gender}`}>{voiceOption.gender}</span>}
                            {voiceOption.accent && <span className="voice-tag">{voiceOption.accent}</span>}
                            {voiceOption.age && <span className="voice-tag">{voiceOption.age}</span>}
                            {voiceOption.isPremade || voiceOption.freeUsersAllowed ? (
                              <span className="badge badge-free">Free</span>
                            ) : (
                              <span className="badge badge-paid">Paid</span>
                            )}
                          </span>
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
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSelectVoice(voiceOption)}
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ))}
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

              {mode === 'edit' && voice && (
                <div className="original-voice-info">
                  <span className="original-voice-label">ElevenLabs Voice:</span>
                  <span className="original-voice-name">{voice.elevenlabsName}</span>
                </div>
              )}

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
