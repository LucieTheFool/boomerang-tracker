# Links-Toolbox cross-reference (2026-11-21)

**Source:** [github.com/losava/Links-Toolbox](https://github.com/losava/Links-Toolbox) —
*"Link's Tool Box"* by Cum_Dumpster, **MIT**, commit `b8c635c` (tag `v1.6.1`, 2026-11-21).
A mod loader + save editor for *Ocarina of Time* on the **Longshot / Triforce / NX2navi**
PC ports (Python 3.10+/Tkinter, Windows + Linux). Same game install we use, so its data is
directly comparable.

**Provenance — clean, independent.** No reference to this repo, Clawshot, zootr-nx or
hyrule-tracker anywhere in the source. The four provenance hits in `crossref.json` are all
benign: the item *Boomerang* (plus an unrelated mod that gives adult Link child motions),
the port names *Longshot*/*Triforce*, and the MIT license. Its catalog names come from the
maintainer's own save-diffing plus a `build_names()` scan of the game files (murmur3 x86_32
seed 0 — the same hash we use, so all comparisons below are direct hash lookups).

**Method.** `oot_catalog.py` is a pure data file (items, bag/bottle tables, named u32
constants, display names, caps), so it was parsed with `ast.literal_eval` — no code from
the other project was executed. Every claim below was re-derived from the parse and checked
against `local/names.json` (the 6,688-key table) and against fresh murmur3 computations.
Extract: `local/links-toolbox/crossref.json` + per-check files (gitignored).

## 1. Their item IDs are our key table (strongest result)

Their catalog lists 104 item IDs. **101 of 104 resolve in our game key table** as
`IsGet.<id>` / `PouchData.<id>.StockNum` / `HavePlayedGetEvent.<id>` — i.e. a second,
independent source naming the same save fields we read. This corroborates the whole ID
space (wallets, gauntlets, scales, trade items, fairy blessings, armor, the amiibo pouch…).

The 3 that do **not** resolve — `Pouch_Range_BowAndArrow_Fire/Ice/Light` ("Bow + Fire
Arrow" etc.) — are composites in their UI (current bow + current arrow), **not save
fields**. Nothing to add for them.

## 2. Named fields verified in the key table

| Their field | In table |
|---|---|
| `PlayerStatus.Life` / `MaxLife` / `MP` / `MPMax` | ✅ all four |
| `CaptionData.Life`, `CaptionData.MPMax`, `CaptionData.CurrentRupee` | ✅ |
| `PlayerStatus.CurrentRupee` | ✅ |
| `Sequence_CurrentBanc` (current map name) | ✅ |
| `PlayerStatus.EquipWeapon` / `EquipShield` / `AnotherEraEquipWeapon` / `AnotherEraEquipShield` | ✅ all four |
| `PouchData.Item_<Bag>.StockNum` (×5 bags), `PouchData.BottleA–E.StockNum` | ✅ |
| `PlayerStatus.AssignableItem.BottleInfo.BottleA–E.BottleItem` (bottle contents) | ✅ all five |

`CaptionData.MaxLife` / `CaptionData.MP` are *not* in the progress key table — they belong
to `caption.sav` (see `save-format.md` §caption.sav), so that's expected, not a conflict.

## 3. Their names that are NOT in the key table (treat as `guess` until a diff)

These are the maintainer's own save-diff labels for fields whose keys exist in saves but
whose names were never in the harvested GameDataList:

- **`DungeonInfo.<D>.SmallKeyNum` × 9 dungeons** — a concrete candidate for the small-key
  count field that has been unmapped since 2026-11-18 (see the `notes` in
  `save-mapping.json`). The game's key table has exactly 64 `DungeonInfo.*` entries
  (12 bare + 16 dungeons × {BossRetryNum, IsGetBossKey, IsGetCompass, IsGetMap}) — no
  SmallKeyNum. Needs a small-key pickup diff to confirm.
- `PlayerStatus.RupeeLimit`, `PouchData.SUAx`, the bag "holds"/"bag held" counters ×8,
  the five "bottle in use" fields, `PlayerStatus.Wallet` (current wallet item name),
  `PlayerStatus.IsChild`, `CaptionData.Banc`, `CaptionData.Picture`, the "Progress ID".

**Schema insight (the two layers).** This repo now has evidence for two kinds of save
fields: *named* fields that appear in the GameDataList key table, and *hash-only*
runtime fields whose names are absent from the table. That refines the
lazy-materialization caveat already in `notes`: "absent from the live catalog" can mean
"not touched yet" **or** "genuinely unnamed in the key table". Both readings are open for
every absent name until a diff decides.

## 4. Bottle contents enum — 13 of 14 values re-verified

Their 14 bottle-content values re-hash to the plain name for **13**: Empty, RedPotion,
GreenPotion, BluePotion, HalfMilk, Fairy, Fish, Bug, BlueFire, Poe, BigPoe, and — solved
this session — the "Ruto's Letter" value is **`murmur3("Letter") = 0x0F24E808`** (they
label it by the item, the game names it `Letter`). Unresolved: `Milk` = `0x73356827`
(none of `Milk/MilkBottle/FullMilk/Milk_M/MilkFull` matches — full milk has a different
name).

## 5. New items in the game schema that we don't track (in-game leads)

Real items — `IsGet.`/`PouchData.`/`HavePlayedGetEvent.` keys all exist in the game key
table — but absent from `checklist.json`:

| Their ID | Their display name | Note |
|---|---|---|
| `Armor_Child_Mask_Goron` | Goron Mask | we track the other masks, not this one |
| `Weapon_Sword_BrokenGiant` | Broken Giant's Knife | distinct from the Kokiri/Biggoron swords |
| `Item_ScrubBusinessSeed` | Business Scrub Seed | cap 30 in their table |

Adding these touches `checklist.json` + logic, so they're listed here as leads, not added.
Related-but-covered: fairy-blessing gifts (ours: `great_fairies`), tunics (ours: one
combined entry vs their two IDs `Obj_Armor_Child_Normal`/`Armor_Adult_Normal` — both
verified in the table), wallets/bags/quiver (ours: `capacity.*`), tokens and heart pieces
(ours: `derived`). `Pouch_Amiibo` (amiibo count) exists in the table but is out of
tracker scope.

## 6. Display-name diffs (27) — labels only, no save-level conflicts

All 27 are independent-labeler discrepancies on the *same* fields (IDs agree). Worth
keeping on file: they call `Armor_GlassTruth` **"Lens of Truth"** (we say *Lenses*,
plural); their amiibo masks are "Fairy-Kid Mask"/"Princess Mask" (we say *Young
Link/Young Zelda amiibo mask*); their `Item_FairyBless_MP` is labeled "Gift of Improved
Spin" and `Item_FairyBless_MPDouble` "Gift of Doubled Magic" — both exist in the key
table, and our `items.double_magic` maps to the latter. Trade-item labels follow the
remake's in-game names on our side (Odd Potion, Claim Check, …) vs their
N64-flavored labels (Odd Poultice, Biggoron Receipt, …) — our labels are
in-game-verified, so no change.

## Open items

1. **Small-key diff** — the 9 `DungeonInfo.<D>.SmallKeyNum` candidates (or a diff that
   finds the real field) settle the last unmapped counter.
2. **Three gap items** (Goron Mask, Broken Giant's Knife, Business Scrub Seed) — add to
   checklist + logic after an in-game check that they exist in the remake.
3. **Full `build_names()` run** — their name scan of the game files was started but not
   finished (it died at 94% of the file phase). If the full label table for the
   hash-only fields is wanted, it can be re-run from `local/links-toolbox/`.
