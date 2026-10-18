#!/bin/sh
# Cargo runner for macOS (see ../.cargo/config.toml).
#
# Debug builds are ad-hoc signed, so their code signature changes on every rebuild and
# macOS asks again for Keychain access even after "Always Allow". This re-signs the app
# binary with a stable identity and the release bundle identifier, so the Keychain
# recognises it across rebuilds.
#
# Identity: BINGO_DEV_SIGNING_IDENTITY if set, otherwise the "Developer ID Application"
# identity of the release team found in the login keychain. If there is none, or for any
# other binary (tests), it just runs.
set -e

TEAM_ID="78R7RLKRQD"
binary="$1"

if [ "$(basename "$binary")" = "bingo-voice-generator-tauri" ]; then
    identity="$BINGO_DEV_SIGNING_IDENTITY"
    if [ -z "$identity" ]; then
        # Matching on the name is safe for Developer ID certificates: the value in
        # parentheses is the team ID. Sign with the SHA-1 hash so the choice is unambiguous.
        identity=$(security find-identity -v -p codesigning 2>/dev/null |
            awk -v team="($TEAM_ID)\"" '/"Developer ID Application: / && index($0, team) { print $2; exit }')
    fi

    if [ -n "$identity" ]; then
        if ! codesign --force --timestamp=none \
            --identifier com.wombatapps.bingovoicegenerator \
            --sign "$identity" "$binary"; then
            echo "dev-codesign-run: could not sign with \"$identity\", running unsigned" >&2
        fi
    fi
fi

exec "$@"
