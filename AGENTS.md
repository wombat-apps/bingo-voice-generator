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

# Frontend tests (vitest)
npm test

# Rust commands (run from src-tauri/)
# Note: May need to set PATH first: export PATH="$HOME/.cargo/bin:$PATH"
cargo build                    # Build Rust backend
cargo check                    # Check Rust code compiles (faster)
cargo clippy                   # Lint Rust code
cargo fmt                      # Format Rust code
cargo test                     # Run Rust tests
```

Build outputs: `src-tauri/target/release/bundle/` (`.app` and `.dmg`).

## Keychain prompts in dev

Debug builds are ad-hoc signed and their signature changes on every rebuild, so macOS would ask for Keychain access on each launch even after "Always Allow". `src-tauri/.cargo/config.toml` sets `src-tauri/scripts/dev-codesign-run.sh` as the Cargo runner on macOS: it re-signs the app binary with the release bundle identifier and a stable identity, so "Always Allow" is remembered across rebuilds and shared with the signed release app.

The identity is the "Developer ID Application" certificate of the release team (`78R7RLKRQD`) found in the login keychain, with no setup needed. To use another one, set `BINGO_DEV_SIGNING_IDENTITY` (see `security find-identity -v -p codesigning`). Without either, or for test binaries, the runner just runs them. Release builds and CI do not go through it.

## Logs

`tauri-plugin-log` writes Rust `log::*` output, plus the webview's `console.error`/`console.warn` and uncaught errors, to stdout and to `~/Library/Logs/com.wombatapps.bingovoicegenerator/bingo-voice-generator.log`, in dev and in release builds. Failed ElevenLabs calls log the HTTP status and the raw response body. Use `log::*` macros, never `println!`. Keep `tauri-plugin-log` (Cargo) and `@tauri-apps/plugin-log` (npm) on the same minor version.

## CI / Release

- `.github/workflows/ci.yml`: runs on Linux on every PR and on pushes to `main`. It runs `npm run build` (tsc + vite), `npm test`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test`, all of which must pass. macOS-only `#[cfg]` code is only compiled during release.
- `.github/workflows/release.yml`: runs on `v*` tags, on macOS. tauri-action builds for `aarch64-apple-darwin`, signs with Developer ID, notarizes, and publishes a GitHub Release containing `latest.json` for `tauri-plugin-updater` plus a stable-name `BingoVoiceGenerator.dmg`. The version comes from the tag and is injected into `tauri.conf.json`, so never bump it by hand. Running it with `workflow_dispatch` is a dry run that uploads the bundle as an artifact.
- The updater public key is in `tauri.conf.json`. The private key is the `TAURI_SIGNING_PRIVATE_KEY` secret; if it is lost, existing installs can no longer update.

## History

The former native SwiftUI app is preserved at the `swift-final` tag (`git show swift-final:<path>`). `PENDING_FEATURES.md` lists the features still to port and links to the Swift sources there. See `docs/adr/0001-tauri-replaces-native-swift.md`.

## Architecture

```
Frontend (React/TypeScript)     Backend (Rust/Tauri)
─────────────────────────────   ────────────────────────────────────────
src/App.tsx                     src-tauri/src/lib.rs (manages AppDirs, ElevenLabs)
    ↓                               ↓
src/services/tauri.ts  ←IPC→   src-tauri/src/commands/
    ↓                               ├── generation.rs (generate_audio: text → TTS → save)
src/features/                       ├── elevenlabs/ (client.rs: one client per key, errors;
    ├── grid/                       │                types.rs: DTOs; mod.rs: commands)
    ├── sidebar/                    ├── storage.rs (thin commands over audio_store)
    ├── player/ (usePlayer,         ├── voices.rs (voice CRUD)
    │   player.ts reducer)          └── accounts.rs (ElevenLabs Accounts, keys in Keychain)
    ├── settings-panel/         src-tauri/src/services/
    └── voices/                     ├── app_dirs.rs (data root: voices.json, accounts.json, audio)
src/domain/                         ├── audio_store.rs (file names, Original/Trimmed Audio)
    ├── bingo.ts (Bingo Mode rules) └── audio_trimmer.rs
    └── plan.ts (Plan rules)
```

API keys only cross IPC into Rust: ElevenLabs commands resolve the Active Account's key themselves (`ElevenLabs::active_client`), and the frontend shows `keyHint`. The one exception is `reveal_account_api_key`, called when the user clicks to show a key; `AccountsSection` keeps it only while it is shown, never in app state. `ElevenLabs` takes its base URL and `AudioStore` its root, so tests run against a `wiremock` server and a temp directory.

**IPC Pattern**: Frontend calls `invoke()` from `@tauri-apps/api` → Rust commands in `src-tauri/src/commands/` → Results serialized back to TypeScript.

All Tauri command wrappers are in `src/services/tauri.ts`. When adding new backend functionality:
1. Add Rust command in `src-tauri/src/commands/`
2. Export from `src-tauri/src/commands/mod.rs`
3. Register in `src-tauri/src/lib.rs` invoke_handler
4. Add TypeScript wrapper in `src/services/tauri.ts`

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main state: selection, Voices, accounts, generation and deletion |
| `src/features/player/player.ts` | Player state machine (Word then Digit, navigation), tested with vitest |
| `src/domain/bingo.ts`, `src/domain/plan.ts` | Bingo Mode and Plan rules the UI needs |
| `src-tauri/src/commands/generation.rs` | Generates a Word or Digit end to end |
| `src-tauri/src/services/audio_store.rs` | Where audio lives and how files are named |
| `src/services/tauri.ts` | All Tauri command wrappers (type-safe IPC bridge) |
| `src/services/audioPlayer.ts` | `<audio>` playback, decoding and waveform |
| `src-tauri/src/lib.rs` | Tauri app setup, command registration |
| `src-tauri/src/models/accent.rs` | Accents: locale tag, name, flag, Voice Library label, scene |
| `src-tauri/src/models/number_words.rs` | Number words, Bingo 75 letters and phrasing per Language |
| `src-tauri/tauri.conf.json` | App config, window settings, security capabilities |

## Data Flow

1. User selects Accent/mode/voice in Sidebar (an Accent belongs to a Language, which sets the number words; see `GLOSSARY.md`)
2. Selects a number and clicks Word or Digit in the action bar (one request per part; there is no batch generation) → `App.tsx` calls `generate_audio` once
3. `generate_audio` builds the TTS text for the Voice's Accent (`number_words.rs` for the Language's words, `accent.rs` for the scene) and calls ElevenLabs with the Active Account
4. `audio_store` keeps the untrimmed Original Audio in `~/Library/Application Support/BingoVoiceGenerator/Originals/<accent>/<voice uuid>/`, trims the trailing silence and saves the Trimmed Audio to `~/Library/Application Support/BingoVoiceGenerator/<accent>/<voice uuid>/` (the part is in the file name, and the Bingo 75 Word also carries its letter, e.g. `n45_word.mp3`; the Digit is shared by both Bingo Modes, e.g. `45_digit.mp3`, and numbers below 10 have none; see `GLOSSARY.md`)
5. The Player (`usePlayer`) loads the Trimmed Audio bytes and plays them through `<audio>`

## Types

Shared types are defined in:
- Frontend: `src/types.ts`
- Backend: `src-tauri/src/models/`

Key types: `AccentId`, `BingoModeId`, `AudioPart` (word/digit), `Voice`, `AudioFile`

## Conventions

- Feature-based organization in `src/features/` (component + CSS + index.ts per feature)
- Rust commands use `#[tauri::command]` attribute and return `Result<T, E>`, where `E` is a `thiserror` enum that implements `Serialize` (e.g. `ElevenLabsError` serializes to `{code, message}`, plus `status` and `apiCode` for `API_ERROR`, and `GenerationError` adds `NO_DIGIT` and `STORAGE_ERROR`, so the frontend receives a plain object, not an `Error`; see `src/services/errors.ts`)
- Commands take `State<AppDirs>` and `State<ElevenLabs>` instead of building paths or HTTP clients themselves
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
