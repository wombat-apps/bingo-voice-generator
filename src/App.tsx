import { useEffect, useState, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useWindowDrag } from './hooks/useWindowDrag';
import { useSidebarResize } from './hooks/useSidebarResize';
import { Settings, PanelLeft, Pencil, Trash, Star } from 'lucide-react';
import { SegmentedControl } from './components';
import { BingoGrid } from './features/grid';
import { Sidebar } from './features/sidebar';
import { SettingsPanel } from './features/settings-panel';
import { ActionBar } from './features/player';
import { VoiceFormModal } from './features/voices';
import { UpdateButton, useUpdater } from './features/updater';
import {
  getAccents,
  loadVoices,
  backfillVoiceKinds,
  loadAudioFiles,
  listAccounts,
  setActiveAccount,
  generateAudio as generateAudioFile,
  getAccountSubscription,
  updateVoice,
  deleteAudioFile,
  deleteAllAudioFilesForNumber,
  deleteLocalVoice,
  getPlatformInfo,
  revealVoiceInFileManager,
  voicesWithTrimmedAudio,
  confirmDeletion,
} from './services/tauri';
import { playPreview, stopPreview } from './services/audioPlayer';
import type {
  AccountsState,
  Accent,
  Voice,
  AccentId,
  BingoModeId,
  AudioPart,
  NumberAudioPair,
  VoiceNumber,
  VoiceSettings,
  SubscriptionInfo,
} from './types';
import { DEFAULT_VOICE_SETTINGS, isTtsModelId } from './types';
import { hasDigit } from './domain/bingo';
import { usePlayer } from './features/player/usePlayer';
import { describeGenerationError } from './services/errors';
import { unavailableReason } from './domain/plan';
import './styles/index.css';
import './App.css';

function App() {
  // Static data
  const [accents, setAccents] = useState<Accent[]>([]);

  // User settings
  const [selectedAccent, setSelectedAccent] = useState<AccentId>('es-ES');
  const [selectedMode, setSelectedMode] = useState<BingoModeId>('bingo90');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);

  // ElevenLabs accounts; Rust reads the Active Account's key itself
  const [accountsState, setAccountsState] = useState<AccountsState>({ accounts: [], activeAccountId: null });
  const activeAccountId = accountsState.activeAccountId;
  const activeAccount = accountsState.accounts.find((a) => a.id === activeAccountId);
  const activeAccountName = activeAccount?.name ?? '';
  // keyHint is null when the Keychain has no key for the account
  const hasActiveAccount = activeAccount?.keyHint != null;
  const accountUnavailableReason = !activeAccount
    ? 'Pick an ElevenLabs Account in Settings'
    : activeAccount.keyHint === null
      ? `No API key in the Keychain for "${activeAccount.name}"`
      : null;

  // Subscription info
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  // Audio files
  const [audioFiles, setAudioFiles] = useState<Map<number, NumberAudioPair>>(new Map());

  // Track which voices have recordings (for sidebar play button)
  const [voiceHasRecordings, setVoiceHasRecordings] = useState<Map<string, boolean>>(new Map());

  // Platform info (for context menu labels)
  const [platform, setPlatform] = useState<string>('macos');

  // Selection state
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);

  // Generation state
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const [isGeneratingDigit, setIsGeneratingDigit] = useState(false);

  // Voice settings with localStorage persistence
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
    const saved = localStorage.getItem('voiceSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as VoiceSettings;
        // Saved models may have been removed from TTS_MODELS (e.g. deprecated by ElevenLabs)
        if (!isTtsModelId(parsed.modelId)) {
          return { ...parsed, modelId: DEFAULT_VOICE_SETTINGS.modelId };
        }
        return parsed;
      } catch {
        return DEFAULT_VOICE_SETTINGS;
      }
    }
    return DEFAULT_VOICE_SETTINGS;
  });

  // Persist voice settings to localStorage
  useEffect(() => {
    localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  // Voice form modal state
  const [voiceFormState, setVoiceFormState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    voice: Voice | null;
  }>({ isOpen: false, mode: 'add', voice: null });

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Updates offered in the header
  const updater = useUpdater();

  // Settings panel state (right sidebar)
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);

  // Sidebar collapse state (left sidebar)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Refresh subscription info. Only the latest request applies, so switching accounts quickly
  // never leaves another account's Plan in place.
  const subscriptionAccountRef = useRef<string | null>(null);
  const refreshSubscription = useCallback(async (accountId: string | null) => {
    subscriptionAccountRef.current = accountId;
    setSubscription(null);
    if (!accountId) return;
    try {
      const sub = await getAccountSubscription(accountId);
      if (subscriptionAccountRef.current === accountId) setSubscription(sub);
    } catch (err) {
      console.error('Failed to fetch subscription info:', err);
    }
  }, []);

  // Apply a new accounts state, loading the Active Account's subscription
  const applyAccountsState = useCallback(async (state: AccountsState) => {
    setAccountsState(state);
    refreshSubscription(state.activeAccountId);
  }, [refreshSubscription]);

  const handleActiveAccountChange = useCallback(async (accountId: string | null) => {
    try {
      await applyAccountsState(await setActiveAccount(accountId));
    } catch (err) {
      console.error('Failed to change the active account:', err);
    }
  }, [applyAccountsState]);

  // Ref for header (for double-click maximize)
  const headerRef = useRef<HTMLElement>(null);

  // Use dedicated drag strip for window dragging (like CodexMonitor)
  useWindowDrag("titlebar");

  // Sidebar resize hook
  const { sidebarWidth, onResizeStart } = useSidebarResize();

  // Setup double-click maximize on header
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const appWindow = getCurrentWindow();

    const isInteractiveElement = (target: HTMLElement) => {
      return (
        target.closest('button') ||
        target.closest('select') ||
        target.closest('input') ||
        target.closest('.app-header-actions')
      );
    };

    const handleDoubleClick = async (e: MouseEvent) => {
      if (isInteractiveElement(e.target as HTMLElement)) return;

      try {
        const isMaximized = await appWindow.isMaximized();
        if (isMaximized) {
          await appWindow.unmaximize();
        } else {
          await appWindow.maximize();
        }
      } catch (error) {
        console.error('Failed to toggle maximize:', error);
      }
    };

    header.addEventListener('dblclick', handleDoubleClick);
    return () => {
      header.removeEventListener('dblclick', handleDoubleClick);
    };
  }, []);

  // Detect platform and set vibrancy CSS classes
  useEffect(() => {
    async function detectPlatform() {
      try {
        const platformInfo = await getPlatformInfo();

        // Store platform for context menu labels
        setPlatform(platformInfo.os);

        // Add platform-specific CSS class to <html>
        document.documentElement.classList.add(`platform-${platformInfo.os}`);

        // Add vibrancy class based on support
        if (!platformInfo.hasVibrancy) {
          document.documentElement.classList.add('no-vibrancy');
        } else {
          document.documentElement.classList.add(`vibrancy-${platformInfo.vibrancyType}`);
        }
      } catch (error) {
        console.error('Failed to detect platform:', error);
        // Fallback: assume no vibrancy
        document.documentElement.classList.add('no-vibrancy');
      }
    }

    detectPlatform();
  }, []);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [langs, savedVoices, accounts] = await Promise.all([
          getAccents(),
          loadVoices(),
          listAccounts(),
        ]);

        setAccents(langs);
        setVoices(savedVoices);
        await applyAccountsState(accounts);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    }

    loadData();
  }, [applyAccountsState]);

  // Store the kind of Voices saved before kinds existed (once per Active Account)
  const needsKindBackfill = voices.some((v) => v.kind === null);
  const backfilledAccountRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeAccountId || !needsKindBackfill || backfilledAccountRef.current === activeAccountId) return;
    backfilledAccountRef.current = activeAccountId;
    backfillVoiceKinds()
      .then((updatedVoices) => {
        setVoices(updatedVoices);
        setSelectedVoice((current) =>
          current ? updatedVoices.find((v) => v.uuid === current.uuid) ?? current : current
        );
      })
      .catch((err) => {
        console.error('Failed to backfill voice kinds:', err);
        backfilledAccountRef.current = null; // retry on the next account change
      });
  }, [activeAccountId, needsKindBackfill]);

  // Whether the Active Account's Plan can generate with the selected Voice
  const selectedVoiceUnavailableReason = selectedVoice
    ? unavailableReason(selectedVoice.kind, subscription)
    : null;

  // Auto-open settings panel if there is no Active Account
  useEffect(() => {
    if (accountsState.activeAccountId === null && accents.length > 0) {
      setIsSettingsPanelOpen(true);
    }
  }, [accountsState.activeAccountId, accents.length]);

  // Load audio files when voice or mode changes
  useEffect(() => {
    async function loadFiles() {
      if (!selectedVoice) {
        setAudioFiles(new Map());
        return;
      }

      try {
        const files = await loadAudioFiles(selectedAccent, selectedVoice, selectedMode);
        setAudioFiles(files);
      } catch (error) {
        console.error('Failed to load audio files:', error);
        setAudioFiles(new Map());
      }
    }

    loadFiles();
  }, [selectedVoice, selectedAccent, selectedMode]);

  // Check which voices have recordings for the current Accent/mode
  useEffect(() => {
    if (voices.length === 0) return;
    voicesWithTrimmedAudio(selectedAccent, selectedMode)
      .then((uuids) => {
        const withRecordings = new Set(uuids);
        setVoiceHasRecordings(
          new Map(
            voices
              .filter((v) => v.accent === selectedAccent)
              .map((v) => [v.uuid, withRecordings.has(v.uuid)])
          )
        );
      })
      .catch((error) => console.error('Failed to check voice recordings:', error));
  }, [voices, selectedAccent, selectedMode]);

  // Update selected voice when the Accent changes
  useEffect(() => {
    const voicesForAccent = voices.filter((v) => v.accent === selectedAccent);
    if (selectedVoice && selectedVoice.accent !== selectedAccent) {
      setSelectedVoice(voicesForAccent[0] || null);
    } else if (!selectedVoice && voicesForAccent.length > 0) {
      setSelectedVoice(voicesForAccent[0]);
    }
  }, [selectedAccent, voices, selectedVoice]);

  const player = usePlayer({ audioFiles, selectedNumber, selectNumber: setSelectedNumber });

  // A click selects the number and plays its Word, then its Digit
  const handleCellClick = useCallback(
    (number: number) => {
      setSelectedNumber(number);
      player.playNumber(number);
    },
    [player.playNumber]
  );

  // Generate audio for the selected number
  const generateAudio = useCallback(
    async (part: AudioPart) => {
      if (!selectedNumber || !selectedVoice || !hasActiveAccount) {
        return;
      }

      const setGenerating = part === 'word' ? setIsGeneratingWord : setIsGeneratingDigit;
      setGenerating(true);

      try {
        const savedFile = await generateAudioFile(selectedNumber, selectedVoice, selectedMode, part, voiceSettings);

        // Update local state
        setAudioFiles((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(selectedNumber) || { number: selectedNumber, wordAudio: null, digitAudio: null };
          if (part === 'word') {
            newMap.set(selectedNumber, { ...existing, wordAudio: savedFile });
          } else {
            newMap.set(selectedNumber, { ...existing, digitAudio: savedFile });
          }
          return newMap;
        });

        // Play the newly generated audio
        player.playPart(part, selectedNumber);
      } catch (err) {
        console.error(`Failed to generate audio for ${selectedNumber} ${part}:`, err);
        setError(describeGenerationError(err, activeAccountName));
      } finally {
        setGenerating(false);
      }
    },
    [selectedNumber, selectedVoice, hasActiveAccount, activeAccountName, selectedMode, voiceSettings, player.playPart]
  );

  const handleGenerateWord = useCallback(() => {
    generateAudio('word');
  }, [generateAudio]);

  const handleGenerateDigit = useCallback(() => {
    generateAudio('digit');
  }, [generateAudio]);

  const handleDeleteAudio = useCallback(
    async (part: AudioPart | 'all') => {
      if (!selectedNumber || !selectedVoice) return;

      const voiceNumber: VoiceNumber = {
        accent: selectedAccent,
        voiceUuid: selectedVoice.uuid,
        mode: selectedMode,
        number: selectedNumber,
      };
      try {
        if (part === 'all') {
          await deleteAllAudioFilesForNumber(voiceNumber);
          setAudioFiles((prev) => {
            const newMap = new Map(prev);
            newMap.delete(selectedNumber);
            return newMap;
          });
        } else {
          await deleteAudioFile({ ...voiceNumber, part });
          setAudioFiles((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(selectedNumber);
            if (existing) {
              if (part === 'word') {
                if (!existing.digitAudio) {
                  newMap.delete(selectedNumber);
                } else {
                  newMap.set(selectedNumber, { ...existing, wordAudio: null });
                }
              } else {
                if (!existing.wordAudio) {
                  newMap.delete(selectedNumber);
                } else {
                  newMap.set(selectedNumber, { ...existing, digitAudio: null });
                }
              }
            }
            return newMap;
          });
        }

        // Stop playback if we deleted the currently playing file
        if (player.playingNumber === selectedNumber) {
          player.stop();
        }
      } catch (err) {
        console.error('Failed to delete audio:', err);
        setError('Error al eliminar el audio');
      }
    },
    [selectedNumber, selectedVoice, selectedAccent, selectedMode, player.playingNumber, player.stop]
  );

  const handleOpenVoiceForm = useCallback((voice?: Voice) => {
    if (voice) {
      // Edit mode
      setVoiceFormState({ isOpen: true, mode: 'edit', voice });
    } else {
      // Add mode
      setVoiceFormState({ isOpen: true, mode: 'add', voice: null });
    }
  }, []);

  const handleVoiceSaved = useCallback((updatedVoices: Voice[]) => {
    setVoices(updatedVoices);
    // If we were editing the selected voice, update it with the new data
    if (voiceFormState.mode === 'edit' && voiceFormState.voice && selectedVoice) {
      const updatedSelectedVoice = updatedVoices.find(
        (v) => v.uuid === selectedVoice.uuid
      );
      if (updatedSelectedVoice) {
        setSelectedVoice(updatedSelectedVoice);
      }
    } else if (voiceFormState.mode === 'add') {
      // For add mode, select the newly added voice (last one matching the current Accent)
      const newVoice = updatedVoices.find(
        (v) => v.accent === selectedAccent && !voices.some((existing) => existing.uuid === v.uuid)
      );
      if (newVoice) {
        setSelectedVoice(newVoice);
      }
    }
  }, [voiceFormState.mode, voiceFormState.voice, selectedVoice, selectedAccent, voices]);

  const handleCloseVoiceForm = useCallback(() => {
    setVoiceFormState({ isOpen: false, mode: 'add', voice: null });
  }, []);

  const handleDeleteVoice = useCallback(async (voice: Voice) => {
    const confirmed = await confirmDeletion(
      'Delete Voice',
      `Are you sure you want to delete the voice "${voice.customName}"?\n\nThis will remove the voice from the app but will not delete it from ElevenLabs.`
    );

    if (!confirmed) return;

    try {
      const updatedVoices = await deleteLocalVoice(voice.uuid);
      setVoices(updatedVoices);

      // If the deleted voice was selected, clear selection or select another voice
      if (selectedVoice?.uuid === voice.uuid) {
        const voicesForAccent = updatedVoices.filter((v) => v.accent === selectedAccent);
        setSelectedVoice(voicesForAccent[0] || null);
      }
    } catch (err) {
      console.error('Failed to delete voice:', err);
      setError('Error al eliminar la voz');
    }
  }, [selectedVoice, selectedAccent]);

  const handleToggleFavorite = useCallback(async (voice: Voice) => {
    const updatedVoice = { ...voice, favorite: !voice.favorite };
    const updatedVoices = await updateVoice(updatedVoice);
    setVoices(updatedVoices);
    if (selectedVoice?.uuid === voice.uuid) {
      setSelectedVoice(updatedVoice);
    }
  }, [selectedVoice]);

  const handleShowVoiceInFileManager = useCallback(async (voice: Voice) => {
    try {
      await revealVoiceInFileManager(selectedAccent, voice);
    } catch (err) {
      console.error('Failed to reveal voice in file manager:', err);
      setError('Could not open folder');
    }
  }, [selectedAccent]);

  // Play a random recorded sample for a voice (word + digit)
  // Uses separate preview player - does NOT affect main player bar state
  const handlePlayVoiceSample = useCallback(async (voice: Voice) => {
    try {
      // Load audio files for this voice
      const files = await loadAudioFiles(selectedAccent, voice, selectedMode);

      // Find numbers that have at least one recording
      const numbersWithAudio: number[] = [];
      files.forEach((pair, number) => {
        if (pair.wordAudio || pair.digitAudio) {
          numbersWithAudio.push(number);
        }
      });

      if (numbersWithAudio.length === 0) {
        setError('No recordings found for this voice');
        return;
      }

      // Pick a random number
      const randomIndex = Math.floor(Math.random() * numbersWithAudio.length);
      const randomNumber = numbersWithAudio[randomIndex];
      const audioPair = files.get(randomNumber);

      if (!audioPair) return;

      const wordFile = audioPair.wordAudio;
      const digitFile = audioPair.digitAudio;

      // Stop any currently playing preview (but NOT the main player)
      stopPreview();

      // Play using the separate preview player (doesn't affect main player bar)
      if (wordFile) {
        // Play word, with optional digit chained after
        await playPreview(wordFile.filePath, digitFile?.filePath);
      } else if (digitFile) {
        // Only digit available
        await playPreview(digitFile.filePath);
      }
    } catch (err) {
      console.error('Failed to play voice sample:', err);
      setError('Failed to play voice sample');
    }
  }, [selectedAccent, selectedMode]);

  // Get audio state for selected number
  const selectedAudioPair = selectedNumber !== null ? audioFiles.get(selectedNumber) : null;
  const selectedHasWord = !!selectedAudioPair?.wordAudio;
  const selectedHasDigit = !!selectedAudioPair?.digitAudio;
  const selectedNeedsDigit = selectedNumber !== null && hasDigit(selectedNumber);

  const appClassName = `app${isSidebarCollapsed ? ' sidebar-collapsed' : ''}${isSettingsPanelOpen ? ' settings-panel-open' : ''}`;

  return (
    <div
      className={appClassName}
      style={{
        '--sidebar-width': `${isSidebarCollapsed ? 0 : sidebarWidth}px`,
        '--settings-panel-width': `${isSettingsPanelOpen ? 320 : 0}px`
      } as React.CSSProperties}
    >
      {/* Drag strip for entire window - must be at app level */}
      <div className="drag-strip" id="titlebar" data-tauri-drag-region />

      {/* Sidebar - full height on left */}
      <aside className="app-sidebar">
        <Sidebar
          accents={accents}
          voices={voices}
          selectedAccent={selectedAccent}
          selectedVoice={selectedVoice}
          hasApiKey={hasActiveAccount}
          accountsState={accountsState}
          subscription={subscription}
          voiceHasRecordings={voiceHasRecordings}
          platform={platform}
          onAccentChange={setSelectedAccent}
          onActiveAccountChange={handleActiveAccountChange}
          onVoiceChange={setSelectedVoice}
          onOpenVoiceForm={handleOpenVoiceForm}
          onToggleFavorite={handleToggleFavorite}
          onPlayVoiceSample={handlePlayVoiceSample}
          onShowVoiceInFileManager={handleShowVoiceInFileManager}
          onDeleteVoice={handleDeleteVoice}
        />
      </aside>

      {/* Sidebar resizer */}
      {!isSidebarCollapsed && (
        <div className="sidebar-resizer" onMouseDown={onResizeStart} />
      )}

      {/* Center panel - header, content, footer */}
      <div className="app-center">
        <header ref={headerRef} className="app-header">
          {/* Collapse button */}
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
          >
            <PanelLeft size={18} />
          </button>

          {/* Voice card - flexible width */}
          <div className="app-header-voice">
            {selectedVoice ? (
              <div className="header-voice">
                <div className="header-voice-info">
                  <div className="header-voice-primary">
                    <span className="header-voice-name">{selectedVoice.customName}</span>
                    <span className={`badge badge-${selectedVoice.gender}`}>{selectedVoice.gender}</span>
                    {selectedVoice.favorite && (
                      <Star size={14} className="header-voice-favorite" fill="currentColor" />
                    )}
                  </div>
                  <div className="header-voice-secondary">
                    {selectedVoice.elevenlabsName} • {selectedVoice.elevenlabsId}
                  </div>
                </div>
                <div className="header-voice-actions">
                  <button
                    className="btn btn-icon btn-secondary btn-sm"
                    onClick={() => handleOpenVoiceForm(selectedVoice)}
                    title="Edit voice"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn btn-icon btn-secondary btn-sm header-voice-delete"
                    onClick={() => handleDeleteVoice(selectedVoice)}
                    title="Delete voice"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <span className="header-no-voice">No voice selected</span>
            )}
          </div>

          {/* Mode selector */}
          <SegmentedControl
            options={[
              { value: 'bingo90' as BingoModeId, label: '90' },
              { value: 'bingo75' as BingoModeId, label: '75' },
            ]}
            value={selectedMode}
            onChange={setSelectedMode}
            size="md"
          />

          <div className="app-header-actions">
            {updater.update && (
              <UpdateButton
                update={updater.update}
                isGenerating={isGeneratingWord || isGeneratingDigit}
                isInstalling={updater.isInstalling}
                onInstall={updater.install}
                onLater={updater.later}
              />
            )}

            {/* Settings button */}
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setIsSettingsPanelOpen(!isSettingsPanelOpen)}
              title={isSettingsPanelOpen ? "Hide Settings" : "Show Settings"}
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <main className="app-main">
          <section className="app-content">
            <BingoGrid
              mode={selectedMode}
              audioFiles={audioFiles}
              selectedNumber={selectedNumber}
              onCellClick={handleCellClick}
            />
          </section>
        </main>

        <footer className="app-footer">
        <ActionBar
          selectedNumber={selectedNumber}
          playingNumber={player.playingNumber}
          playingPart={player.playingPart}
          mode={selectedMode}
          isPlaying={player.isPlaying}
          word={player.word}
          digit={player.digit}
          onPause={player.pause}
          onPrevious={player.previous}
          onNext={player.next}
          onSeek={player.seek}
          canNavigate={player.canNavigate}
          onPlayWord={() => player.playPart('word')}
          onPlayDigit={() => player.playPart('digit')}
          // Generation actions
          onGenerateWord={handleGenerateWord}
          onGenerateDigit={handleGenerateDigit}
          onDelete={handleDeleteAudio}
          isGeneratingWord={isGeneratingWord}
          isGeneratingDigit={isGeneratingDigit}
          accountUnavailableReason={accountUnavailableReason}
          voiceSelected={selectedVoice !== null}
          voiceUnavailableReason={selectedVoiceUnavailableReason}
          selectedHasWord={selectedHasWord}
          selectedHasDigit={selectedHasDigit}
          selectedNeedsDigit={selectedNeedsDigit}
        />
        </footer>
      </div>

      {/* Settings Panel - right sidebar (integrated in layout) */}
      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        accountsState={accountsState}
        voiceSettings={voiceSettings}
        onClose={() => setIsSettingsPanelOpen(false)}
        onAccountsChange={applyAccountsState}
        onVoiceSettingsChange={setVoiceSettings}
      />

      <VoiceFormModal
        isOpen={voiceFormState.isOpen}
        mode={voiceFormState.mode}
        voice={voiceFormState.voice}
        currentAccent={selectedAccent}
        activeAccountId={activeAccountId}
        subscription={subscription}
        onClose={handleCloseVoiceForm}
        onVoiceSaved={handleVoiceSaved}
      />

      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          <span className="error-toast-message">{error}</span>
          <button className="error-toast-close">&times;</button>
        </div>
      )}
    </div>
  );
}

export default App;
