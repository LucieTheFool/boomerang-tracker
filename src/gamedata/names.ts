// Readable-name lookup: hash -> flag name, and hash -> enum value name.
// Built locally by `npm run sav -- names <romfs>` and stored in local/names.json
// (gitignored, because it is derived from the game's files).
import fs from 'node:fs';
import { hex32 } from './murmur3.js';

export interface NameTable {
  keys: Map<number, string>;
  enums: Map<number, string>;
}

export interface NamesFile {
  revision?: string;
  createdAt?: string;
  keys: Record<string, string>; // "0x1234ABCD": "Flag.Name"
  enums: Record<string, string>;
}

export const emptyNames = (): NameTable => ({ keys: new Map(), enums: new Map() });

export function loadNames(file: string): NameTable {
  if (!fs.existsSync(file)) return emptyNames();
  const j = JSON.parse(fs.readFileSync(file, 'utf8')) as NamesFile;
  const conv = (o: Record<string, string> = {}) => new Map(Object.entries(o).map(([k, v]) => [parseInt(k, 16) >>> 0, v]));
  return { keys: conv(j.keys), enums: conv(j.enums) };
}

export function saveNames(file: string, t: NameTable, revision?: string) {
  const obj = (m: Map<number, string>) => Object.fromEntries([...m].sort((a, b) => a[0] - b[0]).map(([k, v]) => [hex32(k), v]));
  const out: NamesFile = { revision, createdAt: new Date().toISOString(), keys: obj(t.keys), enums: obj(t.enums) };
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
}
