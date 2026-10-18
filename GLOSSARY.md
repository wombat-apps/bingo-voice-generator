# Bingo Voice Generator

Generates the audio a bingo caller plays for each number, in several languages, voices and modes, using ElevenLabs text-to-speech.

## Language

**TTS Model**:
The ElevenLabs speech-synthesis engine that turns the text into audio (e.g. Eleven v4, Multilingual v2). The app offers a curated set, not every model ElevenLabs publishes.
_Avoid_: Model (on its own), engine

**Voice Settings**:
The parameters applied when generating audio: TTS Model, stability, similarity boost, style, speed and speaker boost. They are not part of an audio file's identity: regenerating a number with different Voice Settings replaces the existing file.
_Avoid_: Generation settings, TTS settings

**ElevenLabs Account**:
An ElevenLabs account the user has saved in the app under a name they chose, reached through its API key. Each one has its own subscription, character quota and voices. The account used to generate a number is not part of the audio file's identity: regenerating with another account replaces the existing file.
_Avoid_: API key (for the concept; the key is only the account's credential), profile

**Active Account**:
The single ElevenLabs Account the whole app uses at a given moment: for generating, listing voices and showing the subscription. It stays the same across restarts until the user switches it. There may be no Active Account (none saved, or the active one was deleted), and then nothing can be generated until the user picks one.
_Avoid_: Current key, selected key
