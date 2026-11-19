import { describe, it, expect, vi } from 'vitest';
import { locate, readLive, matchesReference, fingerprint, readTables, areaFrom, sweepRanges, findRecordRuns, LAYOUTS, STAGE_KEY, LOCATION_KEY, DAY_NIGHT_KEY, GUEST_BASE, Mem } from '../src/gamedata/live';
import { GAMES, LiveSource, sweepWindows, committedReader } from '../src/main/live';
import type { GameDataFile, Entry } from '../src/gamedata/parser';

// Synthetic memory laid out like the game's: per type a {hash, index} map followed by a
// record array, then a sorted 64-bit-key table. All values made up.
const BASE = 0x1010_0000_0000n;
const nBool = 2400, nInt = 300, nEnum = 40, nB64 = 1200;
const hBool = (i: number) => (0x10000000 + i * 7919) >>> 0;
const hInt = (i: number) => (0x50000000 + i * 104729) >>> 0;
const hEnum = (i: number) => (0x90000000 + i * 1299709) >>> 0;
const key64 = (j: number) => 0x0100_0000_0000_0000n + BigInt(j) * 0x0000_0100_0000_0001n;

/** base: host address of the fake memory; vt: where the made-up vtables are (types at vt + small offsets). */
function build(start = 0x1000, { base = BASE, vt = 0x84c40000n } = {}) {
  const mem = Buffer.alloc(4 << 20);
  let o = start;
  const tables: Record<string, number> = {};
  const put = (type: 'Bool' | 'Int' | 'Enum', n: number, h: (i: number) => number, vt: bigint, val: (i: number) => number) => {
    const L = LAYOUTS.find(l => l.type === type)!;
    for (let i = 0; i < n; i++) { mem.writeUInt32LE(h(i), o); mem.writeUInt32LE(i, o + 4); o += 8; o += 8 * (i % 3); } // map with gaps
    o = (o + 0x40) & ~7;
    tables[type] = o;
    for (let i = 0; i < n; i++) {
      const r = o + i * L.stride;
      mem.writeBigUInt64LE(vt, r);
      if (type === 'Bool') mem[r + L.valueOffset] = val(i);
      else mem.writeUInt32LE(val(i) >>> 0, r + L.valueOffset);
    }
    o += n * L.stride + 0x100;
  };
  put('Bool', nBool, hBool, vt + 0x658n, i => (i % 10 === 0 ? 1 : 0));
  put('Int', nInt, hInt, vt + 0x718n, i => i * 3 - 5);
  put('Enum', nEnum, hEnum, vt + 0x898n, i => hEnum(i) ^ 0xabc);
  tables.b64 = o;
  for (let j = 0; j < nB64; j++) {
    const r = o + j * 16;
    mem.writeBigUInt64LE(key64(j), r);
    mem[r + 8] = j % 50 === 1 ? 0x58 : 0x18;
    mem[r + 12] = j % 20 === 0 || j % 50 === 1 ? 1 : 0;
  }
  const m: Mem = { read: (addr, len) => {
    const off = Number(addr - base);
    if (off < 0 || off + len > mem.length) return null;
    return Buffer.from(mem.subarray(off, off + len));
  } };
  return { mem, m, tables };
}

function reference(): GameDataFile {
  const entries = new Map<number, Entry>();
  const add = (hash: number, type: Entry['type'], value: Entry['value']) => entries.set(hash, { hash, type, value, recordOffset: 0 });
  for (let i = 0; i < nBool; i++) add(hBool(i), 'Bool', i % 10 === 0);
  for (let i = 0; i < nInt; i++) add(hInt(i), 'Int', i * 3 - 5);
  for (let i = 0; i < nEnum; i++) add(hEnum(i), 'Enum', (hEnum(i) ^ 0xabc) >>> 0);
  const bool64 = new Set<bigint>();
  for (let j = 0; j < nB64; j++) if (j % 20 === 0 || j % 50 === 1) bool64.add(key64(j));
  return { version: 0, dataStart: 0, size: 0, entries, bool64, warnings: [] };
}

/**
 * A String64Array map + three 0x90-byte records after the 64-bit table; record 1 is the
 * location list. guestBase: host address of guest 0 (GUEST_BASE in recomps, anything in an
 * emulator). Elements start with a guest pointer to their own text, as in the game.
 */
function addLocationList(mem: Buffer, tables: Record<string, number>, guestBase: bigint, { selfPointers = true, base = BASE, vt = 0x84c40000n } = {}) {
  let o = tables.b64 + nB64 * 16 + 0x200;
  const hashes = [0x12345678, LOCATION_KEY, 0x23456789];
  hashes.forEach((h, i) => { mem.writeUInt32LE(h, o); mem.writeUInt32LE(i, o + 4); o += 8; });
  o = (o + 0x40) & ~7;
  const recs = o, elems = recs + 3 * 0x90 + 0x100;
  hashes.forEach((_, i) => mem.writeBigUInt64LE(vt + 0xcb0n, recs + i * 0x90));
  const rec = recs + 0x90;
  const guest = (off: number) => base + BigInt(off) - guestBase;
  mem.writeUInt32LE(4, rec + 0x80);
  mem.writeBigUInt64LE(guest(elems), rec + 0x88);
  const setList = (names: string[]) => {
    mem.fill(0, elems, elems + 4 * 0x50);
    for (let i = 0; i < 4; i++) {
      if (selfPointers) mem.writeBigUInt64LE(guest(elems + i * 0x50 + 0x0c), elems + i * 0x50);
      mem.writeUInt32LE(0x40, elems + i * 0x50 + 8);
    }
    names.forEach((n, i) => mem.write(n, elems + i * 0x50 + 0x0c, 'latin1'));
  };
  return { rec, elems, guest, setList };
}

describe('live memory tables', () => {
  it('locates every table and reads values that match the save', () => {
    const { m, tables } = build();
    const ref = reference();
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    expect(t).toBeTruthy();
    expect(t.records.map(r => [r.type, Number(r.start - BASE), r.count])).toEqual([
      ['Bool', tables.Bool, nBool], ['Int', tables.Int, nInt], ['Enum', tables.Enum, nEnum],
    ]);
    expect(Number(t.b64.start - BASE)).toBe(tables.b64);
    const live = readLive(m, t, ref)!;
    expect(live.agreement.slice(0, 3).map(a => a.agree === a.checked)).toEqual([true, true, true]);
    expect(matchesReference(live.agreement)).toBe(true);
    expect(live.data.bool64).toEqual(ref.bool64);
  });

  it('picks up changes made in game, and ignores respawning objects for the playthrough check', () => {
    const { mem, m, tables } = build();
    const ref = reference();
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    const before = fingerprint(t, readTables(m, t)!, new Set([hInt(4)]));
    mem[tables.Bool + 7 * 0x18 + 0x16] = 1; // a flag gets set
    mem.writeInt32LE(99, tables.Int + 4 * 0x28 + 0x1c); // a watched counter
    mem[tables.b64 + 3 * 16 + 12] = 1; // an object collected
    mem[tables.b64 + 1 * 16 + 12] = 0; // a respawn flag cleared again
    const live = readLive(m, t, ref)!;
    expect(live.data.entries.get(hBool(7))!.value).toBe(true);
    expect(live.data.entries.get(hInt(4))!.value).toBe(99);
    expect(live.data.bool64.has(key64(3))).toBe(true);
    expect(matchesReference(live.agreement)).toBe(true);
    expect(fingerprint(t, readTables(m, t)!, new Set([hInt(4)]))).not.toBe(before);
  });

  it('ignores unwatched counters when deciding whether anything changed', () => {
    const { mem, m } = build();
    const ref = reference();
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    const before = fingerprint(t, readTables(m, t)!, new Set());
    mem.writeInt32LE(12345, Number(t.records[1].start - BASE) + 9 * 0x28 + 0x1c); // e.g. play time
    expect(fingerprint(t, readTables(m, t)!, new Set())).toBe(before);
  });

  it('does not trust memory from another file or the title screen', () => {
    const { mem, m, tables } = build();
    const ref = reference();
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    for (let i = 0; i < nBool; i++) mem[tables.Bool + i * 0x18 + 0x16] = 0;
    for (let j = 0; j < nB64; j++) mem[tables.b64 + j * 16 + 12] = 0;
    expect(matchesReference(readLive(m, t, ref)!.agreement)).toBe(false);
  });

  it('reads the current stage from the text table when there is one', () => {
    const { mem, m, tables } = build();
    const ref = reference();
    // Add a String64 map + records after the 64-bit table.
    let o = tables.b64 + nB64 * 16 + 0x200;
    const hashes = [STAGE_KEY, 0x11111111, 0x22222222, 0x33333333, 0x44444444, 0x55555555];
    hashes.forEach((h, i) => { mem.writeUInt32LE(h, o); mem.writeUInt32LE(i, o + 4); o += 16; });
    o = (o + 0x40) & ~7;
    hashes.forEach((h, i) => {
      const r = o + i * 0x108;
      mem.writeBigUInt64LE(0x84c40c58n, r);
      mem.write(h === STAGE_KEY ? 'LostWood_Child' : `Text_${i}`, r + 0x74, 'latin1');
      ref.entries.set(h, { hash: h, type: 'String64', value: h === STAGE_KEY ? 'KokiriForest_Child' : `Text_${i}`, recordOffset: 0 });
    });
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    expect(t.records.map(r => r.type)).toContain('String64');
    expect(readLive(m, t, ref)!.data.entries.get(STAGE_KEY)!.value).toBe('LostWood_Child');
  });

  it('reads where you are inside a stage from the location list, and notices it change', () => {
    const { mem, m, tables } = build();
    const ref = reference();
    const { rec, setList } = addLocationList(mem, tables, GUEST_BASE);
    setList(['HyruleField', 'LakeHylia']);
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    expect(Number(t.location!.record - BASE)).toBe(rec);
    expect(t.location).toMatchObject({ base: GUEST_BASE, checked: true });
    const first = readTables(m, t)!;
    expect(readLive(m, t, ref)!.data.entries.get(LOCATION_KEY)!.value).toEqual(['HyruleField', 'LakeHylia', '', '']);
    setList(['HyruleField', 'LonLonRanch']);
    expect(fingerprint(t, readTables(m, t)!, new Set())).not.toBe(fingerprint(t, first, new Set()));
    expect(readLive(m, t, ref)!.data.entries.get(LOCATION_KEY)!.value).toEqual(['HyruleField', 'LonLonRanch', '', '']);
  });

  it('in an emulator, works out where guest memory is from the list elements', () => {
    const { mem, m, tables } = build();
    const ref = reference();
    const EMU = 0x0ff0_0000_0000n; // guest 0 at some host address of the emulator's choosing
    const { setList } = addLocationList(mem, tables, EMU);
    setList(['HyruleField', 'LakeHylia']);
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    expect(t.location).toMatchObject({ base: EMU, checked: true });
    expect(readLive(m, t, ref)!.data.entries.get(LOCATION_KEY)!.value).toEqual(['HyruleField', 'LakeHylia', '', '']);
  });

  it('reads a list that moved out of reach as unknown, not as garbage', () => {
    const { mem, m, tables } = build();
    const ref = reference();
    const EMU = 0x0ff0_0000_0000n;
    const { rec, guest, setList } = addLocationList(mem, tables, EMU);
    setList(['HyruleField', 'LakeHylia']);
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    mem.writeBigUInt64LE(guest(0x2000), rec + 0x88); // now points at the Bool map, not at elements
    expect(readTables(m, t)!.at(-1)!.length).toBe(0);
  });

  it('still reads a recomp list whose elements lack the self-pointers', () => {
    const { mem, m, tables } = build();
    const ref = reference();
    const { setList } = addLocationList(mem, tables, GUEST_BASE, { selfPointers: false });
    setList(['HyruleField', 'LakeHylia']);
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    expect(t.location).toMatchObject({ base: GUEST_BASE, checked: false });
    expect(readLive(m, t, ref)!.data.entries.get(LOCATION_KEY)!.value).toEqual(['HyruleField', 'LakeHylia', '', '']);
  });

  it("orders an emulator's memory for the sweep: mapped views only, merged, biggest first", () => {
    const MB = 1n << 20n;
    const r = (base: bigint, size: bigint, type = 0x40000) => ({ base, size, type });
    expect(sweepRanges([
      r(0x1000n * MB, 100n * MB), r(0x1000n * MB + 100n * MB, 50n * MB), // touching: one block of 150 MB
      r(0x3000n * MB, 400n * MB),
      r(0x5000n * MB, 900n * MB, 0x20000), // private memory: skipped
      r(0x6000n * MB, 2n * MB), // too small to hold the tables
    ])).toEqual([[0x3000n * MB, 0x3000n * MB + 400n * MB], [0x1000n * MB, 0x1000n * MB + 150n * MB]]);
  });

  it('on a new file with nothing collected yet, picks the full 64-bit table, not a shorter look-alike', () => {
    // A shorter ascending run of 64-bit values elsewhere in memory, before the real tables.
    const decoy = 0x1000;
    const { mem, m, tables } = build(decoy + 1024 * 16 + 0x100);
    const ref = reference();
    ref.bool64.clear(); // brand-new file: no Skulltulas or heart pieces yet
    for (let j = 0; j < 1024; j++) mem.writeBigUInt64LE(0x0200_0000_0000_0000n + BigInt(j) * 0x10001n, decoy + j * 16);
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    expect(Number(t.b64.start - BASE)).toBe(tables.b64);
    expect(t.b64.count).toBe(nB64);
  });

  it("reads the Int64 table (the Sun's Song day/night counter), live", () => {
    const { mem, m, tables } = build();
    const ref = reference();
    // An Int64 map + 12 records (stride 0x30, value at +0x20) after the 64-bit table.
    let o = tables.b64 + nB64 * 16 + 0x200;
    const hashes = [DAY_NIGHT_KEY, ...Array.from({ length: 11 }, (_, i) => (0x70000000 + i * 7) >>> 0)];
    hashes.forEach((h, i) => { mem.writeUInt32LE(h, o); mem.writeUInt32LE(i, o + 4); o += 8; });
    o = (o + 0x40) & ~7;
    const recs = o;
    hashes.forEach((h, i) => {
      mem.writeBigUInt64LE(0x84c40e98n, recs + i * 0x30);
      mem.writeBigInt64LE(h === DAY_NIGHT_KEY ? 14n : BigInt(i * 100), recs + i * 0x30 + 0x20);
      ref.entries.set(h, { hash: h, type: 'Int64', value: h === DAY_NIGHT_KEY ? 14n : BigInt(i * 100), recordOffset: 0 });
    });
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    expect(t.records.map(r => r.type)).toContain('Int64');
    expect(readLive(m, t, ref)!.data.entries.get(DAY_NIGHT_KEY)!.value).toBe(14n);
    const before = fingerprint(t, readTables(m, t)!, new Set([DAY_NIGHT_KEY]));
    mem.writeBigInt64LE(15n, recs + 0x20); // Sun's Song: day -> night
    expect(readLive(m, t, ref)!.data.entries.get(DAY_NIGHT_KEY)!.value).toBe(15n);
    expect(fingerprint(t, readTables(m, t)!, new Set([DAY_NIGHT_KEY]))).not.toBe(before);
  });

  it('combines the stage with the place inside it', () => {
    expect(areaFrom('HyruleField_Child', ['HyruleField', 'LakeHylia', '', ''])).toBe('HyruleField_Child/LakeHylia');
    expect(areaFrom('HyruleField_Child', ['HyruleField', '', '', ''])).toBe('HyruleField_Child');
    expect(areaFrom('KokiriForest_Child', ['KokiriForest', '\\0onLonRanch', '', ''])).toBe('KokiriForest_Child'); // cleared slot in a save
    expect(areaFrom('Market_Child', undefined)).toBe('Market_Child');
  });

  it('notices when the tables move or are freed', () => {
    const { mem, m, tables } = build();
    const ref = reference();
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    mem.fill(0, tables.Bool, tables.Bool + 0x100);
    expect(readTables(m, t)).toBeNull();
  });
});

describe('Rekarina live memory', () => {
  // Rekarina maps guest memory at the same addresses: tables in the heap above 4 GB,
  // vtables in the game's code at 0x70xxxxxxxx (the real Life vtable was 0x7004B63438).
  const HEAP = 0x1_74a0_0000n, VT = 0x70_04b6_3000n;
  const rek = GAMES.find(g => g.image === 'Rekarina.exe')!;
  const rekarina = () => {
    const b = build(0x1000, { base: HEAP, vt: VT });
    const loc = addLocationList(b.mem, b.tables, 0n, { base: HEAP, vt: VT });
    loc.setList(['HyruleField', 'LakeHylia']);
    return { ...b, loc };
  };

  it('finds the tables and the location list with its layout (guest base 0, 0x70… vtables)', () => {
    const { m, tables, loc } = rekarina();
    const ref = reference();
    const t = locate(m, ref, HEAP + 0x200000n, 2 << 20, rek.layout)!;
    expect(t.records.map(r => [r.type, r.start - HEAP, r.vtable])).toEqual([
      ['Bool', BigInt(tables.Bool), VT + 0x658n], ['Int', BigInt(tables.Int), VT + 0x718n], ['Enum', BigInt(tables.Enum), VT + 0x898n],
    ]);
    expect(t.b64.start).toBe(HEAP + BigInt(tables.b64));
    expect(t.location).toEqual({ record: HEAP + BigInt(loc.rec), vtable: VT + 0xcb0n, base: 0n, checked: true });
    const live = readLive(m, t, ref)!;
    expect(matchesReference(live.agreement)).toBe(true);
    expect(live.data.entries.get(LOCATION_KEY)!.value).toEqual(['HyruleField', 'LakeHylia', '', '']);
  });

  it("doesn't take 0x70… pointers for vtables with the recomps' layout (Hookshot unaffected)", () => {
    const { mem, m } = rekarina();
    expect(locate(m, reference(), HEAP + 0x200000n, 2 << 20)).toBeNull();
    expect(findRecordRuns(mem, HEAP, 0x18, 2000)).toEqual([]);
    expect(findRecordRuns(mem, HEAP, 0x18, 2000, rek.layout!.vtables)).toHaveLength(1);
    // ...and Rekarina's layout doesn't take a recomp's small ones.
    const hook = build();
    expect(locate(hook.m, reference(), BASE + 0x200000n, 2 << 20, rek.layout)).toBeNull();
  });

  it('sweeps only the committed heap blocks between 4 GB and the code, joining close ones', () => {
    const MB = 1n << 20n;
    const r = (base: bigint, size: bigint, type = 0x20000) => ({ base, size, type });
    expect(sweepRanges([
      r(0x8000_0000n, 64n * MB), // below 4 GB: host memory
      r(0x1_0000_0000n - 2n * MB, 4n * MB), // straddles 4 GB: only the upper half counts
      r(0x2_0000_0000n, 3n * MB), r(0x2_0000_0000n + 5n * MB, 2n * MB, 0x40000), // 2 MB apart: one range
      r(0x3_0000_0000n, 512n * 1024n), // too small on its own
      r(0x70_0000_0000n, 32n * MB, 0x1000000), // the game's code
    ], { within: rek.heap, anyType: true, joinGap: 8n * MB, minSize: MB })).toEqual([
      [0x2_0000_0000n, 0x2_0000_0000n + 7n * MB], [0x1_0000_0000n, 0x1_0000_0000n + 2n * MB],
    ]);
  });

  it('gives small blocks one window of their own size, and steps through big ones as before', () => {
    const MB = 1n << 20n, W = 64 << 20;
    expect(sweepWindows([[0x1000n * MB, 0x1000n * MB + 10n * MB]], true)).toEqual([{ at: 0x1000n * MB + 5n * MB, half: 5 << 20 }]);
    const big: [bigint, bigint] = [0x1000n * MB, 0x1000n * MB + 300n * MB];
    expect(sweepWindows([big], true)).toEqual(sweepWindows([big]));
    expect(sweepWindows([big]).map(w => [w.at - big[0], w.half])).toEqual([[64n * MB, W], [184n * MB, W], [304n * MB, W]]);
  });

  it('reads around holes between committed blocks', () => {
    const backing = Buffer.alloc(0x3000, 0xaa);
    const blocks = [{ base: 0x10000n, size: 0x1000n, type: 0x20000 }, { base: 0x12000n, size: 0x1000n, type: 0x20000 }];
    const inBlock = (a: bigint, n: number) => blocks.some(b => a >= b.base && a + BigInt(n) <= b.base + b.size);
    const mem: Mem = { read: (a, n) => (inBlock(a, n) ? Buffer.from(backing.subarray(Number(a - 0x10000n), Number(a - 0x10000n) + n)) : null) };
    const b = committedReader(mem, blocks).read(0x10800n, 0x2000)!;
    expect([b[0], b[0x7ff], b[0x800], b[0x17ff], b[0x1800], b[0x1fff]]).toEqual([0xaa, 0xaa, 0, 0, 0xaa, 0xaa]);
    expect(committedReader(mem, blocks).read(0x20000n, 0x100)).toBeNull();
  });

  it('attaches to Rekarina.exe and finds the tables by sweeping its heap blocks', async () => {
    const { m, tables } = rekarina();
    const regions = [{ base: 0x1_0000_0000n, size: 0x1000n, type: 0x20000 }, { base: HEAP, size: 4n << 20n, type: 0x20000 }];
    const clock = { t: 100_000 };
    const hints: string[] = [];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const live = new LiveSource({
      hints: [], onHint: h => hints.push(h), onChange() {}, onStatus() {}, now: () => clock.t,
      findGame: async () => ({ ...rek, pid: 77 }),
      open: () => ({ read: m.read, regions: () => regions, imagePath: () => 'D:\\Games\\Rekarina\\game\\Rekarina.exe', alive: () => true, close() {} }),
    });
    live.setReference(reference());
    for (let i = 0; i < 20 && live.info.status !== 'live'; i++) { await live.tick(); clock.t += 500; }
    vi.restoreAllMocks();
    expect(live.info.status).toBe('live');
    expect(live.located()!.location).toMatchObject({ base: 0n, checked: true });
    expect(live.located()!.records[0].start).toBe(HEAP + BigInt(tables.Bool));
    expect(hints).toEqual([live.located()!.records[0].start.toString(16)]); // remembered, like the other games
  });
});
