# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

macOS SwiftUI app that generates audio files for bingo numbers using the ElevenLabs text-to-speech API. Supports Bingo 90 (European, 1-90) and Bingo 75 (American, B-I-N-G-O letters) in Spanish, English (US/UK), French, Portuguese, and Italian.

## Build Commands

```bash
# Build only (check compilation)
swift build

# Build and run (recommended for development)
./Scripts/compile_and_run.sh

# Build universal binary (Intel + Apple Silicon)
./Scripts/compile_and_run.sh --release-universal

# Launch without rebuilding
./Scripts/launch.sh

# Package .app bundle (debug or release)
./Scripts/package_app.sh release
```

Note: This project has no test suite.

## Release Workflow

```bash
# 1. Generate Sparkle keys (first time only)
./Scripts/generate_sparkle_keys.sh

# 2. Create signed release (requires APP_IDENTITY in signing.env)
./Scripts/create_release.sh

# 3. Generate appcast.xml for Sparkle updates
./Scripts/generate_appcast.sh releases/BingoVoiceGenerator-x.x.x.zip
```

Config files: `version.env` (version/build), `sparkle.env` (update feed), `signing.env` (code signing identity)

## Other Scripts

- `download_ffmpeg.sh` - Downloads static ffmpeg binary for silence trimming
- `build_icon.sh` - Generates `.icns` from `.icon` using Xcode tools

## Architecture

**Tech Stack**: Swift 6.2, SwiftUI, SwiftPM, macOS 14+, Sparkle (auto-updates)

**State Management**: `@Observable` `@MainActor` classes injected via SwiftUI environment:
- `AppState`: UI selections (language, voice, mode), audio file cache, playback
- `GenerationState`: API key, generation progress, error handling
- `SettingsState`: ElevenLabs model/format preferences
- `VoiceStore`: Fetches and caches available voices from ElevenLabs API
- `SharedVoicePickerState`: Voice picker UI state

**Services**: Actor-based singletons for thread safety:
- `ElevenLabsService`: TTS API client
- `AudioStorageService`: File I/O at `~/Library/Application Support/BingoVoiceGenerator/{lang}/{voice}/{mode}/`
- `AudioPlayerService`: AVAudioPlayer wrapper
- `PreviewAudioService`: Preview audio generation and playback
- `SilenceTrimmingService`: Trims silence from audio using bundled ffmpeg
- `WaveformService`: Generates waveform data for audio visualization
- `ExportService`: Exports audio files to various formats
- `KeychainService`: Secure API key storage

**Data Flow**:
1. User configures ElevenLabs API key in the main screen control panel → saved to Keychain
2. User selects language/voice/mode → AppState triggers `refreshAudioFiles()`
3. Generate button → `GenerationState.generate()` → `TextBuilder` creates TTS prompt → `ElevenLabsService` calls API → `AudioStorageService` saves MP3

## Key Files

- `Sources/BingoVoiceGenerator/Config/NumberWords.swift` - TTS text patterns and digit words per language
- `Sources/BingoVoiceGenerator/Models/Language.swift` - Language enum with ElevenLabs codes and accents
- `Sources/BingoVoiceGenerator/Services/TextBuilder.swift` - Generates speech text from number
- `Sources/BingoVoiceGenerator/Resources/ffmpeg` - Bundled ffmpeg binary for audio processing
- `version.env` - Marketing version and build number (sourced by package scripts)
- `sparkle.env` - Sparkle feed URL and public key (not committed, create locally)
- `signing.env` - APP_IDENTITY for code signing (not committed, create locally)

## Adding Languages/Voices

1. Add to `Language` enum with rawValue, displayName, flag, elevenLabsCode
2. Add language config to `NumberWords.swift` (digits, numbers, speech patterns)
3. Add voice entry to `Voice.allVoices` with ElevenLabs voice ID

## Concurrency

Swift 6.2 strict concurrency enabled. All UI updates on `@MainActor`, services are actors, types conform to `Sendable`.
