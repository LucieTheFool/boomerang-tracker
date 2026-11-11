// Parser for Nintendo "GameData" save containers (progress.sav, caption.sav, ...)
// as used by the Switch 2 Ocarina of Time remake. No Electron imports here.
//
// Layout (all little-endian), worked out from real saves; see docs/save-format.md:
//   0x00 u32 magic 0x01020304
//   0x04 u32 format version (0x002D80EB seen)
//   0x08 u32 end of the record table = start of the data area
//   0x0C..0x27 zero
//   0x28.. 8-byte records (u32 hash, u32 value). Records are grouped by type.
//          A record with hash 0 starts a section; its value is the type id of
//          the records that follow (empty sections appear as runs of hash-0 records).
//          The first section (Bool, id 0) has no separator.
//   Inline types keep the value in the record; other types store an offset into
//   the data area.

export const MAGIC = 0x01020304;
export const KNOWN_VERSIONS = [0x002d80eb];

export const TYPE_NAMES = [
  'Bool', 'BoolArray', 'Int', 'IntArray', 'Float', 'FloatArray', 'Enum', 'EnumArray',
  'Vector2', 'Vector2Array', 'Vector3', 'Vector3Array',
  'String16', 'String16Array', 'String32', 'String32Array', 'String64', 'String64Array',
  'Binary', 'BinaryArray', 'UInt', 'UIntArray', 'Int64', 'Int64Array', 'UInt64', 'UInt64Array',
  'WString16', 'WString16Array', 'WString32', 'WString32Array', 'WString64', 'WString64Array',
  'Bool64bitKey',
] as const;
export type TypeName = (typeof TYPE_NAMES)[number];

export type Value =
  | boolean | number | bigint | string
  | { x: number; y: number; z?: number }
  | { bytes: string } // hex
  | Value[];

export interface Entry {
  hash: number;
  type: TypeName;
  value: Value;
  /** File offset of the record (for debugging). */
  recordOffset: number;
  /** Offset into the data area, for non-inline types. */
  dataOffset?: number;
}

export interface GameDataFile {
  version: number;
  dataStart: number;
  size: number;
  entries: Map<number, Entry>;
  /** Set 64-bit keys (Bool64bitKey section). Only keys that are true are stored. */
  bool64: Set<bigint>;
  /** Hash of the Bool64bitKey section record, if present. */
  bool64Hash?: number;
  warnings: string[];
}

export class GameDataError extends Error {}

const INLINE = new Set<TypeName>(['Bool', 'Int', 'Float', 'Enum', 'UInt']);

/** Fixed byte size of one element of an array (or of a non-inline scalar). */
function elementSize(t: TypeName): number | null {
  switch (t) {
    case 'IntArray': case 'FloatArray': case 'EnumArray': case 'UIntArray': return 4;
    case 'Vector2': case 'Vector2Array': return 8;
    case 'Vector3': case 'Vector3Array': return 12;
    case 'String16': case 'String16Array': return 16;
    case 'String32': case 'String32Array': return 32;
    case 'String64': case 'String64Array': return 64;
    case 'WString16': case 'WString16Array': return 32;
    case 'WString32': case 'WString32Array': return 64;
    case 'WString64': case 'WString64Array': return 128;
    case 'Int64': case 'Int64Array': case 'UInt64': case 'UInt64Array': return 8;
    default: return null;
  }
}

export function parseGameData(buf: Uint8Array): GameDataFile {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 0x28) throw new GameDataError(`File too small (${b.length} bytes)`);
  const magic = b.readUInt32LE(0);
  if (magic !== MAGIC) throw new GameDataError(`Not a GameData file (magic 0x${magic.toString(16)})`);
  const version = b.readUInt32LE(4);
  const dataStart = b.readUInt32LE(8);
  if (dataStart < 0x28 || dataStart > b.length || (dataStart - 0x28) % 8 !== 0)
    throw new GameDataError(`Bad data offset 0x${dataStart.toString(16)} (file is ${b.length} bytes)`);

  const warnings: string[] = [];
  if (!KNOWN_VERSIONS.includes(version))
    warnings.push(`Unknown format version 0x${version.toString(16)}; decoding may be wrong`);

  // Pass 1: read records and assign types from section separators.
  const raw: { hash: number; type: TypeName; value: number; off: number }[] = [];
  let typeId = 0;
  for (let o = 0x28; o < dataStart; o += 8) {
    const hash = b.readUInt32LE(o);
    const value = b.readUInt32LE(o + 4);
    if (hash === 0) {
      typeId = value;
      if (typeId >= TYPE_NAMES.length) throw new GameDataError(`Unknown type id ${typeId} at 0x${o.toString(16)}`);
      continue;
    }
    raw.push({ hash, type: TYPE_NAMES[typeId], value, off: o });
  }

  // Data-area offsets must increase; each value ends where the next begins.
  // Offset 0 on the Bool64bitKey record means "no keys" (seen in caption/option/account.sav).
  const isEmptyBool64 = (r: { type: TypeName; value: number }) => r.type === 'Bool64bitKey' && r.value === 0;
  const offsets = raw.filter(r => !INLINE.has(r.type) && !isEmptyBool64(r)).map(r => r.value);
  for (let i = 1; i < offsets.length; i++)
    if (offsets[i] < offsets[i - 1]) warnings.push(`Data offsets not ascending at entry ${i}`);

  const entries = new Map<number, Entry>();
  let bool64 = new Set<bigint>();
  let bool64Hash: number | undefined;
  let expectedNext = dataStart;

  for (const r of raw) {
    if (INLINE.has(r.type)) {
      entries.set(r.hash, { hash: r.hash, type: r.type, value: decodeInline(r.type, r.value), recordOffset: r.off });
      continue;
    }
    if (isEmptyBool64(r)) { bool64Hash = r.hash; continue; }
    const off = r.value;
    if (off !== expectedNext)
      warnings.push(`${r.type} ${hex(r.hash)}: data at 0x${off.toString(16)}, expected 0x${expectedNext.toString(16)}`);
    if (off > b.length) throw new GameDataError(`${r.type} ${hex(r.hash)} points past end of file`);

    if (r.type === 'Bool64bitKey') {
      // Sorted list of u64 keys running to the end of the file.
      bool64Hash = r.hash;
      const set = new Set<bigint>();
      if ((b.length - off) % 8 !== 0) warnings.push(`Bool64bitKey area is not a multiple of 8 bytes`);
      // The list is sorted ascending; a trailing zero is padding, not a flag.
      for (let o = off; o + 8 <= b.length; o += 8) { const k = b.readBigUInt64LE(o); if (k !== 0n) set.add(k); }
      bool64 = set;
      expectedNext = b.length;
      continue;
    }

    const { value, end } = decodeAt(b, r.type, off);
    entries.set(r.hash, { hash: r.hash, type: r.type, value, recordOffset: r.off, dataOffset: off });
    expectedNext = end;
  }
  if (expectedNext !== b.length) warnings.push(`Data area ends at 0x${expectedNext.toString(16)}, file is 0x${b.length.toString(16)} bytes`);

  return { version, dataStart, size: b.length, entries, bool64, bool64Hash, warnings };
}

function decodeInline(t: TypeName, v: number): Value {
  switch (t) {
    case 'Bool': return v !== 0;
    case 'Int': return v | 0;
    case 'Float': { const f = Buffer.alloc(4); f.writeUInt32LE(v); return f.readFloatLE(0); }
    default: return v >>> 0; // UInt, Enum (enum = hash of the value name)
  }
}

function readScalar(b: Buffer, t: TypeName, o: number): Value {
  switch (t) {
    case 'IntArray': return b.readInt32LE(o);
    case 'FloatArray': return b.readFloatLE(o);
    case 'EnumArray': case 'UIntArray': return b.readUInt32LE(o);
    case 'Vector2': case 'Vector2Array': return { x: b.readFloatLE(o), y: b.readFloatLE(o + 4) };
    case 'Vector3': case 'Vector3Array': return { x: b.readFloatLE(o), y: b.readFloatLE(o + 4), z: b.readFloatLE(o + 8) };
    case 'Int64': case 'Int64Array': return b.readBigInt64LE(o);
    case 'UInt64': case 'UInt64Array': return b.readBigUInt64LE(o);
    case 'String16': case 'String16Array': return cstr(b, o, 16);
    case 'String32': case 'String32Array': return cstr(b, o, 32);
    case 'String64': case 'String64Array': return cstr(b, o, 64);
    case 'WString16': case 'WString16Array': return wstr(b, o, 32);
    case 'WString32': case 'WString32Array': return wstr(b, o, 64);
    case 'WString64': case 'WString64Array': return wstr(b, o, 128);
    default: throw new GameDataError(`No scalar reader for ${t}`);
  }
}

function decodeAt(b: Buffer, t: TypeName, off: number): { value: Value; end: number } {
  if (t === 'Binary') {
    const size = b.readUInt32LE(off);
    return { value: { bytes: b.subarray(off + 4, off + 4 + size).toString('hex') }, end: off + 4 + size };
  }
  if (t === 'BoolArray') {
    // u32 bit count, then the bits packed into u32 words (bit i = word i>>5, bit i&31).
    const count = b.readUInt32LE(off);
    const words = Math.ceil(count / 32);
    const out: boolean[] = [];
    for (let i = 0; i < count; i++) out.push(((b.readUInt32LE(off + 4 + (i >> 5) * 4) >>> (i & 31)) & 1) === 1);
    return { value: out, end: off + 4 + words * 4 };
  }
  if (t === 'BinaryArray') {
    // u32 count, then per element: u32 size + bytes. (Only empty elements seen so far.)
    const count = b.readUInt32LE(off);
    let o = off + 4;
    const out: Value[] = [];
    for (let i = 0; i < count; i++) {
      const size = b.readUInt32LE(o);
      out.push({ bytes: b.subarray(o + 4, o + 4 + size).toString('hex') });
      o += 4 + size;
    }
    return { value: out, end: o };
  }
  const size = elementSize(t);
  if (size === null) throw new GameDataError(`Unsupported type ${t}`);
  if (t.endsWith('Array')) {
    const count = b.readUInt32LE(off);
    const out: Value[] = [];
    for (let i = 0; i < count; i++) out.push(readScalar(b, t, off + 4 + i * size));
    return { value: out, end: off + 4 + count * size };
  }
  return { value: readScalar(b, t, off), end: off + size };
}

function cstr(b: Buffer, o: number, len: number): string {
  const s = b.subarray(o, o + len);
  let end = s.indexOf(0);
  // Some strings start with a NUL but hold text after it (seen in a String32);
  // keep the text so it stays visible, marked with a leading "\0".
  if (end === 0 && s.some(c => c !== 0)) {
    const rest = s.subarray(1);
    const e2 = rest.indexOf(0);
    return '\\0' + rest.subarray(0, e2 < 0 ? rest.length : e2).toString('utf8');
  }
  if (end < 0) end = s.length;
  return s.subarray(0, end).toString('utf8');
}

function wstr(b: Buffer, o: number, len: number): string {
  const s = b.subarray(o, o + len);
  let end = s.length;
  for (let i = 0; i + 1 < s.length; i += 2) if (s[i] === 0 && s[i + 1] === 0) { end = i; break; }
  return s.subarray(0, end).toString('utf16le');
}

const hex = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(8, '0');
