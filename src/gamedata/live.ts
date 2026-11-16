// Reads the game's live progress tables out of a running emulator's memory
// (read-only). Pure logic over a `Mem` interface; the Windows process access is in
// src/main/procmem.ts. See docs/live-memory.md.
//
// What the game keeps in memory (worked out against real saves, Hookshot v2.1.0):
//  - One record array per value type. Every record starts with the same 8-byte pointer
//    (the type's vtable) and records are evenly spaced:
//        Bool  stride 0x18, value u8  at +0x16
//        Int   stride 0x28, value i32 at +0x1C
//        Enum  stride 0x38, value u32 at +0x1C (hash of the value name, as in saves)
//  - Directly before each record array: a hash map of {u32 key hash, u32 record index}.
//  - The 64-bit-key table (placed objects: Skulltulas, heart pieces): entries of
//    {u64 key, 8 bytes}, sorted by key, 16 bytes apart; byte +12 is 1 when set,
//    byte +8 is a class (0x18 permanent, 0x58 cleared again later, e.g. respawns).
//
// The latest save is used as the reference: it says which hashes have which type, and
// the live tables are only trusted when they agree with it (same playthrough, in game).
import type { GameDataFile, Entry, TypeName } from './parser.js';

export interface Mem {
  /** Read `len` bytes at a host address; null if it can't be read. */
  read(addr: bigint, len: number): Buffer | null;
}

export interface TypeLayout { type: 'Bool' | 'Int' | 'Enum' | 'String64' | 'Int64'; stride: number; valueOffset: number; minRecords: number; optional?: boolean }
export const LAYOUTS: TypeLayout[] = [
  { type: 'Bool', stride: 0x18, valueOffset: 0x16, minRecords: 2000 },
  { type: 'Int', stride: 0x28, valueOffset: 0x1c, minRecords: 200 },
  { type: 'Enum', stride: 0x38, valueOffset: 0x1c, minRecords: 30 },
  // Three 64-byte text buffers per record (each after a pointer + capacity); the
  // second one, at +0x74, is the current value. Optional: only used for the area.
  { type: 'String64', stride: 0x108, valueOffset: 0x74, minRecords: 5, optional: true },
  // i64 at +0x20, a copy at +0x28. Optional: only used for day or night (DAY_NIGHT_KEY).
  { type: 'Int64', stride: 0x30, valueOffset: 0x20, minRecords: 10, optional: true },
];
/**
 * Int64 key that goes up by one each time Sun's Song is played (not when the clock gets to
 * dusk or dawn by itself; checked in Hookshot v2.1.0 over a whole game day), so it can't tell
 * day from night. Read but not used yet; see docs/live-memory.md, "Time of day".
 */
export const DAY_NIGHT_KEY = 0xd457ee3a;
/** String64 key holding the current stage, e.g. "LostWood_Child" (also in progress.sav). */
export const STAGE_KEY = 0x1d6189da;
/**
 * String64Array key listing where you are inside the stage, e.g. ["HyruleField", "LakeHylia"]
 * (Lake Hylia and Lon Lon Ranch are part of the Hyrule Field stage). Also in progress.sav.
 * Records are 0x90 apart; +0x80 holds the element count and +0x88 a guest pointer to the
 * elements, each 0x50 bytes (a guest pointer to the element's own text, capacity 0x40, then
 * 64 bytes of text at +0x0C). A second copy (count +0x70, pointer +0x78) changes at the same time.
 */
export const LOCATION_KEY = 0xc458f1eb;
const LOC_STRIDE = 0x90, LOC_COUNT = 0x80, LOC_PTR = 0x88, LOC_ELEM = 0x50, LOC_TEXT = 0x0c, LOC_MAX = 16;
/**
 * Hookshot, Longshot and NX2navi map guest memory at this host offset. Emulators (Fritchii)
 * put it somewhere else every run; see locationBase().
 */
export const GUEST_BASE = 0x1000_0000_0000n;
const B64_STRIDE = 16, B64_VALUE = 12, B64_MIN = 1000;

export interface RecordTable { type: TypeLayout['type']; start: bigint; count: number; index: Map<number, number>; vtable: bigint }
export interface LiveTables {
  records: RecordTable[];
  b64: { start: bigint; count: number };
  /**
   * The location-list record (optional: only used for the area). base: host address of
   * guest 0 for its element pointer; checked: the elements' self-pointers matched at that
   * base, so every read checks them again.
   */
  location?: { record: bigint; vtable: bigint; base: bigint; checked: boolean };
}

/** Runs of records that all start with the same 8-byte pointer, `stride` apart. */
export function findRecordRuns(buf: Buffer, base: bigint, stride: number, minRecords: number): { start: bigint; count: number; offset: number }[] {
  const out: { start: bigint; count: number; offset: number }[] = [];
  const last = buf.length - 8;
  for (let o = 0; o + stride * 2 <= last; o += 8) {
    const p = buf.readBigUInt64LE(o);
    if (p === 0n || p >= 0x1_0000_0000n) continue; // guest code pointers are small
    if (buf.readBigUInt64LE(o + stride) !== p || buf.readBigUInt64LE(o + stride * 2) !== p) continue;
    // Walk back to the first record of the run.
    let s = o;
    while (s - stride >= 0 && buf.readBigUInt64LE(s - stride) === p) s -= stride;
    let n = 0;
    for (let e = s; e <= last && buf.readBigUInt64LE(e) === p; e += stride) n++;
    if (n >= minRecords) out.push({ start: base + BigInt(s), count: n, offset: s });
    o = s + n * stride - 8; // skip past this run (and keep 8-byte alignment)
  }
  return out;
}

/** Hash map before a record array: {hash, index < count}. Nearest entry wins on conflict. */
export function readIndexMap(buf: Buffer, end: number, count: number, wanted: Set<number>): Map<number, number> {
  const index = new Map<number, number>();
  // Maps seen use 50-65 bytes per record; allow generous room.
  const lo = Math.max(0, end - Math.max(count * 128, 64 << 10));
  for (let o = (end & ~7) - 8; o >= lo; o -= 8) {
    const h = buf.readUInt32LE(o);
    if (!wanted.has(h) || index.has(h)) continue;
    const i = buf.readUInt32LE(o + 4);
    if (i < count) index.set(h, i);
  }
  return index;
}

/** Sorted 64-bit-key tables: ascending u64 keys, 16 bytes apart. */
export function findB64Runs(buf: Buffer, base: bigint, minEntries: number): { start: bigint; count: number }[] {
  const out: { start: bigint; count: number }[] = [];
  for (let o = 0; o + B64_STRIDE * 2 <= buf.length; o += 8) {
    let n = 0, prev = -1n, e = o;
    while (e + B64_STRIDE <= buf.length) {
      const k = buf.readBigUInt64LE(e);
      if (k <= prev || k === 0n) break;
      prev = k; n++; e += B64_STRIDE;
    }
    if (n >= minEntries) { out.push({ start: base + BigInt(o), count: n }); o = e - 8; }
  }
  return out;
}

export interface Agreement { type: string; checked: number; agree: number; refTrue?: number; liveTrueOfRefTrue?: number }

function refByType(ref: GameDataFile) {
  const m = new Map<string, Map<number, Entry>>();
  for (const e of ref.entries.values()) {
    if (!m.has(e.type)) m.set(e.type, new Map());
    m.get(e.type)!.set(e.hash >>> 0, e);
  }
  return m;
}

function readValue(buf: Buffer, at: number, type: TypeLayout['type']): number | boolean | string | bigint {
  if (type === 'Bool') return buf[at] !== 0;
  if (type === 'String64') { const b = buf.subarray(at, at + 64); const z = b.indexOf(0); return b.subarray(0, z < 0 ? 64 : z).toString('latin1'); }
  if (type === 'Int') return buf.readInt32LE(at);
  if (type === 'Int64') return buf.readBigInt64LE(at);
  return buf.readUInt32LE(at);
}

/**
 * Find the live tables near `hint` (host address), using `ref` to tell real tables from
 * look-alikes. Searches `window` bytes either side of the hint.
 */
export function locate(mem: Mem, ref: GameDataFile, hint: bigint, window = 64 << 20): LiveTables | null {
  const lo = hint > BigInt(window) ? hint - BigInt(window) : 0n;
  const buf = readWindow(mem, lo, window * 2);
  if (!buf) return null;
  const byType = refByType(ref);
  const records: RecordTable[] = [];
  for (const L of LAYOUTS) {
    const refEntries = byType.get(L.type);
    if (!refEntries?.size) { if (L.optional) continue; return null; }
    const wanted = new Set(refEntries.keys());
    let best: { t: RecordTable; score: number } | undefined;
    for (const run of findRecordRuns(buf, lo, L.stride, L.minRecords)) {
      const index = readIndexMap(buf, run.offset, run.count, wanted);
      if (index.size < wanted.size * 0.9) continue;
      let agree = 0;
      for (const [h, i] of index) {
        const v = readValue(buf, run.offset + i * L.stride + L.valueOffset, L.type);
        if (sameValue(v, refEntries.get(h)!.value)) agree++;
      }
      const score = agree / index.size;
      if (!best || score > best.score) best = { t: { type: L.type, start: run.start, count: run.count, index, vtable: buf.readBigUInt64LE(run.offset) }, score };
    }
    if (!best) { if (L.optional) continue; return null; }
    records.push(best.t);
  }
  // 64-bit keys: the table holding the most of the reference's set keys. On a new file
  // the save has none yet, so every ascending run ties; the real table lists every placed
  // object in the game (11,658 in Hookshot v2.1.0), so prefer the longest on a tie.
  let b64: LiveTables['b64'] | undefined, bestHits = -1;
  const refKeys = [...ref.bool64];
  for (const run of findB64Runs(buf, lo, B64_MIN)) {
    const keys = new Set<bigint>();
    const off = Number(run.start - lo);
    for (let j = 0; j < run.count; j++) keys.add(buf.readBigUInt64LE(off + j * B64_STRIDE));
    const hits = refKeys.filter(k => keys.has(k)).length;
    if (hits > bestHits || (hits === bestHits && run.count > b64!.count)) { bestHits = hits; b64 = run; }
  }
  if (!b64 || (refKeys.length && bestHits < refKeys.length * 0.9)) return null;
  return { records, b64, location: findLocation(mem, buf, lo) };
}

/** The location-list record: a run of 0x90-byte records whose map holds LOCATION_KEY. */
function findLocation(mem: Mem, buf: Buffer, lo: bigint): LiveTables['location'] {
  for (const run of findRecordRuns(buf, lo, LOC_STRIDE, 2)) {
    const i = readIndexMap(buf, run.offset, run.count, new Set([LOCATION_KEY])).get(LOCATION_KEY);
    if (i === undefined) continue;
    const o = run.offset + i * LOC_STRIDE;
    const n = buf.readUInt32LE(o + LOC_COUNT), p = buf.readBigUInt64LE(o + LOC_PTR);
    if (n < 1 || n > LOC_MAX || p === 0n || p >= GUEST_BASE) continue;
    const base = locationBase(mem, buf, lo, p, n);
    return { record: run.start + BigInt(i * LOC_STRIDE), vtable: buf.readBigUInt64LE(run.offset), base: base ?? GUEST_BASE, checked: base !== undefined };
  }
  return undefined;
}

/** Each element starts with a guest pointer to its own text; true if `b` holds n such elements for guest address p. */
function elementsAt(b: Buffer | null, p: bigint, n: number): boolean {
  if (!b || b.length < n * LOC_ELEM) return false;
  for (let i = 0; i < n; i++) if (b.readBigUInt64LE(i * LOC_ELEM) !== p + BigInt(i * LOC_ELEM + LOC_TEXT)) return false;
  return true;
}

/**
 * Host address of guest 0 for the location list's pointer (p, n elements). Recomps map
 * guest memory at GUEST_BASE. Elsewhere, find the elements by their self-pointers in the
 * window that holds the tables (they sit next to the list record). undefined if neither fits.
 */
function locationBase(mem: Mem, buf: Buffer, lo: bigint, p: bigint, n: number): bigint | undefined {
  if (elementsAt(mem.read(GUEST_BASE + p, n * LOC_ELEM), p, n)) return GUEST_BASE;
  const want = Buffer.alloc(8);
  want.writeBigUInt64LE(p + BigInt(LOC_TEXT));
  for (let o = buf.indexOf(want); o >= 0; o = buf.indexOf(want, o + 1)) {
    if (o + n * LOC_ELEM <= buf.length && elementsAt(buf.subarray(o, o + n * LOC_ELEM), p, n)) return lo + BigInt(o) - p;
  }
  return undefined;
}

/** The location list's elements, read now (empty strings for unused slots); null if unreadable. */
function readLocationRaw(mem: Mem, loc: NonNullable<LiveTables['location']>): Buffer | null {
  const r = mem.read(loc.record, LOC_STRIDE);
  if (!r || r.readBigUInt64LE(0) !== loc.vtable) return null;
  const n = r.readUInt32LE(LOC_COUNT), p = r.readBigUInt64LE(LOC_PTR);
  if (n < 1 || n > LOC_MAX || p === 0n || p >= GUEST_BASE) return null;
  const b = mem.read(loc.base + p, n * LOC_ELEM);
  // Where the base was checked, a list that moved out of reach reads as unknown, never as garbage.
  return loc.checked && !elementsAt(b, p, n) ? null : b;
}

/**
 * Where an emulator's guest memory may be, in the order to search it: its mapped views
 * (type 0x40000), touching blocks merged, biggest first. Blocks under 4 MB can't hold the tables.
 */
export function sweepRanges(regions: { base: bigint; size: bigint; type: number }[]): [bigint, bigint][] {
  const mapped = regions.filter(r => r.type === 0x40000).sort((a, b) => (a.base < b.base ? -1 : a.base > b.base ? 1 : 0));
  const ranges: [bigint, bigint][] = [];
  for (const r of mapped) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === r.base) last[1] = r.base + r.size; else ranges.push([r.base, r.base + r.size]);
  }
  return ranges.filter(([lo, hi]) => hi - lo >= 4n << 20n).sort((a, b) => (b[1] - b[0] > a[1] - a[0] ? 1 : b[1] - b[0] < a[1] - a[0] ? -1 : 0));
}

function locationStrings(b: Buffer): string[] {
  const out: string[] = [];
  for (let o = 0; o + LOC_ELEM <= b.length; o += LOC_ELEM) out.push(readValue(b, o + LOC_TEXT, 'String64') as string);
  return out;
}

/**
 * Where you are, from a stage name and the location list: "HyruleField_Child/LakeHylia"
 * when the list names a place inside the stage, otherwise just the stage.
 */
export function areaFrom(stage: string, list: unknown): string {
  if (!Array.isArray(list)) return stage;
  // Unused slots are empty; saves mark a slot the game cleared with a leading "\\0".
  const inner = list.slice(1).filter((x): x is string => typeof x === 'string' && !!x && !x.startsWith('\\0'));
  return inner.length ? `${stage}/${inner[inner.length - 1]}` : stage;
}

function readWindow(mem: Mem, lo: bigint, len: number): Buffer | null {
  const CH = 4 << 20;
  const out = Buffer.alloc(len);
  let any = false;
  for (let o = 0; o < len; o += CH) {
    const b = mem.read(lo + BigInt(o), Math.min(CH, len - o));
    if (b) { b.copy(out, o); any = true; }
  }
  return any ? out : null;
}

function sameValue(live: number | boolean | string | bigint, saved: unknown): boolean {
  return live === saved;
}

export interface LiveRead {
  data: GameDataFile;
  /** Raw bytes of all tables, to detect changes cheaply. */
  raw: Buffer[];
  agreement: Agreement[];
  /** 64-bit keys the game clears again later (respawning objects). */
  resettable: Set<bigint>;
}

/**
 * Read the tables now and build a GameDataFile: the reference save with every Bool,
 * Int and Enum value and the 64-bit key set replaced by live values.
 */
export function readLive(mem: Mem, tables: LiveTables, ref: GameDataFile): LiveRead | null {
  const raw = readTables(mem, tables);
  return raw && buildLive(tables, raw, ref);
}

/** Raw bytes of every table, in `tables.records` order, then the 64-bit-key table. */
export function readTables(mem: Mem, tables: LiveTables): Buffer[] | null {
  const raw: Buffer[] = [];
  for (const t of tables.records) {
    const L = LAYOUTS.find(l => l.type === t.type)!;
    const buf = mem.read(t.start, t.count * L.stride);
    // Moved or freed: the records no longer start with the type's pointer.
    if (!buf || buf.readBigUInt64LE(0) !== t.vtable || buf.readBigUInt64LE((t.count - 1) * L.stride) !== t.vtable) return null;
    raw.push(buf);
  }
  const b = mem.read(tables.b64.start, tables.b64.count * B64_STRIDE);
  if (!b) return null;
  raw.push(b);
  // Location list last; an empty buffer if it isn't known or can't be read right now.
  raw.push((tables.location && readLocationRaw(mem, tables.location)) || Buffer.alloc(0));
  return raw;
}

/**
 * A fingerprint of the values the tracker cares about: every Bool, Enum and 64-bit key,
 * and the Ints in `watchInts` (others, such as play time, change constantly).
 */
export function fingerprint(tables: LiveTables, raw: Buffer[], watchInts: Set<number>): string {
  const parts: string[] = [];
  tables.records.forEach((t, n) => {
    const L = LAYOUTS.find(l => l.type === t.type)!;
    const buf = raw[n];
    if (t.type === 'Bool') {
      const bits = Buffer.alloc(t.count);
      for (let i = 0; i < t.count; i++) bits[i] = buf[i * L.stride + L.valueOffset];
      parts.push(bits.toString('base64'));
    } else {
      const vals: (number | string)[] = [];
      for (const [h, i] of t.index) {
        if (t.type === 'String64') vals.push(h, readValue(buf, i * L.stride + L.valueOffset, 'String64') as string);
        // Int and Int64 tables also hold play-time counters: only the watched ones count.
        else if (t.type === 'Enum' || watchInts.has(h)) vals.push(h, buf.readUInt32LE(i * L.stride + L.valueOffset));
      }
      parts.push(vals.join(','));
    }
  });
  const b = raw[tables.records.length];
  const set = Buffer.alloc(tables.b64.count);
  for (let j = 0; j < tables.b64.count; j++) set[j] = b[j * B64_STRIDE + B64_VALUE];
  parts.push(set.toString('base64'));
  const loc = raw[tables.records.length + 1];
  if (loc?.length) parts.push(locationStrings(loc).join(','));
  return parts.join('|');
}

export function buildLive(tables: LiveTables, raw: Buffer[], ref: GameDataFile): LiveRead {
  const entries = new Map(ref.entries);
  const agreement: Agreement[] = [];
  for (const [n, t] of tables.records.entries()) {
    const L = LAYOUTS.find(l => l.type === t.type)!;
    const buf = raw[n];
    const a: Agreement = { type: t.type, checked: 0, agree: 0, refTrue: 0, liveTrueOfRefTrue: 0 };
    for (const [h, i] of t.index) {
      const prev = ref.entries.get(h);
      if (!prev || prev.type !== t.type) continue;
      const v = readValue(buf, i * L.stride + L.valueOffset, t.type);
      a.checked++;
      if (sameValue(v, prev.value)) a.agree++;
      if (t.type === 'Bool' && prev.value === true) { a.refTrue!++; if (v === true) a.liveTrueOfRefTrue!++; }
      if (!sameValue(v, prev.value)) entries.set(h, { ...prev, value: v });
    }
    agreement.push(a);
  }
  const b = raw[tables.records.length];
  const bool64 = new Set<bigint>();
  const resettable = new Set<bigint>();
  for (let j = 0; j < tables.b64.count; j++) {
    const o = j * B64_STRIDE;
    const k = b.readBigUInt64LE(o);
    if (b[o + B64_VALUE] === 1) bool64.add(k);
    // Class byte 0x58 (bit 0x40): flags the game clears again after a while
    // (respawning objects). Skulltulas and heart pieces are 0x18 (permanent).
    if (b[o + 8] & 0x40) resettable.add(k);
  }
  const lost = [...ref.bool64].filter(k => !bool64.has(k) && !resettable.has(k)).length;
  agreement.push({ type: 'Bool64bitKey', checked: ref.bool64.size, agree: ref.bool64.size - lost });
  const loc = raw[tables.records.length + 1];
  if (loc?.length) {
    const prev = ref.entries.get(LOCATION_KEY);
    entries.set(LOCATION_KEY, { hash: LOCATION_KEY, type: 'String64Array', recordOffset: prev?.recordOffset ?? 0, value: locationStrings(loc) } as Entry);
  }
  return { data: { ...ref, entries, bool64, warnings: [] }, raw, agreement, resettable };
}

/**
 * Is the live state the same playthrough as the reference save, and actually in game?
 * Progress only grows, so nearly everything set in the save must still be set live.
 * (At the title screen or in another file, most of it isn't.)
 */
export function matchesReference(agreement: Agreement[]): boolean {
  const bool = agreement.find(a => a.type === 'Bool');
  const b64 = agreement.find(a => a.type === 'Bool64bitKey');
  if (!bool || !b64) return false;
  const trueKept = bool.refTrue ? bool.liveTrueOfRefTrue! / bool.refTrue : 1;
  return trueKept >= 0.9 && b64.checked - b64.agree <= 3;
}

export type { TypeName };
