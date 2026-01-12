# Bingo Voice Generator

Native macOS app to generate audio files for bingo numbers using the ElevenLabs TTS API.

## Features

- **Bingo 90** (numbers 1-90) - European format
- **Bingo 75** (numbers 1-75 with B-I-N-G-O letters) - American format
- Individual generation or regeneration of audio files
- Playback of generated audio
- Secure API key storage in Keychain
- Automatic updates via Sparkle

## Languages and Voices

| Language | Voices |
|----------|--------|
| Spanish (es-ES) | Lucia, Manuel |
| English (en-US) | Aria |
| French (fr-FR) | Marie |

## Requirements

- macOS 14 or later
- Swift 6.2+
- [ElevenLabs](https://elevenlabs.io) account with API key

## Installation

```bash
git clone git@github.com:wombat-apps/bingo-voice-generator.git
cd bingo-voice-generator
swift build
```

## Usage

### Build and Run

```bash
# Option 1: Direct command
swift build && ./.build/arm64-apple-macosx/debug/BingoVoiceGenerator

# Option 2: Convenience script
./Scripts/compile_and_run.sh
```

### Build for Distribution

```bash
# Release build with code signing
./Scripts/package_app.sh release
```

### Configure API Key

1. Open the application
2. Go to Settings (Cmd+,)
3. Enter your ElevenLabs API key

## Generated Files Structure

Audio files are saved at:

```
~/Library/Application Support/BingoVoiceGenerator/
├── es-ES/
│   ├── lucia/
│   │   ├── bingo90/
│   │   │   ├── 1.mp3
│   │   │   └── ...
│   │   └── bingo75/
│   │       ├── 1.mp3
│   │       └── ...
│   └── manuel/
│       └── ...
├── en-US/
│   └── aria/
│       └── ...
└── fr-FR/
    └── marie/
        └── ...
```

## Voice Configuration (ElevenLabs)

```swift
voiceSettings = [
    "stability": 0.0,           // 0.0=Creative, 0.5=Natural, 1.0=Robust
    "similarity_boost": 0.85,
    "style": 0.75,
    "use_speaker_boost": true
]
```

## Adding New Languages/Voices

1. Add a case to the `Language` enum in `Sources/BingoVoiceGenerator/Models/Language.swift`
2. Add language configuration in `Sources/BingoVoiceGenerator/Config/NumberWords.swift`
3. Add ElevenLabs voice ID in `Sources/BingoVoiceGenerator/Models/Voice.swift`

## Tech Stack

- **Framework**: SwiftUI
- **Language**: Swift 6 (strict concurrency)
- **Platform**: macOS 14+
- **Dependencies**: Sparkle 2.8.0 (automatic updates)
