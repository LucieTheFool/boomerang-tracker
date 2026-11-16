# Live tracking: reading progress from the running game

The tracker can read progress straight from a running Hookshot, Longshot, NX2navi, ReLink or Fritchii instead of waiting for an
autosave. It is **read-only**: the process is opened with `PROCESS_VM_READ` and
`PROCESS_QUERY_LIMITED_INFORMATION` only, and nothing is ever written to the game or the
save folder. Whenever live data isn't available or doesn't match, the tracker uses the
save files as before.

Code: `src/gamedata/live.ts` (layout, locating, reading; tested in `test/live.test.ts`),
`src/main/procmem.ts` (Windows access through koffi), `src/main/live.ts` (attach, poll,
fall back).

## Memory layout (Hookshot v2.1.0, Longshot v1.0.0, NX2navi 0.12.0, ReLink v0.7.7)

Longshot (a fork of Hookshot v2.0.5) runs the game as `hookshot.exe` too and keeps the same
layout: same record strides, value offsets and even the same distances between the tables.
NX2navi is a separate recompilation whose game build runs as `Triforce.exe`. As checked on
Triforce v0.4.0, it maps memory the same way and keeps the same tables in the same layout, and
its saves use the same format and record keys. Only the start address differs (Bool records at
host `0x1010_99F4_F418` in Hookshot v2.1.0, `0x1010_7EEA_F418` in Longshot v1.0.0,
`0x1010_8BDA_F418` in Triforce v0.4.0). All three are built-in starting points; the tracker
remembers the last four addresses it found and sweeps the heap if none fit.
Project ReLink (another recompilation; the game runs as `bin\relink-game.exe`) was checked on
v0.7.7: same mapping and layout, with the tables at the same address as Triforce v0.4.0.

Hookshot (like NX2navi and ReLink) maps the game's memory at host address `0x1000_0000_0000 + guest address`. The
game heap is at guest `0x10_0000_0000` (about 7 GB).

### Emulators (Fritchii v5.8.4)

Fritchii is a Switch emulator (a fork of Lichii) and runs as `lichii.exe`. The game inside it
keeps exactly the same tables, but the emulator puts the game's memory somewhere new on every
run, in two kinds of mapped (`MEM_MAPPED`) blocks: the console's physical memory (one big block,
about 7 GB, where the mapping from game addresses changes from one chunk to the next) and the
emulator's linear view of the game's address space (many smaller views at one fixed offset).
So for `lichii.exe` the tracker lists the process's readable blocks with `VirtualQueryEx`
(which works with the same `PROCESS_QUERY_LIMITED_INFORMATION` right) and sweeps the mapped ones,
biggest first. In testing the tables turned up in the physical-memory block after about 30 seconds.

Guest pointers can't be turned into host addresses with a fixed offset there. The only one the
tracker follows is the location list's element pointer, and each element starts with a pointer
to its own text, so the offset is worked out from the elements themselves (searched for near the
list record) and every read checks those self-pointers again: if the list moves out of reach,
the area inside the stage reads as unknown rather than as garbage. The recomps keep the fixed
offset; it's checked the same way when the self-pointers are there (not yet confirmed on a recomp
build), and read as before when they aren't.

Saves are in the emulator's data folder: `%APPDATA%\fritchii\nand\user\save\0000000000000000\
<account>\0400486024DEC000\slot_*` (Ocarina of Time's title id), in the same format as Hookshot's.

The game keeps the same GameData store that saves are written from:

| Type | Record stride | Value | Notes |
|---|---|---|---|
| Bool | `0x18` | u8 at `+0x16` | a copy at `+0x17` |
| Int | `0x28` | i32 at `+0x1C` | a copy at `+0x20` |
| Enum | `0x38` | u32 at `+0x1C` | hash of the value name, as in saves |
| Int64 | `0x30` | i64 at `+0x20` | a copy at `+0x28`; only the day/night counter is used |
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

## Day or night

The Int64 record `0xD457EE3A` counts every switch between day and night, whether the clock
gets there or Sun's Song does: even is day, odd is night (checked against Sun's Song in Hookshot
v2.1.0, a day there lasting about 12 minutes: 7 of day, 5 of night). The overlay shows it next
to the area. The exact time of day isn't in the GameData store (the save records only some
values about it, written at saves and songs), so the tracker doesn't show a clock yet.

## If a Hookshot, Longshot, NX2navi, ReLink, Fritchii or game update breaks it

The tracker falls back to saves and shows "○ Saves". To re-derive the layout: take a
memory copy, do one thing in game that sets a known flag (for example collect a heart
piece), take another copy and diff them (the probe scripts used for this live in the
gitignored `local/probe/`).
