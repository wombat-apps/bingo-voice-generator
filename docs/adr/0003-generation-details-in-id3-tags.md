# Generation Details travel inside each audio file, as an ID3 tag

To regenerate a number the way it was made, each audio file keeps its Generation Details (see `GLOSSARY.md`) in an ID3v2.4 tag: one `TXXX` frame with the description `bingo!! studio` whose value is the details as JSON. They are written in both the Original Audio and the Trimmed Audio, after trimming, since the trimmer re-encodes the MP3 and keeps no tags. We chose the file itself over a sidecar file per Voice (or `voices.json`) because the file is the unit that is generated, replaced, deleted and copied: its details are replaced and deleted with it, with nothing to keep in sync, and they survive copying the file elsewhere. Audio generated before has no tag, and the app shows nothing for it.

## Consequences

- The Original Audio is no longer byte for byte what ElevenLabs returned: the sound is, plus the tag.
- The tag (a few hundred bytes, with the format and the text sent) reaches bingo!! and bingo!! lite when the Trimmed Audio is copied as a Bundled Voice. Players ignore it.
- The Word Format or Digit Format is kept as it was written, even the Default one, which can change between versions; the details do not say whether it was the Default.
- Failing to write the tag never fails a generation that has already spent characters: the file is saved without it.
