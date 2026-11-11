// Reads romfs/GameData/GameDataList.Product.*.byml.zs from the user's install.
// It lists every save key by hash with its type, default and save file, plus the
// names of every enum value. It holds no key names.
import fs from 'node:fs';
import path from 'node:path';
import { parseByml, BymlValue } from './byml.js';
import { RomFs } from './romfs.js';
import { murmur3 } from './murmur3.js';

export interface GdlEntry {
  hash: number | bigint;
  type: string;
  saveFile: number; // index into saveFiles, -1 = not saved
  defaultValue?: unknown;
  enumValues?: string[];
  expr?: unknown[][];
}

export interface GameDataList {
  revision: string;
  saveFiles: string[];
  entries: Map<number | bigint, GdlEntry>;
  /** hash -> enum value name, for decoding Enum / EnumArray values */
  enumNames: Map<number, string>;
}

export function findGameDataList(romfsRoot: string): string | null {
  const dir = path.join(romfsRoot, 'GameData');
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).filter(n => /^GameDataList\.Product\.\d+\.byml\.zs$/.test(n)).sort().pop();
  return f ? path.join('GameData', f) : null;
}

export function loadGameDataList(romfsRoot: string): GameDataList {
  const rel = findGameDataList(romfsRoot);
  if (!rel) throw new Error(`No GameDataList found under ${romfsRoot}`);
  const rom = new RomFs(romfsRoot);
  const root = parseByml(rom.read(rel)) as Record<string, BymlValue>;
  const data = root.Data as Record<string, Record<string, BymlValue>[]>;
  const meta = root.MetaData as Record<string, BymlValue>;
  const entries = new Map<number | bigint, GdlEntry>();
  const enumNames = new Map<number, string>();
  for (const [type, list] of Object.entries(data)) {
    for (const e of list) {
      const hash = e.Hash as number | bigint;
      const raw = e.RawValues as string[] | undefined;
      if (raw) for (const n of raw) enumNames.set(murmur3(n), n);
      entries.set(hash, {
        hash, type,
        saveFile: (e.SaveFileIndex as number) ?? -1,
        defaultValue: e.DefaultValue,
        enumValues: raw,
        // BoolExp: list of [opcode, operand] pairs (operands are often key or enum hashes)
        expr: type === 'BoolExp' ? (e.Values as BymlValue[][]) : undefined,
      });
    }
  }
  return {
    revision: rel.match(/Product\.(\d+)/)?.[1] ?? '?',
    saveFiles: (meta.SaveDirectory as string[]) ?? [],
    entries, enumNames,
  };
}
