# Reference

Documentation for everything this project has mapped about the game's data, plus
checks against other projects that work on the same game. If you're building your
own tools, mods, or a randomizer for the OoT Switch 2 remake (Hookshot / Longshot /
Triforce / NX2navi ports), the general game data lives in the standalone
reference repo:

**[LucieTheFool/oot-switch2-reference](https://github.com/LucieTheFool/oot-switch2-reference)**
— save file format, key hashes, the full key table (by category), 64-bit flags,
enums, areas and stages, live process memory. Start with its README.

What stays here is what's specific to this tracker.

## Start here

| I want to know… | Read |
|---|---|
| Save format, the 404 identified keys, 64-bit flags, enums, areas, live memory | [oot-switch2-reference](https://github.com/LucieTheFool/oot-switch2-reference) (new repo, start with its README) |
| The exact writes that give each item/equipment/song | [grants.md](grants.md) (prose) or [grants.json](grants.json) (the same facts, machine-readable) |
| Per-location checklist requirements and the keys a real pickup sets | [checklist-entries.md](checklist-entries.md) (prose) or [checklist-recipes.json](checklist-recipes.json) (the same facts, machine-readable) |
| What other projects (trackers, randomizers, mod tools) say about the same data, and whether it matches | [crossref/](crossref/README.md) |

## grants.md / checklist-entries.md

Generated — do not edit by hand (regenerated after data changes, together with the
reference repo files).

- [Grant recipes](grants.md) — Ammo, Capacities, Consumables, Equipment, Health,
  Items, Magic, Masks, Quest, Rupees, Songs, Tokens: the write that sets each one
- [Checklist entries (per location)](checklist-entries.md) — heart pieces,
  skulltulas, songs, equipment, items, keys, masks, bottles, fairies, upgrades,
  trades, dungeon clears, boss defeats and the rest

## crossref/

External data checks, each pinned to a source repo + commit with license noted.
[crossref/README.md](crossref/README.md) indexes them and explains the process:

- [Longshot](crossref/longshot-crossref.md) — the native recompilation (same house as this port family)
- [Longshot Mod API](crossref/longshot-modapi-crossref.md) — the modding API draft PR, cross-checked against our tables
- [OOTRR](crossref/ootrr-crossref.md) — Rust randomizer, 15,348-name save-key catalog
- [zootr-nx](crossref/zootr-nx-crossref.md) — randomizer for the same remake
- [hyrule-tracker](crossref/hyrule-crossref.md) — tracker for the original N64 Hyrule version
- [Links-Toolbox](crossref/links-toolbox-crossref.md) — mod loader + save editor for the same game install

## Keeping this section current

- grants.* / checklist-*: the maintainer regenerates them after any data change,
  together with the reference repo files.
- Cross-references: re-run the comparison when an upstream project moves past the
  pinned commit; record the new commit in the document.
