#!/usr/bin/env bash
set -euo pipefail

# Generate or update appcast.xml for Sparkle updates
# Usage: ./Scripts/generate_appcast.sh <path-to-signed-zip>

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SPARKLE_TOOLS="$ROOT/.build/artifacts/sparkle/Sparkle/bin"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path-to-signed-app.zip>"
  echo "Example: $0 ./releases/BingoVoiceGenerator-1.0.0.zip"
  exit 1
fi

ZIP_PATH="$1"
RELEASES_DIR=$(dirname "$ZIP_PATH")

if [[ ! -f "$ZIP_PATH" ]]; then
  echo "Error: File not found: $ZIP_PATH"
  exit 1
fi

if [[ ! -d "$SPARKLE_TOOLS" ]]; then
  echo "Error: Sparkle tools not found at $SPARKLE_TOOLS"
  echo "Run 'swift build' first to fetch the Sparkle dependency."
  exit 1
fi

# Load configuration
if [[ -f "$ROOT/sparkle.env" ]]; then
  source "$ROOT/sparkle.env"
fi

# Extract version from filename (e.g., BingoVoiceGenerator-1.0.0.zip -> v1.0.0)
FILENAME=$(basename "$ZIP_PATH")
VERSION=$(echo "$FILENAME" | sed -E 's/.*-([0-9]+\.[0-9]+\.[0-9]+)\.zip/\1/')

DOWNLOAD_URL_PREFIX=${DOWNLOAD_URL_PREFIX:-https://github.com/YOUR_ORG/bingo-voice-generator/releases/download/v${VERSION}}

echo "Generating appcast.xml..."
echo "Releases directory: $RELEASES_DIR"
echo "Download URL prefix: $DOWNLOAD_URL_PREFIX"

# generate_appcast processes all archives in the directory
# and creates/updates appcast.xml with EdDSA signatures
"$SPARKLE_TOOLS/generate_appcast" \
  --download-url-prefix "$DOWNLOAD_URL_PREFIX" \
  "$RELEASES_DIR"

echo ""
echo "Appcast generated at: $RELEASES_DIR/appcast.xml"
echo ""
echo "Upload to GitHub Release:"
echo "  - $ZIP_PATH"
echo "  - $RELEASES_DIR/appcast.xml"
