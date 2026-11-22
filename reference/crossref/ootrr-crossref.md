# OOTRR cross-reference (2026-11-17)

External data check. **OOTRR** (https://github.com/REALAZK/ootrr,
**GPL-3.0** since 0.4.1, commit `efc58414bea5c8a0b679ee0fb604894533a6cd7f`,
cloned read-only and kept in a gitignored local dir) is a Rust randomizer for
the same Switch 2 OoT remake, shipping a 15,348-name save-key catalog
(`data/flags.json`), a live-memory reader, and an OoT-Rando-derived logic
tree with remake adaptations.

**License:** facts only — copy key names/counts into our own files with
source attribution, never their files verbatim (GPL-3.0 vs our MIT).
Full write-up incl. live-memory anchors: the live anchors are in `docs/live-memory.md`.

## Hash verification (done same day, reproducible)

All 15,348 unique names recomputed with our murmur3 x86_32 (seed 0):

| set | result |
|---|---|
| 13,342 simple names | **0 mismatches** — pure `murmur3(name, seed=0)`; confirms the hash space our `save-mapping.json` assumes |
| 2,006 instance keys (`Actor@Map_Param`, `…+N`) | their recorded hash is a **128-bit composite** — do NOT derive these from the name with our murmur3 |

Catalog join (our `local/names.json`, 6,688 keys + 985 enums):
**6,655 of their 15,348 names already in our catalog; 8,693 new** — most
struct-recovered with opaque numeric suffixes, so most are not
human-usable without in-game diffing. Extract: `local/ootrr-extract.json`
(gitignored).

## New game content relevant to the checklist

- **Fire / Ice / Light arrows** (actors `Item_Arrow_Fire/Ice/Light`,
  save keys `PouchData.Pouch_Range_BowAndArrow_{Fire,Ice,Light}`
  `0xAF_C2E7F0` / `0xEB_265E6A` / `0x45_23381C` + `.StockNum`,
  `IsGet.⋯` flags; all `adv: true` in their items data; **no Blue Fire
  Arrows in the remake**). Our checklist has no special-arrow entries —
  candidate additions, verify in-game.
- **Dream World time trials** — 100 ×
  `DreamWorld_TimeTrial.<Actor>.HaveRecordedTime` (post-game mode we don't
  track; reference only).
- **Beehives: 7 CONFIRMED collectibles, all Kakariko Village** (64-bit
  object keys) — our checklist/logic has zero beehive mentions.
- **Per-bottle validity** — `PlayerStatus.AssignableItem.BottleInfo.BottleA..D.IsValid`.

## Per-GS location evidence — do NOT import

Their 100 skulltula targets carry 64-bit object keys with grades
**LIKELY 63 / GUESS 34 / CONFIRMED 3** — mostly unverified mapping. Our
in-game diffing remains the source for GS → location (working set:
`local/names.json` + `local/placements.json`). Reference extract:
`local/ootrr-extract.json` (gitignored).

## Candidate logic facts (UNVERIFIED in-game)

From their logic tree, no counterpart in our `logic.json` (which already
models beans/crates/night/no-Sun's-Song): Dampe's appearance schedule +
race POH, Rainbow Bridge build-or-always, beehive breaking, planting bugs
in bean stalks, Door-of-Time and forest-exit mechanics. Confirm in-game
before touching `logic.json`.

## Not taken

- Rando placement catalogs (pots/rocks/shops/…), OoTR `logic_*` difficulty
  settings, vanilla placement files (we have save diffs), their Rust solver
  code.

## Item-level cross-reference (2026-11-18)

Second pass: their `data/items.json` (format 1, 289 rows — OoTR randomizer
item names → remake actors, `adv` = logic progression) matched against our
checklist labels and `save-mapping.json` key names.

Result: **59 exact actor-name matches, 23 bundle-mode rows** (bundles,
bottles, shop stocks we track under a different key), **207 rows with no
name match** — most of those are rando placement mechanics (pots, rocks,
shops) or post-game content, not game collectibles we should track.

Content rows worth noting:

| OOTRR item | remake actor | tracker status |
|---|---|---|
| Fire / Ice / Light Arrows | `Item_Arrow_Fire/Ice/Light` (`adv: true`) | not in checklist — candidate, verify in-game (above) |
| Blue Fire Arrows | — (their data marks it actor-less) | correctly absent from the remake |
| Zora Mask, Gerudo Mask | `Item_Mask_Zora` / `Item_Mask_Gerudo` (`adv: false`, cosmetic) | not tracked. The remake 100% counts only the five Happy-Mask-Shop masks, which our checklist mirrors faithfully; these two are Extras candidates. In-game-verified 2026-11-17 by an in-game grant (user-confirmed the masks in the inventory) |
| Goron Mask | `Item_Mask_Goron` (`adv: false`) | tracked as **Goron's Bracelet** under Items (remake repurposes it as an accessory) |
| Dream World time trials ×100 | `DreamWorld_TimeTrial.*.HaveRecordedTime` | post-game mode, reference only (above) |

Amiibo masks: the two `guess` entries in `save-mapping.json`
(`IsGet.Armor_Child_Mask_Amiibo0/1`) are **confirmed** as of 2026-11-18
(`17cbf7b`) — the in-game grant session of 2026-11-18 (user-verified in
game) shows Amiibo0 = Fairy Kid Mask (Young Link figure), Amiibo1 = Young
Zelda Mask (Young Zelda figure).
