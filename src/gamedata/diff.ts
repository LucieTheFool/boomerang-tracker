import { GameDataFile, Value } from './parser.js';
import { hex64 } from './murmur3.js';

export interface Change {
  /** u32 hash, or "b64:<hex>" for a Bool64bitKey flag */
  key: number | string;
  type: string;
  old: Value | undefined;
  new: Value | undefined;
  /** For arrays: the indices that changed. */
  indices?: number[];
}

export function valueEquals(a: Value | undefined, b: Value | undefined): boolean {
  return stable(a) === stable(b);
}

export function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? `${x}n` : x));
}

export function diffGameData(a: GameDataFile, b: GameDataFile): Change[] {
  const out: Change[] = [];
  const keys = new Set([...a.entries.keys(), ...b.entries.keys()]);
  for (const k of keys) {
    const ea = a.entries.get(k);
    const eb = b.entries.get(k);
    if (ea && eb && valueEquals(ea.value, eb.value)) continue;
    const c: Change = { key: k, type: (eb ?? ea)!.type, old: ea?.value, new: eb?.value };
    if (Array.isArray(ea?.value) && Array.isArray(eb?.value)) {
      const n = Math.max(ea.value.length, eb.value.length);
      c.indices = [];
      for (let i = 0; i < n; i++) if (!valueEquals(ea.value[i], eb.value[i])) c.indices.push(i);
    }
    out.push(c);
  }
  for (const k of a.bool64) if (!b.bool64.has(k)) out.push({ key: 'b64:' + hex64(k), type: 'Bool64bitKey', old: true, new: false });
  for (const k of b.bool64) if (!a.bool64.has(k)) out.push({ key: 'b64:' + hex64(k), type: 'Bool64bitKey', old: false, new: true });
  return out;
}
