import { useEffect, useState, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useWindowDrag } from './hooks/useWindowDrag';
import { useSidebarResize } from './hooks/useSidebarResize';
import { Settings, PanelLeft, Pencil, Trash2, Star } from 'lucide-react';
import { SegmentedControl } from './components';
import { BingoGrid } from './features/grid';
import { Sidebar } from './features/sidebar';
import { SettingsPanel } from './features/settings-panel';
import { ActionBar } from './features/player';
import { VoiceFormModal, VoiceLimitModal } from './features/voices';
import {
  getLanguages,
  loadVoices,
  loadAudioFiles,
  listAccounts,
  getAccountApiKey,
  setActiveAccount,
  generateSpeech,
  saveAudioFile,
  buildTtsText,
  listElevenLabsVoices,
  deleteElevenLabsVoice,
  getSubscription,
  updateVoice,
  deleteAudioFile,
  deleteAllAudioFilesForNumber,
  deleteLocalVoice,
  getPlatformInfo,
  revealVoiceInFileManager,
} from './services/tauri';
import {
  playAudioFile,
  stop as stopAudio,
  pause as pauseAudio,
  resume as resumeAudio,
  seek as seekAudio,
  setOnPlaybackEnd,
  setOnTimeUpdate,
  getAudioDuration,
  playPreview,
  stopPreview,
} from './services/audioPlayer';
import type {
  AccountsState,
  Language,
  Voice,
  LanguageId,
  BingoModeId,
  AudioPart,
  NumberAudioPair,
  VoiceSettings,
  SubscriptionInfo,
  ElevenLabsVoice,
} from './types';
import { DEFAULT_VOICE_SETTINGS, isTtsModelId } from './types';
import './styles/index.css';
import './App.css';

// Helper para detectar errores de quota/créditos de ElevenLabs
function isQuotaExceededError(errorMsg: string): boolean {
  const quotaPatterns = [
    'quota',
    'exceeded',
    'insufficient',
    'character_limit',
    'usage_limit',
    '429', // Rate limit HTTP status
    '402', // Payment required HTTP status
  ];
  const lowerMsg = errorMsg.toLowerCase();
  return quotaPatterns.some(pattern => lowerMsg.includes(pattern.toLowerCase()));
}

// Helper para detectar errores de límite de voces (solo este error permite retry)
function isVoiceLimitError(errorMsg: string): boolean {
  return errorMsg.includes('VOICE_LIMIT_REACHED');
}

// Helper para detectar errores de voz no encontrada
function isVoiceNotFoundError(errorMsg: string): boolean {
  return errorMsg.includes('voice_does_not_exist');
}

function App() {
  // Static data
  const [languages, setLanguages] = useState<Language[]>([]);

  // User settings
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageId>('es-ES');
  const [selectedMode, setSelectedMode] = useState<BingoModeId>('bingo90');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);

  // ElevenLabs accounts; apiKey is the Active Account's key ('' when there is none)
  const [accountsState, setAccountsState] = useState<AccountsState>({ accounts: [], activeAccountId: null });
  const [apiKey, setApiKey] = useState('');
  const hasActiveAccount = apiKey !== '';
  const activeAccountName =
    accountsState.accounts.find((a) => a.id === accountsState.activeAccountId)?.name ?? '';

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

  // Playback state
  const [playingNumber, setPlayingNumber] = useState<number | null>(null);
  const [playingPart, setPlayingPart] = useState<AudioPart | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sequential playback state
  const [_isSequentialPlaying, setIsSequentialPlaying] = useState(false);
  const [sequentialQueue, setSequentialQueue] = useState<AudioPart[]>([]);
  // For voice sample playback - stores the next file path directly
  const [pendingNextFilePath, setPendingNextFilePath] = useState<string | null>(null);

  // Dual panel state - track word and digit files separately
  const [wordFilePath, setWordFilePath] = useState<string | null>(null);
  const [digitFilePath, setDigitFilePath] = useState<string | null>(null);
  const [wordDuration, setWordDuration] = useState(0);
  const [digitDuration, setDigitDuration] = useState(0);
  const [wordCurrentTime, setWordCurrentTime] = useState(0);
  const [digitCurrentTime, setDigitCurrentTime] = useState(0);

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

  // Voice limit modal state
  const [voiceLimitModalState, setVoiceLimitModalState] = useState<{
    isOpen: boolean;
    voices: ElevenLabsVoice[];
    onSelect: (voiceId: string) => void;
    onCancel: () => void;
  } | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

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

  // Refresh subscription info
  const refreshSubscription = useCallback(async (key: string) => {
    if (!key) {
      setSubscription(null);
      return;
    }
    try {
      const sub = await getSubscription(key);
      setSubscription(sub);
    } catch (err) {
      console.error('Failed to fetch subscription info:', err);
      setSubscription(null);
    }
  }, []);

  // Apply a new accounts state, loading the Active Account's key and subscription
  const applyAccountsState = useCallback(async (state: AccountsState) => {
    setAccountsState(state);
    if (!state.activeAccountId) {
      setApiKey('');
      setSubscription(null);
      return;
    }
    try {
      const key = await getAccountApiKey(state.activeAccountId);
      setApiKey(key);
      refreshSubscription(key);
    } catch (err) {
      console.error('Failed to load the active account API key:', err);
      setApiKey('');
      setSubscription(null);
    }
  }, [refreshSubscription]);

  const handleActiveAccountChange = useCallback(async (accountId: string | null) => {
    try {
      await applyAccountsState(await setActiveAccount(accountId));
    } catch (err) {
      console.error('Failed to change the active account:', err);
    }
  }, [applyAccountsState]);

  // Helper to ask user to select a voice to delete when limit is reached
  const askUserToSelectVoice = useCallback((voices: ElevenLabsVoice[]): Promise<string | null> => {
    return new Promise((resolve) => {
      setVoiceLimitModalState({
        isOpen: true,
        voices,
        onSelect: (voiceId) => {
          setVoiceLimitModalState(null);
          resolve(voiceId);
        },
        onCancel: () => {
          setVoiceLimitModalState(null);
          resolve(null);
        },
      });
    });
  }, []);

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
          getLanguages(),
          loadVoices(),
          listAccounts(),
        ]);

        setLanguages(langs);
        setVoices(savedVoices);
        await applyAccountsState(accounts);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    }

    loadData();
  }, [applyAccountsState]);

  // Auto-open settings panel if there is no Active Account
  useEffect(() => {
    if (accountsState.activeAccountId === null && languages.length > 0) {
      setIsSettingsPanelOpen(true);
    }
  }, [accountsState.activeAccountId, languages.length]);

  // Load audio files when voice or mode changes
  useEffect(() => {
    async function loadFiles() {
      if (!selectedVoice) {
        setAudioFiles(new Map());
        return;
      }

      try {
        const files = await loadAudioFiles(selectedLanguage, selectedVoice, selectedMode);
        setAudioFiles(files);
      } catch (error) {
        console.error('Failed to load audio files:', error);
        setAudioFiles(new Map());
      }
    }

    loadFiles();
  }, [selectedVoice, selectedLanguage, selectedMode]);

  // Check which voices have recordings for the current language/mode
  useEffect(() => {
    async function checkVoiceRecordings() {
      const voicesForLanguage = voices.filter((v) => v.language === selectedLanguage);
      const recordingsMap = new Map<string, boolean>();

      for (const voice of voicesForLanguage) {
        try {
          const files = await loadAudioFiles(selectedLanguage, voice, selectedMode);
          const hasAny = Array.from(files.values()).some(
            (pair) => pair.wordAudio !== null || pair.digitAudio !== null
          );
          recordingsMap.set(voice.uuid, hasAny);
        } catch {
          recordingsMap.set(voice.uuid, false);
        }
      }

      setVoiceHasRecordings(recordingsMap);
    }

    if (voices.length > 0) {
      checkVoiceRecordings();
    }
  }, [voices, selectedLanguage, selectedMode]);

  // Set up playback end callback with sequential queue support
  useEffect(() => {
    setOnPlaybackEnd(() => {
      // Check for pending next file (used by voice sample playback)
      if (pendingNextFilePath) {
        const nextPath = pendingNextFilePath;
        setPendingNextFilePath(null);
        setPlayingPart('digit');
        setCurrentFilePath(nextPath);
        playAudioFile(nextPath).catch(console.error);
        return;
      }

      // Check if there's a sequential queue to process
      if (sequentialQueue.length > 0) {
        const nextPart = sequentialQueue[0];
        const remainingQueue = sequentialQueue.slice(1);
        setSequentialQueue(remainingQueue);

        // Play the next part in queue
        if (selectedNumber !== null) {
          const audioPair = audioFiles.get(selectedNumber);
          const nextFile = nextPart === 'word' ? audioPair?.wordAudio : audioPair?.digitAudio;

          if (nextFile) {
            setPlayingPart(nextPart);
            setCurrentFilePath(nextFile.filePath);
            // Reset the time for the next part
            if (nextPart === 'word') {
              setWordCurrentTime(0);
            } else {
              setDigitCurrentTime(0);
            }
            playAudioFile(nextFile.filePath).catch(console.error);
            return; // Keep playing
          }
        }
      }

      // No more items in queue or failed to play next
      setIsPlaying(false);
      setIsSequentialPlaying(false);
      setCurrentTime(0);
      setPendingNextFilePath(null);
      // Reset panel times when playback ends
      if (playingPart === 'word') {
        setWordCurrentTime(0);
      } else if (playingPart === 'digit') {
        setDigitCurrentTime(0);
      }
    });

    return () => {
      setOnPlaybackEnd(null);
    };
  }, [sequentialQueue, selectedNumber, audioFiles, playingPart, pendingNextFilePath]);

  // Set up time update callback - track time per panel
  useEffect(() => {
    setOnTimeUpdate((time) => {
      setCurrentTime(time);
      // Also update the per-panel current time
      if (playingPart === 'word') {
        setWordCurrentTime(time);
      } else if (playingPart === 'digit') {
        setDigitCurrentTime(time);
      }
    });
    return () => setOnTimeUpdate(null);
  }, [playingPart]);

  // Get duration when file changes
  useEffect(() => {
    if (currentFilePath) {
      getAudioDuration(currentFilePath)
        .then(setDuration)
        .catch(console.error);
    } else {
      setDuration(0);
      setCurrentTime(0);
    }
  }, [currentFilePath]);

  // Update dual panel file paths when selected number changes
  useEffect(() => {
    if (selectedNumber !== null) {
      const audioPair = audioFiles.get(selectedNumber);
      const wordPath = audioPair?.wordAudio?.filePath || null;
      const digitPath = audioPair?.digitAudio?.filePath || null;

      setWordFilePath(wordPath);
      setDigitFilePath(digitPath);

      // Get durations for each file
      if (wordPath) {
        getAudioDuration(wordPath).then(setWordDuration).catch(console.error);
      } else {
        setWordDuration(0);
      }

      if (digitPath) {
        getAudioDuration(digitPath).then(setDigitDuration).catch(console.error);
      } else {
        setDigitDuration(0);
      }
    } else {
      setWordFilePath(null);
      setDigitFilePath(null);
      setWordDuration(0);
      setDigitDuration(0);
    }
    setWordCurrentTime(0);
    setDigitCurrentTime(0);
  }, [selectedNumber, audioFiles]);

  // Update selected voice when language changes
  useEffect(() => {
    const voicesForLanguage = voices.filter((v) => v.language === selectedLanguage);
    if (selectedVoice && selectedVoice.language !== selectedLanguage) {
      setSelectedVoice(voicesForLanguage[0] || null);
    } else if (!selectedVoice && voicesForLanguage.length > 0) {
      setSelectedVoice(voicesForLanguage[0]);
    }
  }, [selectedLanguage, voices, selectedVoice]);

  // Cell click handler - plays complete audio (word + digit) sequentially
  const handleCellClick = useCallback(
    async (number: number) => {
      setSelectedNumber(number);

      const audioPair = audioFiles.get(number);
      const wordFile = audioPair?.wordAudio;
      const digitFile = audioPair?.digitAudio;

      if (!wordFile && !digitFile) return;

      try {
        if (wordFile) {
          setIsSequentialPlaying(true);
          setPlayingNumber(number);
          setPlayingPart('word');
          setCurrentFilePath(wordFile.filePath);

          if (digitFile) {
            setSequentialQueue(['digit']);
          }

          setIsPlaying(true);
          await playAudioFile(wordFile.filePath);
        } else if (digitFile) {
          setPlayingNumber(number);
          setPlayingPart('digit');
          setCurrentFilePath(digitFile.filePath);
          setIsPlaying(true);
          await playAudioFile(digitFile.filePath);
        }
      } catch (error) {
        console.error('Failed to play audio:', error);
        setIsPlaying(false);
        setIsSequentialPlaying(false);
      }
    },
    [audioFiles]
  );

  // Generate audio for the selected number
  const generateAudio = useCallback(
    async (part: AudioPart) => {
      if (!selectedNumber || !selectedVoice || !apiKey) {
        return;
      }

      const setGenerating = part === 'word' ? setIsGeneratingWord : setIsGeneratingDigit;
      setGenerating(true);

      try {
        const currentLang = languages.find((l) => l.id === selectedLanguage);
        const languageCode = currentLang?.elevenlabsCode || 'es';

        // Build TTS text
        const text = await buildTtsText(selectedNumber, selectedLanguage, selectedMode, part);

        // Generate speech
        const audioData = await generateSpeech(
          text,
          selectedVoice.elevenlabsId,
          languageCode,
          apiKey,
          voiceSettings.modelId,
          undefined,
          voiceSettings
        );

        // Save audio file
        const savedFile = await saveAudioFile(
          audioData,
          selectedNumber,
          selectedLanguage,
          selectedVoice,
          selectedMode,
          part
        );

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
        setPlayingNumber(selectedNumber);
        setPlayingPart(part);
        setCurrentFilePath(savedFile.filePath);
        setIsPlaying(true);
        await playAudioFile(savedFile.filePath);
      } catch (err) {
        console.error(`Failed to generate audio for ${selectedNumber} ${part}:`, err);
        const errorMsg = typeof err === 'object' && err !== null
          ? JSON.stringify(err)
          : (err instanceof Error ? err.message : String(err));

        if (isVoiceLimitError(errorMsg)) {
          // Show modal to let user choose which voice to delete
          try {
            const elevenLabsVoices = await listElevenLabsVoices(apiKey);
            const deletableVoices = elevenLabsVoices;

            if (deletableVoices.length === 0) {
              setError('Límite de voces alcanzado. No hay voces que eliminar. Elimina voces manualmente en elevenlabs.io');
              setGenerating(false);
              return;
            }

            const selectedVoiceId = await askUserToSelectVoice(deletableVoices);

            if (!selectedVoiceId) {
              setError('Generación cancelada. Se requiere eliminar una voz para continuar.');
              setGenerating(false);
              return;
            }

            await deleteElevenLabsVoice(selectedVoiceId, apiKey);

            // Retry generation
            const currentLang = languages.find((l) => l.id === selectedLanguage);
            const languageCode = currentLang?.elevenlabsCode || 'es';
            const text = await buildTtsText(selectedNumber, selectedLanguage, selectedMode, part);
            const audioData = await generateSpeech(
              text,
              selectedVoice.elevenlabsId,
              languageCode,
              apiKey,
              voiceSettings.modelId,
              undefined,
              voiceSettings
            );

            const savedFile = await saveAudioFile(
              audioData,
              selectedNumber,
              selectedLanguage,
              selectedVoice,
              selectedMode,
              part
            );

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

            setPlayingNumber(selectedNumber);
            setPlayingPart(part);
            setCurrentFilePath(savedFile.filePath);
            setIsPlaying(true);
            await playAudioFile(savedFile.filePath);
            setGenerating(false);
            return;
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            const retryErrorMsg =
              typeof retryError === 'object' && retryError !== null
                ? JSON.stringify(retryError)
                : retryError instanceof Error
                  ? retryError.message
                  : String(retryError);
            if (isQuotaExceededError(retryErrorMsg)) {
              setError('Has alcanzado el límite de créditos de ElevenLabs. Actualiza tu plan o espera a que se renueve tu cuota.');
            } else {
              setError(`No se pudo generar el audio: ${retryErrorMsg}`);
            }
            setGenerating(false);
            return;
          }
        } else if (errorMsg.includes('No API key')) {
          setError('Por favor, selecciona una cuenta de ElevenLabs.');
        } else if (isQuotaExceededError(errorMsg)) {
          setError('Has alcanzado el límite de créditos de ElevenLabs. Actualiza tu plan o espera a que se renueve tu cuota.');
        } else if (isVoiceNotFoundError(errorMsg)) {
          setError(`La voz seleccionada no existe en la cuenta "${activeAccountName}". Cambia de cuenta o selecciona otra voz.`);
        } else {
          setError(`Error al generar audio: ${errorMsg}`);
        }
      } finally {
        setGenerating(false);
      }
    },
    [selectedNumber, selectedVoice, apiKey, activeAccountName, selectedLanguage, selectedMode, languages, voiceSettings, askUserToSelectVoice]
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

      try {
        if (part === 'all') {
          await deleteAllAudioFilesForNumber(selectedNumber, selectedLanguage, selectedVoice, selectedMode);
          setAudioFiles((prev) => {
            const newMap = new Map(prev);
            newMap.delete(selectedNumber);
            return newMap;
          });
        } else {
          await deleteAudioFile(selectedNumber, selectedLanguage, selectedVoice, selectedMode, part);
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
        if (playingNumber === selectedNumber) {
          stopAudio();
          setPlayingNumber(null);
          setPlayingPart(null);
          setCurrentFilePath(null);
          setIsPlaying(false);
        }
      } catch (err) {
        console.error('Failed to delete audio:', err);
        setError('Error al eliminar el audio');
      }
    },
    [selectedNumber, selectedVoice, selectedLanguage, selectedMode, playingNumber]
  );

  const handlePlay = useCallback(async () => {
    if (currentFilePath) {
      try {
        setIsPlaying(true);
        // Try to resume first; if that doesn't work, play from beginning
        if (currentTime > 0 && currentTime < duration) {
          resumeAudio();
        } else {
          await playAudioFile(currentFilePath);
        }
      } catch (error) {
        console.error('Failed to play audio:', error);
        setIsPlaying(false);
      }
    }
  }, [currentFilePath, currentTime, duration]);

  const handlePause = useCallback(() => {
    pauseAudio();
    setIsPlaying(false);
  }, []);

  const handleSeek = useCallback((time: number) => {
    seekAudio(time);
    setCurrentTime(time);
  }, []);

  const getNumbersWithAudio = useCallback((): number[] => {
    const numbersWithAudio: number[] = [];
    audioFiles.forEach((pair, number) => {
      if (pair.wordAudio || pair.digitAudio) {
        numbersWithAudio.push(number);
      }
    });
    return numbersWithAudio.sort((a, b) => a - b);
  }, [audioFiles]);

  const handlePrevious = useCallback(async () => {
    if (playingNumber === null) return;

    const numbersWithAudio = getNumbersWithAudio();
    if (numbersWithAudio.length === 0) return;

    const currentIndex = numbersWithAudio.indexOf(playingNumber);
    if (currentIndex === -1) return;

    // Circular: wrap to end if at beginning
    const prevIndex = currentIndex === 0
      ? numbersWithAudio.length - 1
      : currentIndex - 1;

    const prevNumber = numbersWithAudio[prevIndex];
    const audioPair = audioFiles.get(prevNumber);
    const audioFile = audioPair?.wordAudio || audioPair?.digitAudio;
    const part: AudioPart = audioPair?.wordAudio ? 'word' : 'digit';

    if (audioFile) {
      setSelectedNumber(prevNumber);
      setPlayingNumber(prevNumber);
      setPlayingPart(part);
      setCurrentFilePath(audioFile.filePath);
      setIsPlaying(true);
      await playAudioFile(audioFile.filePath);
    }
  }, [playingNumber, audioFiles, getNumbersWithAudio]);

  const handleNext = useCallback(async () => {
    if (playingNumber === null) return;

    const numbersWithAudio = getNumbersWithAudio();
    if (numbersWithAudio.length === 0) return;

    const currentIndex = numbersWithAudio.indexOf(playingNumber);
    if (currentIndex === -1) return;

    // Circular: wrap to beginning if at end
    const nextIndex = currentIndex === numbersWithAudio.length - 1
      ? 0
      : currentIndex + 1;

    const nextNumber = numbersWithAudio[nextIndex];
    const audioPair = audioFiles.get(nextNumber);
    const audioFile = audioPair?.wordAudio || audioPair?.digitAudio;
    const part: AudioPart = audioPair?.wordAudio ? 'word' : 'digit';

    if (audioFile) {
      setSelectedNumber(nextNumber);
      setPlayingNumber(nextNumber);
      setPlayingPart(part);
      setCurrentFilePath(audioFile.filePath);
      setIsPlaying(true);
      await playAudioFile(audioFile.filePath);
    }
  }, [playingNumber, audioFiles, getNumbersWithAudio]);

  const handleSwitchPart = useCallback(async (part: AudioPart) => {
    if (playingNumber === null) return;

    const audioPair = audioFiles.get(playingNumber);
    const audioFile = part === 'word' ? audioPair?.wordAudio : audioPair?.digitAudio;

    if (audioFile) {
      try {
        setPlayingPart(part);
        setCurrentFilePath(audioFile.filePath);
        setIsPlaying(true);
        await playAudioFile(audioFile.filePath);
      } catch (error) {
        console.error('Failed to play audio:', error);
        setIsPlaying(false);
      }
    }
  }, [playingNumber, audioFiles]);

  // Play just the word part
  const handlePlayWord = useCallback(async () => {
    if (selectedNumber === null) return;

    const audioPair = audioFiles.get(selectedNumber);
    const wordFile = audioPair?.wordAudio;

    if (wordFile) {
      try {
        // Clear any sequential queue
        setSequentialQueue([]);
        setIsSequentialPlaying(false);

        setPlayingNumber(selectedNumber);
        setPlayingPart('word');
        setCurrentFilePath(wordFile.filePath);
        setWordCurrentTime(0);
        setIsPlaying(true);
        await playAudioFile(wordFile.filePath);
      } catch (error) {
        console.error('Failed to play word audio:', error);
        setIsPlaying(false);
      }
    }
  }, [selectedNumber, audioFiles]);

  // Play just the digit part
  const handlePlayDigit = useCallback(async () => {
    if (selectedNumber === null) return;

    const audioPair = audioFiles.get(selectedNumber);
    const digitFile = audioPair?.digitAudio;

    if (digitFile) {
      try {
        // Clear any sequential queue
        setSequentialQueue([]);
        setIsSequentialPlaying(false);

        setPlayingNumber(selectedNumber);
        setPlayingPart('digit');
        setCurrentFilePath(digitFile.filePath);
        setDigitCurrentTime(0);
        setIsPlaying(true);
        await playAudioFile(digitFile.filePath);
      } catch (error) {
        console.error('Failed to play digit audio:', error);
        setIsPlaying(false);
      }
    }
  }, [selectedNumber, audioFiles]);

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
      // For add mode, select the newly added voice (last one matching current language)
      const newVoice = updatedVoices.find(
        (v) => v.language === selectedLanguage && !voices.some((existing) => existing.uuid === v.uuid)
      );
      if (newVoice) {
        setSelectedVoice(newVoice);
      }
    }
  }, [voiceFormState.mode, voiceFormState.voice, selectedVoice, selectedLanguage, voices]);

  const handleCloseVoiceForm = useCallback(() => {
    setVoiceFormState({ isOpen: false, mode: 'add', voice: null });
  }, []);

  const handleDeleteVoice = useCallback(async (voice: Voice) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the voice "${voice.customName}"?\n\nThis will remove the voice from the app but will not delete it from ElevenLabs.`
    );

    if (!confirmed) return;

    try {
      const updatedVoices = await deleteLocalVoice(voice.uuid);
      setVoices(updatedVoices);

      // If the deleted voice was selected, clear selection or select another voice
      if (selectedVoice?.uuid === voice.uuid) {
        const voicesForLanguage = updatedVoices.filter((v) => v.language === selectedLanguage);
        setSelectedVoice(voicesForLanguage[0] || null);
      }
    } catch (err) {
      console.error('Failed to delete voice:', err);
      setError('Error al eliminar la voz');
    }
  }, [selectedVoice, selectedLanguage]);

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
      await revealVoiceInFileManager(selectedLanguage, voice);
    } catch (err) {
      console.error('Failed to reveal voice in file manager:', err);
      setError('Could not open folder');
    }
  }, [selectedLanguage]);

  // Play a random recorded sample for a voice (word + digit)
  // Uses separate preview player - does NOT affect main player bar state
  const handlePlayVoiceSample = useCallback(async (voice: Voice) => {
    try {
      // Load audio files for this voice
      const files = await loadAudioFiles(selectedLanguage, voice, selectedMode);

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
  }, [selectedLanguage, selectedMode]);

  // Get audio state for selected number
  const selectedAudioPair = selectedNumber !== null ? audioFiles.get(selectedNumber) : null;
  const selectedHasWord = !!selectedAudioPair?.wordAudio;
  const selectedHasDigit = !!selectedAudioPair?.digitAudio;
  const selectedNeedsDigit = selectedNumber !== null && selectedNumber >= 10;

  // Get audio state for playing number
  const playingAudioPair = playingNumber !== null ? audioFiles.get(playingNumber) : null;
  const playingHasWord = !!playingAudioPair?.wordAudio;
  const playingHasDigit = !!playingAudioPair?.digitAudio;
  const playingNeedsDigit = playingNumber !== null && playingNumber >= 10;

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
          languages={languages}
          voices={voices}
          selectedLanguage={selectedLanguage}
          selectedVoice={selectedVoice}
          hasApiKey={hasActiveAccount}
          accountsState={accountsState}
          subscription={subscription}
          voiceHasRecordings={voiceHasRecordings}
          platform={platform}
          onLanguageChange={setSelectedLanguage}
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
                    <Trash2 size={14} />
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

          {/* Settings button */}
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setIsSettingsPanelOpen(!isSettingsPanelOpen)}
            title={isSettingsPanelOpen ? "Hide Settings" : "Show Settings"}
          >
            <Settings size={18} />
          </button>
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
          playingNumber={playingNumber}
          playingPart={playingPart}
          mode={selectedMode}
          filePath={currentFilePath}
          isPlaying={isPlaying}
          hasWord={playingHasWord}
          hasDigit={playingHasDigit}
          needsDigit={playingNeedsDigit}
          currentTime={currentTime}
          duration={duration}
          // Dual panel state
          wordFilePath={wordFilePath}
          digitFilePath={digitFilePath}
          wordDuration={wordDuration}
          digitDuration={digitDuration}
          wordCurrentTime={wordCurrentTime}
          digitCurrentTime={digitCurrentTime}
          // Playback actions
          onPlay={handlePlay}
          onPause={handlePause}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSwitchPart={handleSwitchPart}
          onSeek={handleSeek}
          canNavigate={getNumbersWithAudio().length > 1}
          // Dual panel playback actions
          onPlayWord={handlePlayWord}
          onPlayDigit={handlePlayDigit}
          // Generation actions
          onGenerateWord={handleGenerateWord}
          onGenerateDigit={handleGenerateDigit}
          onDelete={handleDeleteAudio}
          isGeneratingWord={isGeneratingWord}
          isGeneratingDigit={isGeneratingDigit}
          apiKeyConfigured={hasActiveAccount}
          voiceSelected={selectedVoice !== null}
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
        currentLanguage={selectedLanguage}
        apiKey={apiKey}
        onClose={handleCloseVoiceForm}
        onVoiceSaved={handleVoiceSaved}
      />

      {voiceLimitModalState && (
        <VoiceLimitModal
          voices={voiceLimitModalState.voices}
          onSelectVoice={voiceLimitModalState.onSelect}
          onCancel={voiceLimitModalState.onCancel}
        />
      )}

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
