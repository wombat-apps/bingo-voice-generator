# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A cross-platform desktop application that generates bingo number audio files using the ElevenLabs TTS API. Built with Tauri 2 (Rust backend) and React 19 (TypeScript frontend).

## Commands

```bash
# Install dependencies
npm install

# Development (full Tauri app with hot reload)
npm run tauri dev

# Production build for current platform
npm run tauri build

# Frontend-only dev server (no Rust backend)
npm run dev

# Rust commands (run from src-tauri/)
# Note: May need to set PATH first: export PATH="$HOME/.cargo/bin:$PATH"
cargo build                    # Build Rust backend
cargo check                    # Check Rust code compiles (faster)
cargo clippy                   # Lint Rust code
cargo fmt                      # Format Rust code
cargo test                     # Run Rust tests
```

Build outputs:
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/appimage/`

## Architecture

```
Frontend (React/TypeScript)     Backend (Rust/Tauri)
─────────────────────────────   ────────────────────────────
src/App.tsx                     src-tauri/src/lib.rs
    ↓                               ↓
src/services/tauri.ts  ←IPC→   src-tauri/src/commands/
    ↓                               ├── elevenlabs.rs (TTS API)
src/features/                       ├── storage.rs (file I/O)
    ├── grid/                       ├── voices.rs (voice CRUD)
    ├── sidebar/                    └── keychain.rs (secure storage)
    ├── player/
    └── voices/
```

**IPC Pattern**: Frontend calls `invoke()` from `@tauri-apps/api` → Rust commands in `src-tauri/src/commands/` → Results serialized back to TypeScript.

All Tauri command wrappers are in `src/services/tauri.ts`. When adding new backend functionality:
1. Add Rust command in `src-tauri/src/commands/`
2. Export from `src-tauri/src/commands/mod.rs`
3. Register in `src-tauri/src/lib.rs` invoke_handler
4. Add TypeScript wrapper in `src/services/tauri.ts`

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main state management, audio generation orchestration |
| `src/services/tauri.ts` | All Tauri command wrappers (type-safe IPC bridge) |
| `src/services/audioPlayer.ts` | Web Audio API playback and waveform |
| `src-tauri/src/lib.rs` | Tauri app setup, command registration |
| `src-tauri/src/models/number_words.rs` | Number-to-text mappings for all languages |
| `src-tauri/tauri.conf.json` | App config, window settings, security capabilities |

## Data Flow

1. User selects language/mode/voice in Sidebar
2. Clicks cell or "Generate All" → `App.tsx` orchestrates
3. Backend builds TTS text (`number_words.rs`) and calls ElevenLabs API
4. Audio saved to `~/.local/share/BingoVoiceGenerator/` (organized by language/voice/mode)
5. Frontend loads audio bytes and plays via Web Audio API

## Types

Shared types are defined in:
- Frontend: `src/types.ts`
- Backend: `src-tauri/src/models/`

Key types: `LanguageId`, `BingoModeId`, `AudioPart` (word/digit), `Voice`, `AudioFile`

## Conventions

- Feature-based organization in `src/features/` (component + CSS + index.ts per feature)
- Rust commands use `#[tauri::command]` attribute and return `Result<T, String>`
- API keys stored securely via system keychain (not in config files)
- TypeScript strict mode enabled
