# Boomerang Tracker

A 100% completion tracker for **The Legend of Zelda: Ocarina of Time** (the Nintendo Switch 2
remake) when played through **Hookshot**, its fork **Longshot**, **[NX2navi](https://github.com/tangerineturtle1/NX2navi)**
(its game build is called Triforce), **[Project ReLink](https://github.com/pixl27/ProjectReLink)**, the
**[Fritchii](https://github.com/Frizti/Fritchii)** emulator, or another
compatible Switch 2 emulator (saves only). It reads your
progress from the running game (or from your save files), shows what you've collected and what
you can get next, and updates as you play.

- **Read-only.** Saves are only ever read, never written. Live tracking reads the game's memory
  but never writes to it, and can be turned off in Settings.
- **Nothing from the game is included.** No game files, art, keys or saves are part of this
  project. You need your own copy of the game.
- Not affiliated with or endorsed by Nintendo. *The Legend of Zelda* and *Ocarina of Time* are
  trademarks of Nintendo.

## What it shows

- **Summary:** hearts (out of 20), Gold Skulltula tokens with the next House of Skulltula reward
  (or "ready to claim"), and an overall 100% figure.
- **Where to find it:** click any entry for a short description of where it is, and what you
  still need for it if you can't get it yet.
- **Categories:** Hearts, Gold Skulltulas, Songs, Equipment, Items (with upgrades shown as levels),
  Great Fairies, Dungeons, Bosses, Side Quests, Big Poes, plus optional quest-progress and extras.
- **Can get now:** which 100% entries you can reach with what you have, as child or adult, with
  your current area first. Each entry knows what it still needs (an item, a song, being adult,
  night time, an area you can't reach yet). Tiered upgrades (seed bag, bomb bag, quiver, stick
  and nut capacity) are offered one tier at a time, since whichever place you do first gives the
  next tier. A search box and filters (by name, form or area) keep the list short. Resizable; also
  available as an overlay mode.
- **Live tracking:** while Hookshot, Longshot, NX2navi, ReLink or Fritchii is running, progress is read straight from the game
  (read-only) and updates within half a second, not just at autosaves. Your current area is live
  too, including places inside a bigger stage such as Lake Hylia and Lon Lon Ranch. At the title
  screen or in another save file it falls back to the save files on its own; the summary shows
  which source it's using. Details in [docs/live-memory.md](docs/live-memory.md).
- **Overlay:** a compact, always-on-top, see-through window for one-screen play
  (`Ctrl+Shift+O` to show/hide, `Ctrl+Shift+L` to lock/unlock; both changeable). It shows your
  area and the live/saves source, and numbers pulse when they go up. Modes:
  - **Counters:** category totals.
  - **Remaining here:** what's left in your current area. What you can get now comes first;
    the rest is dimmed with a short reason (`adult`, `needs Boomerang`, `can't reach yet`).
  - **Can get now:** the list above.
- **"Which one was it?"** For Gold Skulltulas and heart pieces the save doesn't say which checklist
  spot is which. With live tracking, the tracker usually recognises the spot from where you are
  (with an undo link); otherwise it asks after you collect one and remembers your answer.
- **Change log:** every tracked change, with time, save slot and area, plus your answers and hand
  ticks, kept as monthly files on your PC. Useful for checking what the tracker saw.
- **Hand ticks:** double-click any entry to tick it yourself.

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

The tracker looks for Hookshot, Longshot, NX2navi and ReLink saves in the usual places
(`%USERPROFILE%\Games\Hookshot`, `Longshot`, `Triforce` or `ReLink`, folders with those names under `Games`
on a drive, and launcher folders named `Apps\*Hookshot*` or `Apps\*NX2navi*`), and for Fritchii's
in `%APPDATA%\fritchii` (or a portable `user` folder next to the emulator). If it finds several, it
uses the one you played most recently; you can change it in Settings. If it can't find any it asks
you to choose a folder: the game folder, its `user\save` folder, the emulator's data folder, or the
folder that contains `slot_00`, `slot_01`, … (in an emulator, the one named after the game's title
id, `0400486024DEC000`).

The game rotates its autosaves across all six slots, so the default **Most recent** setting follows
whichever slot was written last. You can pin a slot instead. The slot picker lists each slot with
its area, hearts and save time, so you can tell them apart before choosing.

Hookshot, Longshot, NX2navi, ReLink and Fritchii each keep their own saves. When one of them is running, the tracker
switches to that install's saves on its own (unless you've pinned a slot) and shows a note saying so.

Live tracking starts on its own once the game is running and you're in your save file. The summary
shows **● Live** when progress comes from the game and **○ Saves** when it comes from the save files.
It's used only with **Most recent**, and only while the game's state matches your latest save.
It was worked out on Hookshot v2.1.0 and checked on Longshot v1.0.0, NX2navi 0.12.0 (Triforce
v0.4.0), Project ReLink v0.7.7 and Fritchii v5.8.4. In an emulator the game's memory is somewhere new every run, so finding
it takes longer (about half a minute in testing). If an update changes how the game is laid out in
memory, the tracker keeps working from the save files.

## Settings and data

Everything the app writes goes to `%APPDATA%\Boomerang Tracker\`: `settings.json` (folder, slot,
hand ticks, answers, layout, overlay, hotkeys), `logs\changes-YYYY-MM.jsonl` (the change log: every
tracked change with time and area; can be turned off in Settings), `snapshots\` (developer tools),
and `error.log`.

## How detection works

Saves use Nintendo's GameData container: hashed keys (Murmur3) with typed values. The format is
documented in [docs/save-format.md](docs/save-format.md); how each checklist entry is detected,
with a confidence level and evidence, is in [docs/save-mapping.md](docs/save-mapping.md) and
`data/save-mapping.json`. Gold Skulltulas and world heart pieces are matched through the 64-bit
flags the game stores for placed objects. Live tracking reads the same data from the running
game, where it's kept in the same form.

The data files are meant to be edited:

| File | What |
|---|---|
| `data/checklist.json` | What to track: names, numbers and areas |
| `data/descriptions.json` | Where each entry is, in a sentence or two |
| `data/save-mapping.json` | How each entry is read from the save |
| `data/logic.json` | Requirements and area connections for "Can get now" |

Requirements in `data/logic.json` follow the remake: the original game's requirements with the
remake's changes as documented by [Clawshot](https://github.com/hiKareeem/Clawshot) and the guides it
cites (moved Skulltulas, new heart pieces, the clock starting only once you've met Zelda, changed
dungeon routes). Every Gold Skulltula and heart piece has its own exact check, matched to its
checklist number from published guides. Rules marked `likely` in `data/save-mapping.json` haven't
been seen in play yet; corrections are welcome.

### Optional: a more detailed local checklist

The public checklist names Gold Skulltulas and heart pieces by area only. If you have your own
notes in the format of `scripts/build-checklist.ts`, put them in `docs/checklist-source.txt` and run
`npm run build-checklist`. That writes `data/checklist.local.json` (ignored by git), which the app
uses instead when it exists. Both use the same ids.

### Developer tools

Turn on **Developer tools** under Settings → Advanced for a Snapshot button, the list of keys that
changed in the latest save, and how each entry is detected. On the command line:

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
