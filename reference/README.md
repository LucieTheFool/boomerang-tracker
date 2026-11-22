# Reference

Documentation for everything this project has mapped about the game's data, plus
checks against other projects that work on the same game. If you're building your
own tools, mods, or a randomizer for the OoT Switch 2 remake (Hookshot / Longshot /
Triforce / NX2navi ports), this is where the evidence lives.

## Start here

| I want to know… | Read |
|---|---|
| What is in the save files — key hashes, flag table, items, music, options, grant recipes, live process reading | [GAME-DATA.md](GAME-DATA.md) (prose) or [oot-switch2-gamedata.json](oot-switch2-gamedata.json) (the same facts, machine-readable) |
| How the game's area names (adult/child, sub-locations) map to the tracker's checklist regions, and which gaps are still open | [area-names.md](area-names.md) |
| What other projects (trackers, randomizers, mod tools) say about the same data, and whether it matches | [crossref/](crossref/README.md) |

## GAME-DATA.md

Generated — do not edit by hand; `npm run reference` regenerates it and the JSON
together (see the generated header in each for the source commit). Sections:

- [Confidence levels](GAME-DATA.md#confidence-levels) — how to read the `confirmed` / `inferred` / `hypothesis` / `untested` markers
- [Reading vs writing](GAME-DATA.md#reading-vs-writing) — what this project reads, and what writing means elsewhere
- [Key hashes](GAME-DATA.md#key-hashes) — how a save key's hash is computed (Murmur3 x86_32)
- [Finding the tables in a save](GAME-DATA.md#finding-the-tables-in-a-save) — per-file layout (`caption.sav`, `progress.sav`, …)
- [Finding the tables in memory](GAME-DATA.md#finding-the-tables-in-memory) — the live read path, per process
- [Grant recipes](GAME-DATA.md#grant-recipes) — the exact writes that give each item/equipment/song
- [Checklist entries (per location)](GAME-DATA.md#checklist-entries-per-location) — per-location requirements and their data sources
- [Keys](GAME-DATA.md#keys) — the full key table (name, hash, type, meaning, confidence)
- [Enum and text values](GAME-DATA.md#enum-and-text-values) — what the integer fields' values mean
- [Areas](GAME-DATA.md#areas) — stage names and the region mapping (see also [area-names.md](area-names.md))
- [How to contribute corrections](GAME-DATA.md#how-to-contribute-corrections)

## area-names.md

Manually maintained. The complete adult/child stage-name vocabulary (46 raw catalog
names → 27 base areas), which sub-locations are known, the era-suffix rules, the
current alias table, and the three stage names that still need aliases. Every row is
tagged observed (live or `caption.sav`) vs expected (catalog-derived).

## crossref/

External data checks, each pinned to a source repo + commit with license noted.
[crossref/README.md](crossref/README.md) indexes them and explains the process:

- [Longshot](crossref/longshot-crossref.md) — the native recompilation (same house as this port family)
- [Longshot Mod API](crossref/longshot-modapi-crossref.md) — the modding API draft PR, cross-checked against our tables
- [OOTRR](crossref/ootrr-crossref.md) — Rust randomizer, 15,348-name save-key catalog
- [zootr-nx](crossref/zootr-crossref.md) — randomizer for the same remake
- [hyrule-tracker](crossref/hyrule-crossref.md) — tracker for the original N64 Hyrule version
- [Links-Toolbox](crossref/links-toolbox-crossref.md) — mod loader + save editor for the same game install

## Keeping this section current

- GAME-DATA.md and the JSON: regenerate after any data change (`npm run reference`);
  the header records the generation date and source commit.
- area-names.md: update by hand when a new stage/sub-location is observed or a new
  alias lands in `src/core/areas.ts`.
- Cross-references: re-run the comparison when an upstream project moves past the
  pinned commit; record the new commit in the document.
