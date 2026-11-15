# Live tracking: reading progress from the running game

The tracker can read progress straight from a running Hookshot instead of waiting for an
autosave. It is **read-only**: the process is opened with `PROCESS_VM_READ` and
`PROCESS_QUERY_LIMITED_INFORMATION` only, and nothing is ever written to the game or the
save folder. Whenever live data isn't available or doesn't match, the tracker uses the
save files as before.

Code: `src/gamedata/live.ts` (layout, locating, reading; tested in `test/live.test.ts`),
`src/main/procmem.ts` (Windows access through koffi), `src/main/live.ts` (attach, poll,
fall back).

## Memory layout (Hookshot v2.1.0)

Hookshot maps the game's memory at host address `0x1000_0000_0000 + guest address`. The
game heap is at guest `0x10_0000_0000` (about 7 GB).

The game keeps the same GameData store that saves are written from:

| Type | Record stride | Value | Notes |
|---|---|---|---|
| Bool | `0x18` | u8 at `+0x16` | a copy at `+0x17` |
| Int | `0x28` | i32 at `+0x1C` | a copy at `+0x20` |
| Enum | `0x38` | u32 at `+0x1C` | hash of the value name, as in saves |
| String64 | `0x108` | text at `+0x74` | three 64-byte buffers, each after a pointer + capacity; the second is current |
| 64-bit keys | `0x10` | u8 at `+0x0C` | `{u64 key, …}` sorted by key; class byte at `+0x08` |

The current stage (e.g. `LostWood_Child`) is String64 key `0x1D6189DA`, also stored in
`progress.sav`. Live, it changes as soon as you pass a loading zone; the tracker uses it
for "You are here" and the overlay's area mode. String64 is optional: if it isn't found,
the area comes from the save as before.

Some places are part of a bigger stage: Lake Hylia and Lon Lon Ranch are inside
`HyruleField_Child`. String64Array key `0xC458F1EB` (also in `progress.sav`) lists where you
are, e.g. `["HyruleField", "LakeHylia", "", ""]`; the second entry is the place inside the
stage and is empty in the open field. Records of that type are `0x90` apart; `+0x80` is the
element count and `+0x88` a guest pointer (add `0x1000_0000_0000`) to the elements, each
`0x50` bytes with the text at `+0x0C`. A second copy (`+0x70`/`+0x78`) changes at the same
moment. It updates as soon as you cross into the place. The tracker shows that place
(e.g. "Lon Lon Ranch (child)") and narrows "which one was it?" to it plus the surrounding
stage. (`UI_CurrentMapType` only says "Field" or a dungeon, and `UI_FieldMapPlayerAreaNo`
stays 0 outside the map menu, so neither helps.)

- Every record of a type starts with the same 8-byte pointer (the type's vtable).
- Directly before each record array is a hash map of `{u32 key hash, u32 record index}`.
- 64-bit key class `0x18` is permanent (Skulltulas, heart pieces). `0x58` entries are
  cleared again by the game later (respawning objects), with a counter in the last byte.

Checked against a save: 10,205 of 10,212 Bools, 1,138 of 1,144 Ints, 101 of 101 Enums
and every permanent 64-bit key agreed; the rest had changed since the save was written.

## Locating the tables

Addresses aren't hard-coded beyond a starting hint. `locate()` reads a window of memory,
finds runs of evenly spaced records sharing a pointer, reads the map before each run, and
keeps the run whose values agree best with the latest save. The 64-bit table is the
ascending-key run holding the save's set keys. The address found is remembered in
settings (`live.hint`) for next time; if neither hint works, the heap is swept one window
per tick.

## When live data is used

- Only when following **Most recent** (a pinned slot shows that save).
- Only while it matches the latest save: at least 90% of the save's true flags are still
  true and at most 3 permanent 64-bit keys are missing. At the title screen or in another
  file this fails and the saves are used.
- A refresh happens only when a Bool, Enum, 64-bit key or an Int the mapping or logic
  reads has changed (play time and similar counters are ignored).

## If a Hookshot or game update breaks it

The tracker falls back to saves and shows "○ Saves". To re-derive the layout: take a
memory copy, do one thing in game that sets a known flag (for example collect a heart
piece), take another copy and diff them (the probe scripts used for this live in the
gitignored `local/probe/`).
