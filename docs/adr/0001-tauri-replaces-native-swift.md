# Tauri replaces the native Swift app

Both the native SwiftUI app and the Tauri 2 (Rust + React) port began as experiments and neither shipped to real users. We keep only the Tauri app, so a single codebase can reach Windows and Linux later. The Swift sources are removed from `main` and stay reachable through the `swift-final` tag, and porting the remaining features means reading that tag. Releases continue the existing tag line from `v0.3.0` and use the Tauri updater instead of Sparkle.

## Consequences

- CI (typecheck, fmt, clippy, tests) runs on Linux runners because they are cheaper, so the `#[cfg(target_os = "macos")]` paths are only compiled during release. CD has to run on macOS for Developer ID signing and notarization, and it builds for Apple Silicon only.
- The updater signing key cannot be rotated without stranding installed copies: losing `TAURI_SIGNING_PRIVATE_KEY` forces every user to reinstall manually.
