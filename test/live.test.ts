import { describe, it, expect } from 'vitest';
import { locate, readLive, matchesReference, fingerprint, readTables, areaFrom, LAYOUTS, STAGE_KEY, LOCATION_KEY, GUEST_BASE, Mem } from '../src/gamedata/live';
import type { GameDataFile, Entry } from '../src/gamedata/parser';

// Synthetic memory laid out like the game's: per type a {hash, index} map followed by a
// record array, then a sorted 64-bit-key table. All values made up.
const BASE = 0x1010_0000_0000n;
const nBool = 2400, nInt = 300, nEnum = 40, nB64 = 1200;
const hBool = (i: number) => (0x10000000 + i * 7919) >>> 0;
const hInt = (i: number) => (0x50000000 + i * 104729) >>> 0;
const hEnum = (i: number) => (0x90000000 + i * 1299709) >>> 0;
const key64 = (j: number) => 0x0100_0000_0000_0000n + BigInt(j) * 0x0000_0100_0000_0001n;

function build(start = 0x1000) {
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
  put('Bool', nBool, hBool, 0x84c40658n, i => (i % 10 === 0 ? 1 : 0));
  put('Int', nInt, hInt, 0x84c40718n, i => i * 3 - 5);
  put('Enum', nEnum, hEnum, 0x84c40898n, i => hEnum(i) ^ 0xabc);
  tables.b64 = o;
  for (let j = 0; j < nB64; j++) {
    const r = o + j * 16;
    mem.writeBigUInt64LE(key64(j), r);
    mem[r + 8] = j % 50 === 1 ? 0x58 : 0x18;
    mem[r + 12] = j % 20 === 0 || j % 50 === 1 ? 1 : 0;
  }
  const m: Mem = { read: (addr, len) => {
    const off = Number(addr - BASE);
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
    // A String64Array map + three 0x90-byte records after the 64-bit table; record 1 is the list.
    let o = tables.b64 + nB64 * 16 + 0x200;
    const hashes = [0x12345678, LOCATION_KEY, 0x23456789];
    hashes.forEach((h, i) => { mem.writeUInt32LE(h, o); mem.writeUInt32LE(i, o + 4); o += 8; });
    o = (o + 0x40) & ~7;
    const recs = o, elems = recs + 3 * 0x90 + 0x100;
    hashes.forEach((_, i) => mem.writeBigUInt64LE(0x84c40cb0n, recs + i * 0x90));
    const rec = recs + 0x90;
    mem.writeUInt32LE(4, rec + 0x80);
    mem.writeBigUInt64LE(BASE + BigInt(elems) - GUEST_BASE, rec + 0x88); // a guest pointer
    const setList = (names: string[]) => { mem.fill(0, elems, elems + 4 * 0x50); names.forEach((n, i) => mem.write(n, elems + i * 0x50 + 0x0c, 'latin1')); };
    setList(['HyruleField', 'LakeHylia']);
    const t = locate(m, ref, BASE + 0x200000n, 2 << 20)!;
    expect(Number(t.location!.record - BASE)).toBe(rec);
    const first = readTables(m, t)!;
    expect(readLive(m, t, ref)!.data.entries.get(LOCATION_KEY)!.value).toEqual(['HyruleField', 'LakeHylia', '', '']);
    setList(['HyruleField', 'LonLonRanch']);
    expect(fingerprint(t, readTables(m, t)!, new Set())).not.toBe(fingerprint(t, first, new Set()));
    expect(readLive(m, t, ref)!.data.entries.get(LOCATION_KEY)!.value).toEqual(['HyruleField', 'LonLonRanch', '', '']);
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
