# Bingo Voice Generator (Tauri)

Cross-platform desktop application that generates audio files for bingo numbers using the ElevenLabs text-to-speech API.

## Features

- **Bingo 90** (European): Numbers 1-90
- **Bingo 75** (American): B-I-N-G-O letters with numbers
- **Multiple Languages**: Spanish, English (US/UK), French, Portuguese, Italian
- **Two Audio Formats**: Word (full number) and Digit (individual digits)
- **Web Audio API**: Real-time playback and waveform visualization
- **Secure Storage**: API keys stored in system keychain

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
bingo-voice-generator-tauri/
├── src/                       # Frontend React
│   ├── App.tsx               # Main application
│   ├── types.ts              # TypeScript types
│   ├── features/             # React components
│   │   ├── grid/            # BingoGrid, BingoCell
│   │   ├── player/          # NowPlayingBar
│   │   └── sidebar/         # Sidebar
│   ├── services/            # API wrappers
│   │   ├── tauri.ts         # Tauri command wrappers
│   │   └── audioPlayer.ts   # Web Audio API
│   └── styles/              # CSS
├── src-tauri/                # Backend Rust
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── lib.rs           # Tauri app setup
│       ├── commands/        # Tauri commands
│       │   ├── elevenlabs.rs
│       │   ├── storage.rs
│       │   ├── voices.rs
│       │   └── keychain.rs
│       └── models/          # Data models
├── package.json
└── vite.config.ts
```

## Building

```bash
# Build for current platform
npm run tauri build

# The built application will be in:
# macOS: src-tauri/target/release/bundle/dmg/
# Windows: src-tauri/target/release/bundle/msi/
# Linux: src-tauri/target/release/bundle/appimage/
```

## License

MIT
