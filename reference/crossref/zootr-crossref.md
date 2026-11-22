# zootr-nx cross-reference (2026-11-21)

External data check. **zootr-nx** (https://github.com/TurtIeSocks/zootr-nx,
**MIT**, commit `3ef1a5a`; cloned read-only and kept in a gitignored local
dir) is a randomizer for the same
Switch 2 OoT remake: it reads your own dump, moves items, and writes the
result as a mod. Its `save_editor` crate hardcodes the game's key constants,
and its engine ships a live-memory reader.

**License:** MIT — facts and key names may be carried into our own files with
source attribution (done in this doc and in `local/zootr-extract.json`),
unlike the GPL-3.0 OOTRR cross-reference below.

## Hash schemes (verified, reproducible)

The save has **two key spaces over the same field names**:

| space | key = hash of the UTF-8 field name | verification |
|---|---|---|
| u32 GameData entries | Murmur3 x86_32, seed 0 | 6,688/6,688 `local/names.json` names rehash to their stored keys |
| u64 Bool64bitKey flags | FNV-1a 64-bit (offset `0xcbf29ce484222325`, prime `0x100000001B3`) | 32 shared names verify BOTH ways (our save-mapping name hashes to the same constant zootr uses) + 508 zootr-only constants rehash to their recovered names |

The two outputs are unrelated — the same field name gets a different key in
each space (e.g. `IsGet.Item_DekuStick`: u32 `0xc4e21ac2` vs u64
`0x15f1580810a6d5ee`). The "shared" flags below are therefore **name-level
only, never key-level**.

## u32 constants in zootr source (28)

| outcome | count | detail |
|---|---|---|
| resolved by `local/names.json` table lookup | 13 | all in our 6,688-name game table (MP, rupees, equipment slots, treasure-box flag, shop price, a step key) |
| resolved by brute force, hash-verified | 4 | `PlayerStatus.EquipOcarina`, `PlayerStatus.EquipBoot`, `PlayerStatus.EquipHeadArmor`, `PouchData` — **absent from the game table** (harvest gap or lazy materialization, cf. the WaterTemple.IsGetBossKey note in `save-mapping.json`) |
| unnamed even in the game dump | 4 | `0x008d7f0c` (tunic), `0x1ea93bd8` (Link yaw), `0xe573f564` (play time), `0xf80f8077` (bombchu CAPS) — zootr's own comments say "known only by its hash"; 200+ candidate strings found nothing |
| test fixtures, not live fields | 7 | |

## u64 constants (1,480)

- **32 shared** with `save-mapping.json` (name verified both sides) — small
  keys, heart pieces, minigame clears, HavePlayedEvent, bombchu bowling.
- **508 zootr-only, names recovered and FNV-verified** — item / progress /
  minigame / HavePlayedEvent breadth we don't track.
- **940 zootr-only, label-derived GUESSES** — FNV-1a64(label) does NOT equal
  the stored constant; unverified naming leads, not facts.
- **Overlap with our observed keys: 0/1,480.** Our 122 raw b64 values (heart
  containers, gold skulltulas, boss defeats, rare events) appear nowhere in
  zootr's 1,480 FNV constants, and FNV-1a64 of none of our 227 referenced
  names lands in our observed set. The two projects track **disjoint** u64
  flag sets: zootr covers items/progress we don't track; we hold real keys
  for flags zootr has zero of, with no name→key function known for them yet.

## Extract (gitignored)

- `local/zootr-extract.json` — machine-readable: all 28 u32 constants with
  evidence, 32 shared + 508 verified + 940 guess u64 entries, scheme params.
- `local/zootr-correspondence.txt` — the full correspondence table (human
  form, generated the same session).

## Not taken

- Rando mechanics (placement catalogs, seed generation, solver), write
  mechanics as a design (we stay strictly read-only), and the 940 guesses
  as facts.
- Nothing from the 508 verified names is merged into `save-mapping.json`
  without in-game diffing — our confidence bar (confirmed = seen flipping in
  a diff) is unchanged.

## Candidate leads for in-game verification

- The 4 hash-verified u32 names missing from `local/names.json`
  (equip ocarina/boot/head armor, `PouchData`) — confirm presence in a real
  save, then fold into the name table.
- The 4 hash-only constants — name them via an in-game diff (change tunic,
  move Link, advance time, fill bombchu caps) to close the gap.
- FNV-1a64 is now a known key function for u64 flags: when we meet a new b64
  value, brute-forcing candidate field names against FNV-1a64 is a viable
  recovery path. zootr's 508 verified names are good candidate strings for
  future diff sessions.
