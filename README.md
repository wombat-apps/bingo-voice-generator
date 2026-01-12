# Bingo Voice Generator

Native macOS app to generate audio files for bingo numbers using the ElevenLabs TTS API.

## Features

- **Bingo 90** (numbers 1-90) - European format
- **Bingo 75** (numbers 1-75 with B-I-N-G-O letters) - American format
- **Two-part audio**: Word part ("forty-two") + digit part ("four-two") for numbers 10+
- **Now Playing bar** with waveform visualization and seek control
- **Automatic silence trimming** using bundled ffmpeg
- **Import/Export voices** as ZIP files for backup or sharing
- **Voice favorites** with star system
- **Custom voice naming** for ElevenLabs voices
- **Batch generation** with progress tracking and cancellation
- Individual generation or regeneration of audio parts
- Playback with previous/next navigation
- Secure API key storage in Keychain
- Automatic updates via Sparkle

## Supported Languages

| Language | Code |
|----------|------|
| Spanish | es-ES |
| English (US) | en-US |
| English (UK) | en-GB |
| French | fr-FR |
| Portuguese | pt-BR |
| Italian | it-IT |

Voices are added directly from your ElevenLabs account. Any voice available in your ElevenLabs library can be used with any supported language.

## Requirements

- macOS 14 or later
- Swift 6.2+
- [ElevenLabs](https://elevenlabs.io) account with API key

## Installation

### Download (Recommended)

1. Download the latest version from [GitHub Releases](https://github.com/wombat-apps/bingo-voice-generator/releases/latest)
2. Unzip `BingoVoiceGenerator-x.x.x.zip`
3. Move `Bingo Voice Generator.app` to your Applications folder
4. On first launch, right-click and select "Open" to bypass Gatekeeper

The app includes automatic updates via Sparkle.

### Build from Source

Requires Xcode with Swift 6.2+.

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
2. Enter your ElevenLabs API key in the sidebar panel
3. Click "Test Connection" to verify

## Audio Files

Audio files are saved at:

```
~/Library/Application Support/BingoVoiceGenerator/
└── {language}/
    └── {voice-uuid}/
        ├── 1_word.mp3        # Bingo 90
        ├── 45_word.mp3
        ├── 45_digit.mp3
        ├── b1_word.mp3       # Bingo 75 (with letter prefix)
        ├── b15_word.mp3
        ├── b15_digit.mp3
        └── ...
```

File naming: `{number}_word.mp3` and `{number}_digit.mp3`. Bingo 75 files include the letter prefix (b, i, n, g, o).

## Voice Settings

Voice parameters are configurable in the Settings sidebar:

- **Stability** (0.0-1.0): Lower = more expressive, higher = more consistent
- **Similarity Boost** (0.0-1.0): How closely to match the original voice
- **Style** (0.0-1.0): Style exaggeration intensity
- **Speaker Boost**: Enhances voice clarity
- **Speed**: Playback speed adjustment

## Tech Stack

- **Framework**: SwiftUI
- **Language**: Swift 6.2 (strict concurrency)
- **Platform**: macOS 14+
- **Dependencies**: Sparkle 2.8.0 (automatic updates)

## License

MIT License
