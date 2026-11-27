# Re-deriving the live memory layout after an update

When a Hookshot, Longshot, NX2navi, ReLink, Fritchii or Rekarina update changes where
the game's progress tables live in memory, the tracker falls back to reading saves and
shows **○ Saves** in the top-right badge. This doc walks through re-deriving the layout
so live tracking works again.

## Symptoms

- The badge shows **○ Saves** instead of **● Live** while the game is running and you're
  in a playthrough.
- The dev panel (Ctrl+Shift+I, Console tab) shows one of:
  - `Couldn't find the tables: none of the runs agreed with the save` (the tables are
    there but at a different address than the tracker tried)
  - `Couldn't find the tables after sweeping [address range]` (the full heap sweep
    finished without finding them)

## What you need

- **The emulator/port version** that broke it (e.g. Hookshot v2.2.0, Fritchii v5.9.0).
- **A known save** in that version: a slot where you remember what you've collected
  (or one you just started). The tracker uses this to tell real tables from look-alikes.
- **A way to do one known in-game action** that sets a Bool flag you can identify later
  (collect a heart piece, pick up a Skulltula, open a chest with a unique item).

The tracker ships with built-in starting addresses for Hookshot v2.1.0, Longshot v1.0.0
and NX2navi (Triforce) v0.4.0. When a build moves the tables but keeps the same layout
(record strides, value offsets, vtable range), the tracker's sweep finds them and
remembers the new address in settings (`live.hint`). When the layout itself changes
(different strides, different vtables, a reordered GameDataMgr), the method below
re-derives it.

## The method

The game keeps progress in six typed record arrays (Bool, Int, Enum, String64, Int64,
plus a 64-bit key table), each preceded by a hash map of `{key hash → record index}`.
Every record starts with an 8-byte pointer to the type's vtable (a guest code pointer).
The tracker searches for runs of evenly spaced records sharing a vtable, reads the map
before each run, and keeps the one whose values agree best with the latest save.

**What differs per source:**
- **Native ports** (Hookshot, Longshot, NX2navi, ReLink): map guest memory at a fixed
  offset (`0x1000_0000_0000 + guest address`), vtables are small guest pointers
  (1 to 0x1_0000_0000), and the tables are in a known part of the heap. The tracker
  tries built-in hints first, then sweeps ~7 GB.
- **Fritchii** (lichii.exe): puts the game's memory somewhere new every run, in
  `MEM_MAPPED` blocks. The tracker lists the process's readable blocks with
  `VirtualQueryEx` and sweeps the mapped ones, biggest first (~30 s). Vtables are still
  small guest pointers.
- **Rekarina** (Rekarina.exe): maps guest memory at guest address = host address (guest
  base 0), with the game's code at `0x70_0000_0000`, so vtables are `0x70xxxxxxxx`. The
  tables are somewhere in the committed readable blocks between `0x1_0000_0000` and
  `0x70_0000_0000` (~9.9 GB, about 5,600 blocks). The tracker sweeps them in ~7.5 s and
  remembers where it found the tables.

### Step 1: Collect a before snapshot

Run the tracker's helper script against the running game (read-only: `PROCESS_VM_READ |
PROCESS_QUERY_LIMITED_INFORMATION` only, via `src/main/procmem.ts`):

```bash
npx tsx scripts/live-check.ts [Rekarina.exe] [save folder]
```

Replace `Rekarina.exe` with the game's exe name (`hookshot.exe`, `Triforce.exe`,
`relink-game.exe`, `lichii.exe`). The save folder is optional; the script tries to find
it from the exe path. This script exercises the full sweep (no remembered addresses) and
prints what it found:

```
pid       12345  C:\path\to\Rekarina.exe
save      C:\path\to\slot_00\progress.sav
          2026-11-26 10:30:00, 11925 keys, 0 warnings
heap      5600 committed blocks in [0x100000000, 0x7000000000), 9876 MB
status    live
time      7500 ms, 42 steps (the app takes one step per 0.5 s)
table     Bool        10205 records at 0x123456789, vtable 0x7004c20658, 10205 keys mapped
table     Int          1138 records at 0x12345abcd, vtable 0x7004c20680, 1138 keys mapped
...
matches   true
area      Kokiri Forest (child)
```

If the script can't find the tables, the layout has changed in a way the current
`locate()` logic doesn't recognise. The rest of this doc assumes the script found them
(even if slowly).

### Step 2: One known in-game action

Do one thing in the game that sets a Bool flag you can identify:
- Collect a heart piece (a unique one, e.g. the Deku Theatre heart piece)
- Pick up a Gold Skulltula (note which one)
- Open a chest with a unique item (e.g. the Fairy Bow in the Forest Temple)

Avoid actions that set multiple flags at once (finishing a dungeon, talking to an NPC
who sets a quest flag and gives an item).

### Step 3: Confirm the flag in the save

The game autosaves every few seconds. Wait for the autosave (the game shows a saving
icon), then dump the newest save to see the flag:

```bash
npm run sav -- dump path/to/slot_00/progress.sav --nondefault --grep "HeartPiece"
```

This lists every Bool, Int, Enum, Int64 and String64 key whose value differs from the
default, filtered by the grep pattern. You should see the flag you just set (e.g.
`IsGet_Item_HeartPiece_DekuTheatre`). Note the key name and hash.

### Step 4: Diff two runs of live-check.ts

If you have a before snapshot from step 1, run `scripts/live-check.ts` again after the
in-game action. The tables' addresses should stay the same (unless the game restarted),
but the new flag's value changed from `false` to `true`. The script's output shows
agreement counts; look for the Bool table's agreement dropping by 1 or staying the same
(the flag was already true in the reference save).

Alternatively, use a probe script (examples in the gitignored `local/probe/`) to read
the same memory region before and after the action and diff the two buffers. The probe
method:

1. Attach to the process (read-only: `ProcessMemory` from `src/main/procmem.ts`)
2. Find the Bool table's address (from step 1's output, or by sweeping with `locate()`
   from `src/gamedata/live.ts`)
3. Read the entire table: `buf = mem.read(tableStart, recordCount * 0x18)`
4. Do the in-game action
5. Read the table again: `buf2 = mem.read(tableStart, recordCount * 0x18)`
6. Diff the two buffers: for each record `i`, check if `buf[i*0x18 + 0x16]` (the value
   byte) differs from `buf2[i*0x18 + 0x16]`
7. For changed records, read the index map before the table (see `readIndexMap()` in
   `src/gamedata/live.ts`) to get the key hash, then look it up in
   `data/save-mapping.json` or the full key table to find the name

The diff should show exactly one Bool changed: the flag you set in step 2. If multiple
flags changed, pick a more isolated action.

### Step 5: Confirm with a second flag

Repeat steps 2-4 with a different known action (a different heart piece, a different
Skulltula). The diff should show the second flag changing. This confirms the table
layout: record stride (0x18 for Bool), value offset (+0x16), and vtable.

### Step 6: Record the offsets

The record layouts (strides and value offsets) are in `src/gamedata/live.ts`, the
`LAYOUTS` array:

```typescript
export const LAYOUTS: TypeLayout[] = [
  { type: 'Bool', stride: 0x18, valueOffset: 0x16, minRecords: 2000 },
  { type: 'Int', stride: 0x28, valueOffset: 0x1c, minRecords: 200 },
  { type: 'Enum', stride: 0x38, valueOffset: 0x1c, minRecords: 30 },
  { type: 'String64', stride: 0x108, valueOffset: 0x74, minRecords: 5, optional: true },
  { type: 'Int64', stride: 0x30, valueOffset: 0x20, minRecords: 10, optional: true },
];
```

If the new build keeps the same strides and offsets (Hookshot v2.1.0 → v2.2.0 likely
does), **no source changes are needed**. The tracker's sweep will find the new address
and remember it in settings (`live.hint`).

If the layout changed (different strides, different value offsets, a reordered
GameDataMgr), update `LAYOUTS` in `src/gamedata/live.ts` with the new values. The
vtable range is in `MemLayout` (defined in the same file):

```typescript
export const RECOMP_LAYOUT: MemLayout = { guestBase: GUEST_BASE, vtables: [1n, 0x1_0000_0000n] };
```

For Rekarina:

```typescript
// In src/main/live.ts
const REKARINA: Pick<GameInfo, 'layout' | 'heap'> = {
  layout: { guestBase: 0n, vtables: [0x70_0000_0000n, 0x80_0000_0000n] },
  heap: [0x1_0000_0000n, 0x70_0000_0000n],
};
```

**Document the new version in docs/live-memory.md**: update the version list at the top
("Memory layout (Hookshot v2.1.0, …)") and add a note about what changed. If a new
starting address should be built-in, add it to `DEFAULT_HINTS` in `src/main/live.ts`.

## Testing

### With scripts/live-check.ts

Run the helper script against a running game:

```bash
npx tsx scripts/live-check.ts Rekarina.exe
```

It should report `status live` and `matches true`. The agreement counts should show
>90% of the save's values still match (the tracker uses this to decide whether the live
data is from the same playthrough as the save).

### With the tracker's dev panel

Run the tracker (`npm run dev`), open the dev panel (Ctrl+Shift+I), and check the
Console tab. While the game is running and you're in a playthrough, the badge should
show **● Live** and the dev panel should log:

```
[live] attached to Rekarina.exe (pid 12345)
[live] found tables at 0x123456789 (Bool), 0x12345abcd (Int), ...
[live] area: Kokiri Forest (child)
```

If it still shows `Couldn't find the tables`, the layout is still wrong. If it finds
them but shows **○ Saves**, the agreement check is failing: either the live data is
from a different playthrough (title screen, different file), or the values don't match
the save (the layout is wrong).

### Cross-check with the mapping report

The mapping report (`npx tsx scripts/mapping-report.ts`) shows how many entries in
`data/save-mapping.json` have been verified. After confirming two flags (step 5), those
two entries should have higher confidence (`confirmed` if you verified the exact detect
name, `likely` if you only verified the hash).

## When a layout is completely unknown

If the game's internal structure changed drastically (a new recompilation, a different
engine), the method above might not find the tables at all. In that case:

1. **Check the crossref docs** (`reference/crossref/`) for game-code-confirmed offsets.
   The Longshot crossref (`longshot-crossref.md`, `longshot-modapi-crossref.md`) shows
   the GameDataMgr's internal layout (six typed containers at fixed offsets, record
   strides, 64-bit key table at `+0xc58`). If the new build uses the same game code,
   find one anchor (e.g. the GameDataMgr pointer) and derive the rest by relative offset
   instead of a blind sweep.

2. **Probe the heap for vtables**: vtables are guest code pointers (small for recomps,
   `0x70xxxxxxxx` for Rekarina). Scan the heap for 8-byte values in the vtable range
   that repeat every stride bytes. This is slower than the current sweep but works even
   when the record layout changed.

3. **Use the game's own save-write path** (if you can find it): watch where the game
   writes `progress.sav` and trace back to the in-memory tables. This requires a
   debugger and is out of scope for the read-only tracker.

## Gotchas

- **Fritchii moves the tables every run**: the `live.hint` setting is useless there; the
  tracker sweeps the mapped blocks every time. A planned speed-up would cache the layout per title id, not per run.
- **The location list** (`String64Array` key `0xc458f1eb`) uses guest pointers to its
  elements. The tracker works out the guest base from the elements' self-pointers
  (searched for near the list record) and checks them on every read. If the list moves
  out of reach, the area reads as unknown rather than garbage. See `findLocation()` and
  `locationBase()` in `src/gamedata/live.ts`.
- **Live data is used only while it matches the save**: at least 90% of the save's true
  Bool flags still true, and at most 3 permanent 64-bit keys missing. At the title
  screen or in a different file, this fails and the tracker falls back to saves.
- **Game content stays local**: memory snapshots, probe scripts, and anything taken from
  the game live in the gitignored `local/probe/` directory and are never committed. See
  `.gitignore`.
