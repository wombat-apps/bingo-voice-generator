# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

bingo!! studio: a desktop application (macOS, Apple Silicon only for now) that generates bingo number audio files using the ElevenLabs TTS API, for the Bundled Voices of bingo!! and bingo!! lite. Write the name as `bingo!! studio`, lowercase, like the rest of the bingo!! family. Only the visible name changed from "Bingo Voice Generator": the bundle identifier, the data folder, the Keychain service, the DMG name and the repository keep the old name (see `docs/adr/0002-rename-to-bingo-studio-keeping-identifiers.md`). Built with Tauri 2 (Rust backend) and React 19 (TypeScript frontend).

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

# Typecheck + ESLint
npm run lint

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

`tauri-plugin-log` writes Rust `log::*` output, plus the webview's `console.error`/`console.warn` and uncaught errors, to stdout and to `~/Library/Logs/com.wombatapps.bingovoicegenerator/bingo-voice-generator.log`, in dev and in release builds. Every ElevenLabs call logs, at debug level, its method, URL and request body (never the `xi-api-key` header), its status and, for JSON, the response body; failed calls also log the status and raw body as errors. The app's own crate logs at debug level in release builds too; the file rotates at 5 MB and keeps 3. Use `log::*` macros, never `println!`. Keep `tauri-plugin-log` (Cargo) and `@tauri-apps/plugin-log` (npm) on the same minor version.

## CI / Release

- `.github/workflows/ci.yml`: runs on Linux on every PR and on pushes to `main`. It runs `npm run build` (tsc + vite), `eslint src`, `npm test`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` and `cargo machete` (unused crates), all of which must pass. ESLint forbids `alert`/`confirm`/`prompt`: Tauri plugins replace them at runtime, so call the plugin through `src/services/tauri.ts`. macOS-only `#[cfg]` code is only compiled during release.
- `.github/workflows/release.yml`: runs on `v*` tags, on macOS. tauri-action builds for `aarch64-apple-darwin`, signs with Developer ID, notarizes, and publishes a GitHub Release containing `latest.json` for `tauri-plugin-updater` plus a stable-name `BingoVoiceGenerator.dmg`. The version comes from the tag and is injected into `tauri.conf.json`. Between releases, `tauri.conf.json` and `package.json` carry `X.Y.(Z+1)-dev` (above the last release, below the next): after each `vX.Y.Z` tag, set it in a manual `chore: Start X.Y.(Z+1)-dev` commit, and never change it otherwise. Running it with `workflow_dispatch` is a dry run that uploads the bundle as an artifact.
- The updater public key is in `tauri.conf.json`. The private key is the `TAURI_SIGNING_PRIVATE_KEY` secret; if it is lost, existing installs can no longer update.

## History

The former native SwiftUI app is preserved at the `swift-final` tag (`git show swift-final:<path>`). `PENDING_FEATURES.md` lists the features still to port and links to the Swift sources there. See `docs/adr/0001-tauri-replaces-native-swift.md`.

## Architecture

```
Frontend (React/TypeScript)     Backend (Rust/Tauri)
─────────────────────────────   ────────────────────────────────────────
src/App.tsx                     src-tauri/src/lib.rs (manages AppDirs, ElevenLabs, PendingUpdate)
    ↓                           src-tauri/src/menu.rs (app menu, "Check for Updates…")
src/services/tauri.ts  ←IPC→   src-tauri/src/commands/
    ↓                               ├── generation.rs (generate_audio: text → TTS → save)
src/features/                       ├── elevenlabs/ (client.rs: one client per key, errors;
    ├── grid/                       │                types.rs: DTOs; mod.rs: commands)
    ├── sidebar/                    ├── storage.rs (thin commands over audio_store)
    ├── player/ (usePlayer,         ├── voices.rs (voice CRUD)
    │   player.ts reducer)          ├── formats.rs (Word/Digit Format CRUD, selection, preview)
    ├── accounts/ (AccountSwitcher  ├── accounts.rs (ElevenLabs Accounts commands)
    │   at the sidebar's bottom)    └── updater.rs (check_for_update, install_update)
    ├── settings-panel/ (Voice Settings)
    ├── formats/ (Word and Digit    src-tauri/src/services/
    │   Format pickers, editors)          ├── app_dirs.rs (data root: voices.json, accounts.json,
    ├── updater/ (useUpdater,       │                formats.json, audio)
    │   update.ts rules)            ├── account_store.rs (accounts.json, Active Account, keys in Keychain)
    └── voices/                     ├── format_store.rs (formats.json, selection per Language)
src/domain/                         ├── audio_store.rs (file names, Original/Trimmed Audio)
    ├── bingo.ts (Bingo Mode rules) └── audio_trimmer.rs
    └── plan.ts (Plan rules)
```

API keys only cross IPC into Rust: ElevenLabs commands resolve the Active Account's key themselves (`ElevenLabs::active_client`, through `AccountStore`), and the frontend shows `keyHint`. The one exception is `reveal_account_api_key`, called when the user clicks to show a key; `AccountSwitcher` (the account menu at the bottom of the sidebar) keeps it only while it is shown and forgets it when the menu closes, never in app state. `ElevenLabs` takes its base URL and `AudioStore` its root, so tests run against a `wiremock` server and a temp directory.

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
3. `generate_audio` builds the TTS text for the Voice's Accent (`number_words.rs` for the Language's words, written in the Word Format and Digit Format selected for its Language, also in the context, `accent.rs` for the scene) and calls ElevenLabs with the Active Account
4. `audio_store` keeps the untrimmed Original Audio in `~/Library/Application Support/BingoVoiceGenerator/Originals/<accent>/<voice uuid>/`, trims the trailing silence and saves the Trimmed Audio to `~/Library/Application Support/BingoVoiceGenerator/<accent>/<voice uuid>/` (the part is in the file name, and the Bingo 75 Word also carries its letter, e.g. `n45_word.mp3`; the Digit is shared by both Bingo Modes, e.g. `45_digit.mp3`, and numbers below 10 have none; see `GLOSSARY.md`). Both files carry their Generation Details (format, text sent, Voice Settings) in an ID3 tag, which the info button of each player track shows (`read_generation_details`; see `docs/adr/0003-generation-details-in-id3-tags.md`)
5. The Player (`usePlayer`) loads the Trimmed Audio bytes and plays them through `<audio>`

## Types

Shared types are defined in:
- Frontend: `src/types.ts`
- Backend: `src-tauri/src/models/`

Key types: `AccentId`, `BingoModeId`, `AudioPart` (word/digit), `Voice`, `AudioFile`, `AudioFileId` (Accent, Voice, Bingo Mode, number and part: what names one audio file and what `AudioStore` takes), `VoiceNumber` (the same without the part)

## Conventions

- Feature-based organization in `src/features/` (component + CSS + index.ts per feature)
- Rust commands use `#[tauri::command]` attribute and return `Result<T, E>`, where `E` is a `thiserror` enum that implements `Serialize` (e.g. `ElevenLabsError` serializes to `{code, message}`, plus `status` and `apiCode` for `API_ERROR`, `StorageError` to `{code: "STORAGE_ERROR", message}`, `UpdateError` to `{code: "UPDATE_ERROR", message}`, and `GenerationError` adds `NO_DIGIT`, so the frontend receives a plain object, not an `Error`; see `src/services/errors.ts`)
- Commands take `State<AppDirs>` and `State<ElevenLabs>` instead of building paths or HTTP clients themselves
- API keys stored securely via system keychain (not in config files), through `keyring-core` and `apple-native-keyring-store`'s legacy `keychain` store, which is where keyring 3 saved them (`protected` would not see them). `run()` registers it in `.setup` (`account_store::use_login_keychain`); tests use `keyring_core::mock`
- TypeScript strict mode enabled
- Plugins the webview does not need (updater, process) are used from Rust only; do not add their JS packages or permissions. The updater runs through `check_for_update` and `install_update` (`src-tauri/src/commands/updater.rs`), and the app menu (`src-tauri/src/menu.rs`) only emits `check-for-update-requested` to the webview

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `wombat-apps/bingo-voice-generator` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### ElevenLabs Plans

`docs/elevenlabs-plans.md` lists what each ElevenLabs Plan allows (quota, Library Voices, formats, concurrency), the API key permissions the app needs and the API error codes. Read it before touching ElevenLabs error handling or voice availability, and update it, with sources and date, when you learn something new.
