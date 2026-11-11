// Read-only helpers for the game's RomFS (used at development time and by the
// `names` CLI). Nothing read here is ever written into the repo.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

type ZstdFn = (buf: Buffer, opts?: { dictionary?: Buffer }) => Buffer;
const zstdDecompress: ZstdFn | undefined = (zlib as unknown as { zstdDecompressSync?: ZstdFn }).zstdDecompressSync;

export class RomFs {
  private dicts: Buffer[] = [];
  constructor(public root: string) {
    if (!zstdDecompress) throw new Error('This Node.js has no zstd support (need Node 22.15+ / 23.8+)');
    const dicPack = path.join(root, 'Pack', 'ZsDic.pack.zs');
    if (fs.existsSync(dicPack)) {
      const sarc = parseSarc(zstdDecompress(fs.readFileSync(dicPack)));
      // Order matters only for speed: zs.zsdic is the general-purpose one.
      const order = ['zs.zsdic', 'bcett.byml.zsdic', 'pack.zsdic', 'bkprb.zsdic'];
      this.dicts = [...sarc.entries()]
        .sort(([a], [b]) => (order.indexOf(a) + 99 * +!order.includes(a)) - (order.indexOf(b) + 99 * +!order.includes(b)))
        .map(([, d]) => d);
    }
  }

  /** Decompress a .zs buffer, trying each dictionary. */
  decompress(buf: Buffer, nameHint = ''): Buffer {
    const prefer = nameHint.endsWith('.pack.zs') ? 2 : nameHint.endsWith('.bcett.byml.zs') ? 1 : nameHint.endsWith('.bkprb.zs') ? 3 : 0;
    const tries = [this.dicts[prefer], ...this.dicts.filter((_, i) => i !== prefer), undefined];
    for (const d of tries) {
      try { return zstdDecompress!(buf, d ? { dictionary: d } : undefined); } catch { /* try next */ }
    }
    throw new Error(`Could not decompress ${nameHint}`);
  }

  read(rel: string): Buffer {
    const buf = fs.readFileSync(path.join(this.root, rel));
    return rel.endsWith('.zs') ? this.decompress(buf, rel) : buf;
  }
}

/** Parse a SARC archive into name -> bytes. */
export function parseSarc(b: Buffer): Map<string, Buffer> {
  if (b.toString('latin1', 0, 4) !== 'SARC') throw new Error('Not a SARC');
  const le = b.readUInt16LE(6) === 0xfeff;
  const u16 = (o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const headerLen = u16(4);
  const dataOff = u32(0x0c);
  const sfat = headerLen;
  const count = u16(sfat + 6);
  const sfnt = sfat + 0x0c + count * 16;
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const o = sfat + 0x0c + i * 16;
    const attr = u32(o + 4);
    const start = u32(o + 8);
    const end = u32(o + 12);
    let name = `#${i}`;
    if (attr & 0x01000000) {
      const n = sfnt + 8 + (attr & 0xffff) * 4;
      name = b.toString('utf8', n, b.indexOf(0, n));
    }
    out.set(name, b.subarray(dataOff + start, dataOff + end));
  }
  return out;
}

/** Pull identifier-like ASCII strings (and UTF-16LE ones) out of arbitrary bytes. */
export function harvestStrings(b: Buffer, minLen = 3, out = new Set<string>()): Set<string> {
  const ok = (c: number) => (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || c === 0x5f || c === 0x2e || c === 0x2f || c === 0x2d;
  let s = -1;
  for (let i = 0; i <= b.length; i++) {
    if (i < b.length && ok(b[i])) { if (s < 0) s = i; continue; }
    if (s >= 0 && i - s >= minLen) out.add(b.toString('latin1', s, i));
    s = -1;
  }
  // UTF-16LE runs (event flows and messages sometimes store names this way)
  s = -1;
  for (let i = 0; i + 1 <= b.length; i += 2) {
    if (i + 1 < b.length && ok(b[i]) && b[i + 1] === 0) { if (s < 0) s = i; continue; }
    if (s >= 0 && (i - s) / 2 >= minLen) out.add(b.toString('utf16le', s, i));
    s = -1;
  }
  return out;
}
