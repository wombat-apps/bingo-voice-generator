#!/usr/bin/env bash
set -euo pipefail

# Create a signed release package with Sparkle support
# Usage: ./Scripts/create_release.sh

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

# Load version
source "$ROOT/version.env"

# Load Sparkle config
if [[ -f "$ROOT/sparkle.env" ]]; then
  source "$ROOT/sparkle.env"
fi

APP_NAME="BingoVoiceGenerator"
RELEASES_DIR="$ROOT/releases"
mkdir -p "$RELEASES_DIR"

# Validate required variables
if [[ -z "${APP_IDENTITY:-}" ]]; then
  echo "Error: APP_IDENTITY must be set to your Developer ID Application certificate"
  echo "Example: export APP_IDENTITY='Developer ID Application: Your Name (TEAM_ID)'"
  exit 1
fi

if [[ -z "${SPARKLE_PUBLIC_ED_KEY:-}" ]]; then
  echo "Warning: SPARKLE_PUBLIC_ED_KEY not set. Sparkle will be disabled."
  echo "Run Scripts/generate_sparkle_keys.sh to generate keys."
fi

echo "=== Building Release v${MARKETING_VERSION} (${BUILD_NUMBER}) ==="

# Build with Sparkle enabled
export ENABLE_SPARKLE=1
export SIGNING_MODE=developerid
./Scripts/package_app.sh release

APP_PATH="$ROOT/${APP_NAME}.app"

# Verify code signature
echo "Verifying code signature..."
codesign --verify --deep --strict "$APP_PATH"

echo "Verifying Gatekeeper acceptance..."
if ! spctl --assess --type execute "$APP_PATH" 2>/dev/null; then
  echo "Warning: App may not pass Gatekeeper. Consider notarizing."
fi

# Create ZIP for distribution
ZIP_NAME="${APP_NAME}-${MARKETING_VERSION}.zip"
ZIP_PATH="$RELEASES_DIR/$ZIP_NAME"

echo "Creating distribution archive: $ZIP_NAME"
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo ""
echo "=== Release Package Created ==="
echo "Archive: $ZIP_PATH"
echo "Size: $(du -h "$ZIP_PATH" | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Generate appcast: ./Scripts/generate_appcast.sh $ZIP_PATH"
echo "2. Create GitHub Release for v${MARKETING_VERSION} in your PUBLIC releases repo"
echo "   (e.g., github.com/YOUR_ORG/bingo-voice-generator-releases)"
echo "3. Upload to the release: $ZIP_PATH and $RELEASES_DIR/appcast.xml"
echo ""
echo "Optional: Notarize before release:"
echo "  xcrun notarytool submit '$ZIP_PATH' --apple-id YOUR_APPLE_ID --password YOUR_APP_PASSWORD --team-id YOUR_TEAM_ID --wait"
