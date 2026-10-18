# Bingo Voice Generator

Desktop application (macOS, Apple Silicon) that generates audio files for bingo numbers using the ElevenLabs text-to-speech API.

## Features

- **Bingo 90** (European): Numbers 1-90
- **Bingo 75** (American): B-I-N-G-O letters with numbers
- **Multiple Languages**: Spanish, English (US/UK), French, Portuguese, Italian
- **Two Audio Formats**: Word (full number) and Digit (individual digits)
- **Web Audio API**: Decoding and waveform visualization; playback goes through `<audio>`
- **Multiple ElevenLabs Accounts**: Save several accounts and switch the active one; API keys stored in system keychain
- **ElevenLabs Plans**: What each plan allows and the errors it produces are in `docs/elevenlabs-plans.md`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript |
| Bundler | Vite 7 |
| Backend | Tauri 2 + Rust |
| HTTP | reqwest |
| Audio | Web Audio API |
| Icons | Lucide React |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install) (via rustup)
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### macOS

```bash
xcode-select --install
```

### Windows

- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Linux

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Project Structure

```
bingo-voice-generator/
├── src/                       # Frontend React
│   ├── App.tsx               # Main application
│   ├── types.ts              # TypeScript types
│   ├── features/             # React components
│   │   ├── grid/            # BingoGrid, BingoCell
│   │   ├── player/          # ActionBar, usePlayer and its state machine
│   │   ├── settings-panel/  # Settings, ElevenLabs Accounts
│   │   ├── sidebar/         # Sidebar, subscription info
│   │   └── voices/          # Voice form modal
│   ├── domain/              # Bingo Mode and Plan rules
│   ├── services/            # API wrappers
│   │   ├── tauri.ts         # Tauri command wrappers
│   │   └── audioPlayer.ts   # <audio> playback, waveform
│   └── styles/              # CSS
├── src-tauri/                # Backend Rust
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── lib.rs           # Tauri app setup
│       ├── commands/        # Tauri commands
│       │   ├── generation.rs # generate_audio
│       │   ├── elevenlabs/  # ElevenLabs client and commands
│       │   ├── storage.rs
│       │   ├── voices.rs
│       │   └── accounts.rs  # ElevenLabs Accounts, keys in Keychain
│       ├── services/        # AppDirs, audio_store, audio_trimmer
│       └── models/          # Data models
├── package.json
└── vite.config.ts
```

## Building

```bash
# Build for current platform
npm run tauri build

# The built application will be in src-tauri/target/release/bundle/
```

## Release

Releases are built by GitHub Actions (`.github/workflows/release.yml`) on a macOS runner: Apple Silicon only, signed with Developer ID, notarized, and published with a signed `latest.json` for the in-app updater.

```bash
git tag v0.3.0
git push origin v0.3.0
```

The tag is the only source of truth for the version, so there is no need to bump `tauri.conf.json` or `package.json` by hand. To test signing and notarization without publishing, run the workflow manually (Actions → Release → Run workflow); the bundle is uploaded as a workflow artifact.

Stable download URL: `https://github.com/wombat-apps/bingo-voice-generator/releases/latest/download/BingoVoiceGenerator.dmg`

## History

This app replaced an earlier native SwiftUI version, which is preserved at the `swift-final` tag. See `docs/adr/0001-tauri-replaces-native-swift.md`.

## License

MIT
