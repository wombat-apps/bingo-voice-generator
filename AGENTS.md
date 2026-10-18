# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

A desktop application (macOS, Apple Silicon only for now) that generates bingo number audio files using the ElevenLabs TTS API. Built with Tauri 2 (Rust backend) and React 19 (TypeScript frontend).

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

Build outputs: `src-tauri/target/release/bundle/` (`.app` and `.dmg`).

## Logs

`tauri-plugin-log` writes Rust `log::*` output, plus the webview's `console.error`/`console.warn` and uncaught errors, to stdout and to `~/Library/Logs/com.wombatapps.bingovoicegenerator/bingo-voice-generator.log`, in dev and in release builds. Failed ElevenLabs calls log the HTTP status and the raw response body. Use `log::*` macros, never `println!`. Keep `tauri-plugin-log` (Cargo) and `@tauri-apps/plugin-log` (npm) on the same minor version.

## CI / Release

- `.github/workflows/ci.yml`: runs on Linux on every PR and on pushes to `main`. It runs `npm run build` (tsc + vite), `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test`, all of which must pass. macOS-only `#[cfg]` code is only compiled during release.
- `.github/workflows/release.yml`: runs on `v*` tags, on macOS. tauri-action builds for `aarch64-apple-darwin`, signs with Developer ID, notarizes, and publishes a GitHub Release containing `latest.json` for `tauri-plugin-updater` plus a stable-name `BingoVoiceGenerator.dmg`. The version comes from the tag and is injected into `tauri.conf.json`, so never bump it by hand. Running it with `workflow_dispatch` is a dry run that uploads the bundle as an artifact.
- The updater public key is in `tauri.conf.json`. The private key is the `TAURI_SIGNING_PRIVATE_KEY` secret; if it is lost, existing installs can no longer update.

## History

The former native SwiftUI app is preserved at the `swift-final` tag (`git show swift-final:<path>`). `PENDING_FEATURES.md` lists the features still to port and links to the Swift sources there. See `docs/adr/0001-tauri-replaces-native-swift.md`.

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
    ├── sidebar/                    └── accounts.rs (ElevenLabs Accounts, keys in Keychain)
    ├── player/
    ├── settings-panel/
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
2. Selects a number and clicks Word or Digit in the action bar (one request per part; there is no batch generation) → `App.tsx` orchestrates
3. Backend builds TTS text (`number_words.rs`) and calls ElevenLabs API
4. Audio saved to `~/Library/Application Support/BingoVoiceGenerator/<language>/<voice uuid>/` (mode and part are in the file name)
5. Frontend loads audio bytes and plays via Web Audio API

## Types

Shared types are defined in:
- Frontend: `src/types.ts`
- Backend: `src-tauri/src/models/`

Key types: `LanguageId`, `BingoModeId`, `AudioPart` (word/digit), `Voice`, `AudioFile`

## Conventions

- Feature-based organization in `src/features/` (component + CSS + index.ts per feature)
- Rust commands use `#[tauri::command]` attribute and return `Result<T, E>`, where `E` is a `thiserror` enum that implements `Serialize` (e.g. `ElevenLabsError` serializes to `{code, message}`, plus `status` and `apiCode` for `API_ERROR`, so the frontend receives a plain object, not an `Error`; see `src/services/errors.ts`)
- API keys stored securely via system keychain (not in config files)
- TypeScript strict mode enabled

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `wombat-apps/bingo-voice-generator` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### ElevenLabs Plans

`docs/elevenlabs-plans.md` lists what each ElevenLabs Plan allows (quota, Library Voices, formats, concurrency), the API key permissions the app needs and the API error codes. Read it before touching ElevenLabs error handling or voice availability, and update it, with sources and date, when you learn something new.
