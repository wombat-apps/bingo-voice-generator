# Rename to bingo!! studio, keeping the identifiers

The app takes the name of the bingo!! family it produces voices for (bingo!!, bingo!! lite, bingo!! cards, bingo!! print) and becomes **bingo!! studio**: a production tool, not a game. Only the visible name changes: the app's name and window title, the app menu, the updater messages, the README and the glossary. The bundle identifier `com.wombatapps.bingovoicegenerator`, the data folder `~/Library/Application Support/BingoVoiceGenerator`, the Keychain service `BingoVoiceGenerator`, the stable `BingoVoiceGenerator.dmg` and the `wombat-apps/bingo-voice-generator` repository keep the old name. Renaming them would make macOS treat it as a different app: the API keys and the generated audio (which costs ElevenLabs credits to regenerate) would need migrating, "Always Allow" would be asked again, and the stable download URL and the updater endpoint would rely on GitHub's redirects. Users never see these identifiers, even if the app becomes public.

## Consequences

- Installed copies keep their `Bingo Voice Generator.app` file name after updating, because the updater replaces the bundle in place; a fresh install from the DMG is `bingo!! studio.app`.
- GitHub turns `bingo!! studio_X.dmg` into `bingo..studio_X.dmg` in release assets, so `release.yml` applies the same rule to replace the versioned DMG.
