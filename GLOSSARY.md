# Bingo Voice Generator

Generates the audio a bingo caller plays for each number, in several languages, voices and modes, using ElevenLabs text-to-speech.

## Language

**TTS Model**:
The ElevenLabs speech-synthesis engine that turns the text into audio (e.g. Eleven v4, Multilingual v2). The app offers a curated set, not every model ElevenLabs publishes.
_Avoid_: Model (on its own), engine

**Voice Settings**:
The parameters applied when generating audio: TTS Model, stability, similarity boost, style, speed and speaker boost. They are not part of an audio file's identity: regenerating a number with different Voice Settings replaces the existing file.
_Avoid_: Generation settings, TTS settings
