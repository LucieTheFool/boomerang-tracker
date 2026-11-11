# Boomerang Tracker

A 100% completion tracker for **The Legend of Zelda: Ocarina of Time** (the Nintendo Switch 2
remake) when played through **Hookshot** or a compatible Switch 2 emulator. It reads your save
files, shows what you've collected, and updates on its own a moment after the game autosaves.

- **Read-only.** Saves are only ever read, never written. No game memory is touched.
- **Nothing from the game is included.** No game files, art, keys or saves are part of this
  project. You need your own copy of the game.
- Not affiliated with or endorsed by Nintendo. *The Legend of Zelda* and *Ocarina of Time* are
  trademarks of Nintendo.

## What it shows

- **Summary:** hearts (out of 20), Gold Skulltula tokens with the next House of Skulltula reward
  (or "ready to claim"), and an overall 100% figure.
- **Categories:** Hearts, Gold Skulltulas, Songs, Equipment, Items (with upgrades shown as levels),
  Great Fairies, Dungeons, Bosses, Side Quests, Big Poes, plus optional quest-progress and extras.
- **Can get now:** which 100% entries you can reach with what you have, as child or adult, with
  your current area first. Resizable; also available as an overlay mode.
- **Overlay:** a compact, always-on-top, see-through window for one-screen play
  (`Ctrl+Shift+O` to show/hide, `Ctrl+Shift+L` to lock/unlock; both changeable).
- **"Which one was it?"** For Gold Skulltulas and heart pieces the save doesn't say which checklist
  spot is which, so the tracker asks after you collect one and remembers your answer.
- **Hand ticks** for anything not detected from the save yet.

## Install

Download the portable exe from the Releases page and run it. Nothing is installed and no admin rights
are needed.

Or build it yourself (Node.js 22.15+ or 24):

```
npm install
npm start          # build and run
npm run dev        # run with live reload
npm run dist       # build the portable exe into release\
npm test
```

## First run

The tracker looks for Hookshot saves in the usual places (`%USERPROFILE%\Games\Hookshot`, and
launcher folders named `Apps\*Hookshot*`). If it can't find them it asks you to choose a folder:
the Hookshot folder, its `user\save` folder, or the profile folder that contains `slot_00`,
`slot_01`, …

The game rotates its autosaves across all six slots, so the default **Most recent** setting follows
whichever slot was written last. You can pin a slot instead.

## Settings and data

Everything the app writes goes to `%APPDATA%\Boomerang Tracker\`: `settings.json` (folder, slot,
hand ticks, answers, layout, overlay, hotkeys), `snapshots\` (developer panel), and `error.log`.

## How detection works

Saves use Nintendo's GameData container: hashed keys (Murmur3) with typed values. The format is
documented in [docs/save-format.md](docs/save-format.md); how each checklist entry is detected,
with a confidence level and evidence, is in [docs/save-mapping.md](docs/save-mapping.md) and
`data/save-mapping.json`. Gold Skulltulas and world heart pieces are matched through the 64-bit
flags the game stores for placed objects.

The data files are meant to be edited:

| File | What |
|---|---|
| `data/checklist.json` | What to track: names, numbers and areas |
| `data/save-mapping.json` | How each entry is read from the save |
| `data/logic.json` | Requirements and area connections for "Can get now" |

Requirements in `data/logic.json` follow the original game where the remake hasn't been checked;
entries marked `unsure` may differ. Corrections are welcome.

### Optional: a more detailed local checklist

The public checklist names Gold Skulltulas and heart pieces by area only. If you have your own
notes in the format of `scripts/build-checklist.ts`, put them in `docs/checklist-source.txt` and run
`npm run build-checklist`. That writes `data/checklist.local.json` (ignored by git), which the app
uses instead when it exists. Both use the same ids.

### Developer tools

Tick **Developer** in the app for a Snapshot button and the list of keys that changed in the latest
save. On the command line:

```
npm run sav -- dump <file.sav> [--nondefault --grep text --json]
npm run sav -- diff <a.sav> <b.sav>
npm run sav -- snap <label>                  # copy the newest save and diff it with the previous snapshot
npm run sav -- probe <file.sav> "Name_{A,B}" # test guessed key names
npm run sav -- names <romfs folder>          # readable key names from your own game files (stays local)
npx tsx scripts/mapping-report.ts [--all]
```

## Credits

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Icons are original line drawings made for
this project.

## License

MIT, see [LICENSE](LICENSE).
