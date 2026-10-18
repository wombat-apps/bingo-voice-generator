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
An ElevenLabs account the user has saved in the app under a name they chose, reached through its API key. Each one has its own Plan, character quota and set of ElevenLabs voices saved in it (not to be confused with the app's Voices). The account used to generate a number is not part of the audio file's identity: regenerating with another account replaces the existing file.
_Avoid_: API key (for the concept; the key is only the account's credential), profile

**Active Account**:
The single ElevenLabs Account the whole app uses at a given moment: for generating, listing voices and showing the subscription. It stays the same across restarts until the user switches it. There may be no Active Account (none saved, or the active one was deleted), and then nothing can be generated until the user picks one.
_Avoid_: Current key, selected key

**Voice**:
A voice the user has added to the app for one language, under a name they chose, pointing at an ElevenLabs voice. Voices belong to the app, not to an ElevenLabs Account: every account sees the same Voices and the same audio files. A Voice is either a Default Voice or a Library Voice. Whether the Active Account can generate with it depends on that account's Plan allowing that kind of voice, not on the voice having been saved in the account beforehand.
_Avoid_: Speaker, account voice

**Default Voice**:
A Voice whose ElevenLabs voice is one of the voices ElevenLabs gives every account. Any ElevenLabs Account can generate with it, whatever its Plan.
_Avoid_: Premade voice (ElevenLabs' term for it in the API), stock voice

**Library Voice**:
A Voice whose ElevenLabs voice another ElevenLabs user shares in the Voice Library. An account on the Free Plan cannot generate with it, even if the voice is saved in that account. It can disappear if its owner stops sharing it.
_Avoid_: Shared voice, community voice, professional voice

**Plan**:
The ElevenLabs subscription of an ElevenLabs Account: Free, Starter, Creator, Pro, Scale, Business or Enterprise. It sets the account's character quota, whether it can use Library Voices, which audio formats it can request and how many requests it can make at once.
_Avoid_: Tier, subscription level, free account / paid account

**Original Audio**:
The audio of a number exactly as ElevenLabs returned it, before the silence is trimmed. It is kept only so the Trimmed Audio can be rebuilt by hand without spending characters again; the app neither plays nor uses it. It lives and dies with its Trimmed Audio: regenerating replaces both, deleting removes both. Audio generated before originals were kept has none.
_Avoid_: Raw audio, backup, untrimmed audio, master

**Trimmed Audio**:
The audio of a number after its trailing silence is removed: the one the app plays and the user takes to their bingo. When trimming fails, it is a copy of the Original Audio.
_Avoid_: Final audio, processed audio
