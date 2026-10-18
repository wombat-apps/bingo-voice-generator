#!/bin/sh
# Cargo runner for macOS (see ../.cargo/config.toml).
#
# Debug builds are ad-hoc signed, so their code signature changes on every rebuild and
# macOS asks again for Keychain access even after "Always Allow". When
# BINGO_DEV_SIGNING_IDENTITY names a code-signing identity (e.g. "Developer ID Application:
# Jane Doe (TEAMID)"), the app binary is re-signed with it and the release bundle
# identifier, so the Keychain recognises it across rebuilds. Without the variable, or for
# any other binary (tests), it just runs.
set -e

binary="$1"

if [ -n "$BINGO_DEV_SIGNING_IDENTITY" ] && [ "$(basename "$binary")" = "bingo-voice-generator-tauri" ]; then
    if ! codesign --force --timestamp=none \
        --identifier com.wombatapps.bingovoicegenerator \
        --sign "$BINGO_DEV_SIGNING_IDENTITY" "$binary"; then
        echo "dev-codesign-run: could not sign with \"$BINGO_DEV_SIGNING_IDENTITY\", running unsigned" >&2
    fi
fi

exec "$@"
