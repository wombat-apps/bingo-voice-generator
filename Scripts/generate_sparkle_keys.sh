#!/usr/bin/env bash
set -euo pipefail

# Generate EdDSA keys for Sparkle update signing
# The private key is stored in the macOS Keychain
# The public key should be added to sparkle.env

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SPARKLE_TOOLS="$ROOT/.build/artifacts/sparkle/Sparkle/bin"

if [[ ! -d "$SPARKLE_TOOLS" ]]; then
  echo "Error: Sparkle tools not found at $SPARKLE_TOOLS"
  echo "Run 'swift build' first to fetch the Sparkle dependency."
  exit 1
fi

echo "Generating EdDSA key pair for Sparkle..."
echo "The private key will be stored in your macOS Keychain."
echo ""

"$SPARKLE_TOOLS/generate_keys"

echo ""
echo "=== IMPORTANT ==="
echo "1. Copy the SUPublicEDKey value shown above"
echo "2. Create $ROOT/sparkle.env with the following content:"
echo ""
echo "   SPARKLE_PUBLIC_ED_KEY=<your-public-key>"
echo "   SPARKLE_FEED_URL=https://github.com/YOUR_ORG/bingo-voice-generator/releases/latest/download/appcast.xml"
echo "   ENABLE_SPARKLE=1"
echo ""
echo "3. For CI/CD, export the private key securely:"
echo "   $SPARKLE_TOOLS/generate_keys -x sparkle_private_key.pem"
echo "   Then store as a GitHub secret: SPARKLE_PRIVATE_KEY"
echo ""
