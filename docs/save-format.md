# progress.sav format (GameData container)

Worked out from six real saves (Hookshot v2.0.14, GameDataList revision 110).
Parser: `src/gamedata/parser.ts`. Every statement below is checked by the parser's
layout check: each value must end exactly where the next begins, up to end of file.
All 14 local save files (6 × progress.sav, 6 × caption.sav, option.sav, account.sav)
decode with zero warnings.

## Header

| Offset | Type | Value | Meaning |
|---|---|---|---|
| 0x00 | u32 | 0x01020304 | magic |
| 0x04 | u32 | 0x002D80EB | format version |
| 0x08 | u32 | 0x000175D8 | end of record table = start of data area. Matches `MetaData.SaveDataOffsetPos[0]` (95704) in the game's GameDataList |
| 0x0C–0x27 | — | 0 | unused |

## Record table (0x28 → data start)

8-byte records: `u32 hash, u32 value`, little-endian.

- Records are **grouped by type**. A record with hash `0` starts a section, and its
  value is the **type id** of the records that follow. The first section (Bool, id 0)
  has no separator. Empty sections appear as runs of separators.
- Hashes are **Murmur3 x86_32, seed 0** of the key name. Confirmed: enum values in the
  GameDataList are hashes of their names (`murmur3("AttackByWeapon") = 0xB58C29C3`).

| id | type | stored as |
|---|---|---|
| 0 | Bool | inline (0/1) |
| 1 | BoolArray | offset → `u32 bitCount`, bits packed in u32 words |
| 2 | Int | inline s32 |
| 3 | IntArray | offset → `u32 count`, count × s32 |
| 4 | Float | inline f32 |
| 5 | FloatArray | offset → count + f32s |
| 6 | Enum | inline u32 = murmur3(value name) |
| 7 | EnumArray | offset → count + u32 hashes |
| 8 / 9 | Vector2 / Array | (none in these saves) |
| 10 | Vector3 | offset → 3 × f32 |
| 11 | Vector3Array | (none) |
| 12 / 13 | String16 / Array | (none) |
| 14 | String32 | offset → 32 bytes, NUL-padded |
| 15 | String32Array | (none) |
| 16 | String64 | offset → 64 bytes |
| 17 | String64Array | offset → count + 64-byte strings |
| 18 | Binary | offset → `u32 size` + bytes |
| 19 | BinaryArray | offset → count, then per element `u32 size` + bytes (only empty elements seen) |
| 20 | UInt | inline u32 |
| 21 | UIntArray | offset → count + u32s |
| 22 | Int64 | offset → s64 |
| 23 | Int64Array | (none) |
| 24 | UInt64 | offset → u64 |
| 25 | UInt64Array | offset → count + u64s |
| 26–31 | WString16/32/64 (+Array) | UTF-16LE, 32/64/128 bytes per string |
| 32 | Bool64bitKey | single record; offset → sorted list of u64 keys to end of file. **Only keys that are set are stored.** Offset 0 = none. A trailing 0 key is padding. |

## Counts (identical in all six progress.sav files)

11,925 keys: 10,212 Bool, 1,144 Int, 155 IntArray, 101 Enum, 87 UInt, 76 Float, …
These match the GameDataList entries with `SaveFileIndex = 0` exactly.
104–109 Bool64bitKey flags are set, depending on the slot.

## caption.sav

Same container, 46 keys, data at 0x2A0. Contains a JPEG thumbnail (Binary, `FF D8 …`)
and area strings such as `"Market"` / `"Market/Market_Adult"` (String64), usable as the
slot's location label.

## Uncertain

- The one String32 key starts with a NUL byte followed by text (`\0okiriForest_Adult`).
  It's decoded as-is and shown with a leading `\0`. Its meaning is unknown.
- BinaryArray elements: only empty ones seen, so the per-element layout is a guess
  (but consistent with the layout check).
- The 64-bit keys (Bool64bitKey) can't be named yet. In TotK these are per-object
  flags (hash of map/object ids). They change when collecting things (for example
  `0x3F93661D8E17C1D0` was set together with getting Prelude of Light), so they'll be
  mapped by diffing.

## Names

`npm run sav -- names <romfs>` decompresses the RomFS (zstd with the game's own
dictionaries from `Pack/ZsDic.pack.zs`), harvests identifier strings from logic, event
and parameter files and the ExeFS, and keeps the ones whose Murmur3 hash is a save key.
Compound names (`IsGet.<actor>`, `PouchData.<actor>.StockNum`, `<Dungeon>.SmallKeyNum`)
are built from parts already found. The result goes to `local/names.json` (gitignored).
All 1,817 names that also appear in the OOT-SW2SE schema agree with it.
