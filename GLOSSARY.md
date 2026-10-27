# bingo!! studio

Generates the audio a bingo caller plays for each number, in several languages, voices and modes, using ElevenLabs text-to-speech.

## Language

**Language**:
The language the numbers are said in (Spanish, English, Portuguese…). It sets the number words and how the Word and the Digit are phrased. The user never picks a Language directly: they pick an Accent, which belongs to one.
_Avoid_: Locale, idioma (for the concept in code)

**Accent**:
The regional way a Language is spoken, such as Peninsular, Rioplatense or neutral Latin American Spanish, or New Zealand English. It is what the user picks to generate in: every Voice and every audio file belongs to one Accent. Two Accents of the same Language say the same text, except for the few numbers an Accent writes differently (European Portuguese "dezasseis", Brazilian "dezesseis"); otherwise only the voice and the scene described to ElevenLabs change. It is the same concept as the Accent of a Bundled Voice in bingo!! and bingo!! lite.
_Avoid_: Variant (taken by Bingo Mode), dialect, locale, language (for an Accent)

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
The single ElevenLabs Account the whole app uses at a given moment: for generating, listing voices and showing the subscription. It stays the same across restarts until the user switches it. There may be no Active Account (none saved, or the active one was deleted while more than one other remained), and then nothing can be generated until the user picks one. Deleting the Active Account when a single other account remains makes that one active, since there is nothing to choose.
_Avoid_: Current key, selected key

**Voice**:
A voice the user has added to the app for one Accent, pointing at an ElevenLabs voice, under a name that starts as that ElevenLabs voice's name and the user can change. An ElevenLabs voice can be added at most once per Accent, but the same one can be a Voice in several Accents. Voices belong to the app, not to an ElevenLabs Account: every account sees the same Voices and the same audio files. A Voice is either a Default Voice or a Library Voice. Whether the Active Account can generate with it depends on that account's Plan allowing that kind of voice, not on the voice having been saved in the account beforehand.
_Avoid_: Speaker, account voice

**Voice Details**:
How ElevenLabs describes a Voice's ElevenLabs voice: its ElevenLabs accent, age, description and use case. They are kept as ElevenLabs gave them when the Voice was added, so they stay visible without a connection or an Active Account, and after a Library Voice stops being shared. The user does not edit them. Popularity signals (featured, how many users added the voice) are not part of them. The ElevenLabs accent is ElevenLabs' free-form label (such as "castilian" or "mexican") and need not match the Voice's Accent.
_Avoid_: Labels, tags, metadata; accent (on its own, for the ElevenLabs accent)

**Default Voice**:
A Voice whose ElevenLabs voice is one of the voices ElevenLabs gives every account. Any ElevenLabs Account can generate with it, whatever its Plan.
_Avoid_: Free voice (it still spends characters; "Free" is a Plan), premade voice (ElevenLabs' term for it in the API), stock voice

**Library Voice**:
A Voice whose ElevenLabs voice another ElevenLabs user shares in the Voice Library. An account on the Free Plan cannot generate with it, even if the voice is saved in that account. It can disappear if its owner stops sharing it.
_Avoid_: Paid voice, shared voice (ElevenLabs' term for it in the API), community voice, professional voice

**Plan**:
The ElevenLabs subscription of an ElevenLabs Account: Free, Starter, Creator, Pro, Scale, Business or Enterprise. It sets the account's character quota, whether it can use Library Voices, which audio formats it can request and how many requests it can make at once.
_Avoid_: Tier, subscription level, free account / paid account

**Bingo Mode**:
The variant of the game: Bingo 90 (numbers 1 to 90) or Bingo 75 (numbers 1 to 75, split into the columns B, I, N, G, O). It sets which numbers exist and whether the Word carries the column letter.
_Avoid_: Mode (on its own), game type

**Word**:
The audio of a number said as a word, the way the caller announces it ("¡Cuarenta y cinco!"). It belongs to one Bingo Mode: in Bingo 75 it carries the column letter ("N ¡cuarenta y cinco!"), in Bingo 90 it does not.
_Avoid_: Number audio, announcement

**Word Format**:
A way of writing the Word, saying where the number and, in Bingo 75, the column letter go, and how they are written, down to upper and lower case ("¡{LETTER} {NUM}!" gives "¡O SETENTA Y CINCO!"). Each one belongs to one Language and one Bingo Mode and serves every number. It has no name: it is told apart by how it is written. Each Language and Bingo Mode always has the Default one, which cannot be changed or deleted, and the user can add more, each written differently. One of them is selected for each Language and Bingo Mode, for all its Voices. Like Voice Settings, it is not part of an audio file's identity: regenerating a Word with another Word Format replaces the existing file.
_Avoid_: Template, variation, pattern, text (for the concept)

**Digit**:
The audio of a number said digit by digit, right after its Word ("cuatro cinco"). It does not depend on the Bingo Mode: the same Digit serves Bingo 90 and Bingo 75, so it is generated once. Numbers below 10 have no Digit; their Word is enough.
_Avoid_: Digits audio, spelled number

**Digit Format**:
A way of writing the Digit, saying where its first and second digit go and how they are written ("{FIRST}… {second}" gives "SIETE… cinco"). Like the Digit, it belongs to one Language and not to a Bingo Mode. Otherwise it works like a Word Format: it has no name, there is always the Default one, the user can add more, and one is selected for each Language, for all its Voices.
_Avoid_: Word Format (for the Digit), template, pattern

**Pending Audio**:
A Word or Digit a Voice still has no audio file for in a Bingo Mode: the Word of each of its numbers, and the Digit of each number from 10 up. An audio file that exists is never pending, whatever Word Format, Digit Format, Voice Settings or ElevenLabs Account it was generated with. Since the Digit serves both Bingo Modes, a Digit generated for one is not pending in the other. The user can generate all the Pending Audio of the selected Voice and Bingo Mode at once, one file after another.
_Avoid_: Missing audio, batch, remaining numbers

**Original Audio**:
The audio of a number as ElevenLabs returned it, before the silence is trimmed, carrying its Generation Details. It is kept only so the Trimmed Audio can be rebuilt by hand without spending characters again; the app neither plays nor uses it. It lives and dies with its Trimmed Audio: regenerating replaces both, deleting removes both. Audio generated before originals were kept has none.
_Avoid_: Raw audio, backup, untrimmed audio, master

**Trimmed Audio**:
The audio of a number after its trailing silence is removed: the one the app plays and the user takes to their bingo. When trimming fails, it is a copy of the Original Audio.
_Avoid_: Final audio, processed audio

**Generation Details**:
How one audio file was generated, kept inside the file itself, in both its Original Audio and its Trimmed Audio: the Word Format or Digit Format of its part as it was written (even the Default one), the exact text sent to ElevenLabs, the Voice Settings, the ElevenLabs voice and when it was generated. They describe that one file, not its Voice, and are replaced with it when it is regenerated. The ElevenLabs Account is not part of them. Audio generated before they were kept has none.
_Avoid_: Metadata, tags, generation info
