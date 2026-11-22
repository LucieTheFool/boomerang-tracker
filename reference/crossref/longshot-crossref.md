# Longshot cross-reference

Cross-reference of the [Longshot](https://git.magicbean.dev/MagicBeanDev/Longshot) repository (at
`9af4808f`, 2026-11-18) against this repository's data, 2026-11-17. Longshot is the native Windows/Linux
recompilation of the OoT Switch 2 remake (the Hookshot continuation) — same house as Clawshot and ootrr.
**GPL-3.0-or-later**: facts extracted and re-verified below; nothing was copied.
2026-11-21: the `mod-api` branch (draft PR #1958) is cross-referenced separately in
[longshot-modapi-crossref.md](longshot-modapi-crossref.md) — small-key field names from the game's own
code, write semantics, and the Mod API surface.

## Confirmed, not just inferred

- **Hash algorithm proven from the game's own code.** `host/oot_state_tap.c` implements MurmurHash3 x86_32,
  seed 0, in-tree, and uses it to look up the game's flags. Nine of its inline hashes recompute exactly with
  our murmur3 (incl. `PlayerStatus.Life` `0x31ab5580`, `PlayerStatus.MaxLife` `0xfbe01da1`,
  `PlayerStatus.CurrentRupee` `0xa77921d7`, `Sequence_CurrentBanc` `0x1d6189da`). Our whole data model
  (flag name → u32 hash) is the game's actual naming scheme, independently confirmed by the game source.
- **Our parser handles the game's real save.** Longshot ships a pristine reference save
  (`assets/saves/kokiri-start/slot_00/progress.sav`); our `src/gamedata/parser.ts` parses **11,925 entries**
  from it with no special-casing.
- **Game build.** In-repo: title `0400486024DEC000`, update v131072 (build `e0f3ccfa`) — the same target our
  live probes read.

## Caption.sav layout (new detail for the metadata path)

**Verified against the reference save 2026-11-18:** caption.sav is a standard GameData container — same
magic/header/sentinel as progress.sav — so `src/gamedata/parser.ts` parses it directly (46 entries in the
reference save, 0 Bool64 keys). The raw offsets below are just entry file positions, not a stable layout;
key-based parsing is the right approach.

Reference save (fresh Kokiri start, autosave) contains 20 of the 21 named `CaptionData.*` keys from ootrr's
`flags.json` (missing only `SelectedSavePathIndex` `0x2834256b`): Date.Year/Month/Day/Hour/Minute/Second
`0x9811a3f7/0xdfd840d3/0xbd46f485/0x23f3d75e/0x27853bf7/0x5ee50bed` (fresh = 2026-01-01 00:00:00),
Life `0x1e55ecc5` / MaxLife `0x74bd05d0` (quarter hearts — 12 = 3 hearts, matches our caption Hearts),
MP/MPMax `0x19f26b6a`/`0x943f8ec3`, CurrentRupee `0xa9557547`, GoldToken `0xdc941483`, Pos `0x8b26618e`
(Vector3), Dir `0xaccbda17` (Float, −71.43), LocationName `0xf74e0e8e` / BancScenePath `0x0cccc6cd`
(String64: "KokiriForest" / "KokiriForest/KokiriForest_Child"), TextureNameMain `0x47c0901e` (String64Array),
SerialNumber `0x51c58419` (UInt), IsAutoSave `0x25f03caa` (true — this copy is an autosave) / IsClear
`0xc72044fc` / IsDefenseUP `0xe8bd6759` / IsEnableUseAmiibo `0x7c5b03dc` (Bool), ScreenShot `0x63696a32`
(Binary, the JPEG: u32le length 3345 at entry offset 1392, `FF D8 …` data at 1396; a u32 pointer to that
section sits at raw @540 — what Longshot's save tool calls its "check"). The remaining 24 Bool entries are
the caption's own copies of the learned-state flags — 13 `CaptionData.Item.Item_Melody_*` songs (incl.
ScarecrowSong), 6 `Item_Medal_*`, 3 `Item_Stone_*` — all false in the fresh save; one Bool
(`0x1eda08d5`) is unnamed in ootrr. Entry raw positions (unstable, reference-save only): LocationName @684,
BancScenePath @748, JPEG length @1392, JPEG data @1396. There is **no player-name field** in this game's
saves (verified against a real save). Full layout in `local/longshot-extract.json` → `save_format`.

## Banc (map) names — a cross-check for logic.json

Longshot's 31-entry teleport table (`host/hos_main.c`) lists the game's own banc names for every overworld
region and major dungeon, with child and adult variants: `KokiriForest_Child`/`_Adult`, `Market_Child`,
`KakarikoVillage_Child`/`_Adult`, `ZoraRiver_Child`/`_Adult`, `ZoraDomain_*`, `ZoraFountain_*`,
`Graveyard_Child`/`_Adult`, `DeathMountainTrail_*`, `DeathMountainCrater_*`, `GoronCity_*`,
`GerudoValley_*`, `HountedWasteland_*` (the game spells it **Hounted**), `DesertColossus_*`, `LostWood_*`,
`SacredForestMeadow_*`, plus single-banc dungeons `InsideTheDekuTree`, `DodongoCavern`, `InsideJabuJabuBelly`,
`ForestTemple`, `FireTemple`, `WaterTemple`, `ShadowTemple`, `SpiritTemple`, `BottomOfTheWell`, `IceCavern`,
`GerudoTrainingGround`, `InsideGanonCastle`. Notable: child "Hyrule Castle" is banc `HyruleCastle`, adult is
`GanonCastle`; Lake Hylia is a start position on `HyruleField`, not its own banc. Useful for two things:
(a) the current map is readable live as `Sequence_CurrentBanc` (String64 `0x1d6189da`) — the values are these
names; (b) a spelling cross-check against our `data/logic.json` region names. Full table in
`local/longshot-extract.json` → `destinations_banc_names`.

## Live state flags (a 9-flag snapshot the game itself exposes)

The state tap samples, per present: map (`Sequence_CurrentBanc`), map-loading
(`Sequence_IsLoadingBanc` `0xef2b60c2`), age (`Sequence_IsChildhood` `0xcea220d3`), map rotation
(`Player_Rot_For_Map` `0xa4aee8cd`), life/max life (`0x31ab5580` / `0xfbe01da1`), rupees
(`0xa77921d7`), plus two String64 flags Longshot does not know the names of (A-button prompt `0x9824206c`,
current music `0xcad3ffe5`). Every named flag is in our `save-mapping.json` catalog; the two unnamed ones are
candidates for a name (a `watch --changes` probe would catch their values without offsets).

## Songs confirmed as save Bool flags

The 12 learned songs are save-file Bool flags named `IsGet.Item_Melody_<X>` — Longshot's 12 inline song
hashes match murmur3 of the **full flag name** 12/12 (bare actor names do not hash). Our checklist already
tracks songs via these `IsGet` rows; the Scarecrow Song is *not* one of the 12, consistent with our
`AskBonooru_listentothesong` row.

## Live memory layout (probe reference, build `e0f3ccfa`)

`GameDataMgr` lives at guest global `0x84c9e180` (double-indirect); its six typed containers
(Bool `+0x8`, Int `+0xc8`, Float `+0x188`, Enum `+0x248`, String64 `+0x608`, UInt `+0x788`) each carry
`{count @+8, entries @+16, table @+24, size @+36}` with linear probing from `hash % size` — the in-memory twin
of the container our save parser reads from files. Getters: bool `0x8022d9c0`, string `0x80cd0ea0`. Link's
actor: vtable `0x84b6c460`, resource name `Player`, position at actor+0x31c. All build-specific — kept in
`local/longshot-extract.json` as probe cross-checks; our anchoring pipeline is unaffected.

## What we did NOT take

- Guest addresses (build-specific; probe notes only).
- The two unnamed String64 flag values as facts (names unknown to Longshot itself — flagged as candidates).
- `nx2/` tooling internals (dead-flag optimization, address tables) — tooling, not game data.

## Source map (Longshot, `9af4808f`)

| File | Used for |
|---|---|
| `host/oot_state_tap.c` | in-tree murmur3, 9 state flags, GameDataMgr layout, singleton slots |
| `host/hos_main.c` | 12 song hashes, 31-entry banc table, teleport event mechanism |
| `scripts/longshot_saves.py` | caption.sav layout, no player-name field, mtime note |
| `docs/saves.md` | title ID, update v131072 / build `e0f3ccfa` |
| `assets/saves/kokiri-start/` | reference save validated through our parser (11,925 entries) |

*Verification method: hashes recomputed with the shared murmur3 x86_32 (seed 0) and compared to Longshot's
inline values; the new item/song flag names were also checked against ootrr's `data/flags.json`
([ootrr-crossref.md](ootrr-crossref.md)). No file was copied from Longshot.*
