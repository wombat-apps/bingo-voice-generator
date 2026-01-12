#!/bin/bash
# Downloads static ffmpeg binary for macOS (universal arm64/x86_64)
# Source: evermeet.cx - well-known provider of static ffmpeg builds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$PROJECT_ROOT/Sources/BingoVoiceGenerator/Resources"
FFMPEG_PATH="$RESOURCES_DIR/ffmpeg"

# Check if ffmpeg already exists
if [ -f "$FFMPEG_PATH" ]; then
    echo "ffmpeg already exists at $FFMPEG_PATH"
    echo "Version: $("$FFMPEG_PATH" -version 2>/dev/null | head -1 || echo 'unknown')"
    exit 0
fi

echo "Downloading ffmpeg for macOS..."

# Create Resources directory if it doesn't exist
mkdir -p "$RESOURCES_DIR"

# Download from evermeet.cx (static build with libmp3lame support)
# Using the latest stable version
DOWNLOAD_URL="https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip"
TEMP_DIR=$(mktemp -d)
TEMP_ZIP="$TEMP_DIR/ffmpeg.zip"

echo "Fetching from evermeet.cx..."
curl -L -o "$TEMP_ZIP" "$DOWNLOAD_URL"

echo "Extracting..."
unzip -o "$TEMP_ZIP" -d "$TEMP_DIR"

# Find the ffmpeg binary (it's extracted directly, not in a subfolder)
EXTRACTED_FFMPEG="$TEMP_DIR/ffmpeg"

if [ ! -f "$EXTRACTED_FFMPEG" ]; then
    echo "Error: ffmpeg binary not found in downloaded archive"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Move to Resources
mv "$EXTRACTED_FFMPEG" "$FFMPEG_PATH"
chmod +x "$FFMPEG_PATH"

# Clean up
rm -rf "$TEMP_DIR"

echo "ffmpeg installed successfully to $FFMPEG_PATH"
echo "Version: $("$FFMPEG_PATH" -version | head -1)"

# Verify it has libmp3lame support
if "$FFMPEG_PATH" -encoders 2>/dev/null | grep -q libmp3lame; then
    echo "libmp3lame encoder: available"
else
    echo "Warning: libmp3lame encoder not found - MP3 encoding may not work"
fi
