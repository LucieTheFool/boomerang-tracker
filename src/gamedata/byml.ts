// Minimal BYML (v2-v7) reader, used to read the game's GameDataList at runtime.
export type BymlValue =
  | null | boolean | number | bigint | string
  | { bin: Uint8Array }
  | BymlValue[]
  | { [k: string]: BymlValue };

export function parseByml(b: Buffer): BymlValue {
  const magic = b.toString('latin1', 0, 2);
  if (magic !== 'BY' && magic !== 'YB') throw new Error('Not a BYML file');
  const be = magic === 'BY';
  const u8 = (o: number) => b[o];
  const u32 = (o: number) => (be ? b.readUInt32BE(o) : b.readUInt32LE(o));
  const u24 = (o: number) => (be ? (b[o] << 16) | (b[o + 1] << 8) | b[o + 2] : b[o] | (b[o + 1] << 8) | (b[o + 2] << 16));
  const strTab = (off: number) => {
    if (!off) return [] as string[];
    const n = u24(off + 1);
    const r: string[] = [];
    for (let i = 0; i < n; i++) {
      const s = off + u32(off + 4 + i * 4);
      r.push(b.toString('utf8', s, b.indexOf(0, s)));
    }
    return r;
  };
  const keys = strTab(u32(4));
  const strs = strTab(u32(8));

  const val = (t: number, v: number): BymlValue => {
    switch (t) {
      case 0xa0: return strs[v];
      case 0xa1: return { bin: b.subarray(v + 4, v + 4 + u32(v)) };
      case 0xd0: return v !== 0;
      case 0xd1: return v | 0;
      case 0xd2: { const x = Buffer.alloc(4); x.writeUInt32LE(v); return x.readFloatLE(0); }
      case 0xd3: return v >>> 0;
      case 0xd4: return be ? b.readBigInt64BE(v) : b.readBigInt64LE(v);
      case 0xd5: return be ? b.readBigUInt64BE(v) : b.readBigUInt64LE(v);
      case 0xd6: return be ? b.readDoubleBE(v) : b.readDoubleLE(v);
      case 0xff: return null;
      default: return node(v);
    }
  };
  const node = (o: number): BymlValue => {
    const t = u8(o);
    const n = u24(o + 1);
    if (t === 0xc0) {
      const r: BymlValue[] = [];
      const vo = o + 4 + ((n + 3) & ~3);
      for (let i = 0; i < n; i++) r.push(val(u8(o + 4 + i), u32(vo + i * 4)));
      return r;
    }
    if (t === 0xc1) {
      const r: Record<string, BymlValue> = {};
      for (let i = 0; i < n; i++) {
        const e = o + 4 + i * 8;
        r[keys[u24(e)]] = val(u8(e + 3), u32(e + 4));
      }
      return r;
    }
    if (t === 0x20 || t === 0x21) {
      // hash-keyed dictionaries (v7)
      const ks = t === 0x20 ? 8 : 12;
      const r: Record<string, BymlValue> = {};
      const to = o + 4 + n * ks;
      for (let i = 0; i < n; i++) {
        const e = o + 4 + i * ks;
        const k = t === 0x20 ? u32(e).toString(16) : (be ? b.readBigUInt64BE(e) : b.readBigUInt64LE(e)).toString(16);
        r['#' + k] = val(u8(to + i), u32(e + ks - 4));
      }
      return r;
    }
    throw new Error(`Unknown BYML node 0x${t.toString(16)} at 0x${o.toString(16)}`);
  };
  const root = u32(12);
  return root ? node(root) : null;
}
