import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseGameData, MAGIC } from '../src/gamedata/parser.js';
import { diffGameData, stable } from '../src/gamedata/diff.js';
import { murmur3 } from '../src/gamedata/murmur3.js';

// Fixtures are the user's own saves, copied locally and never committed.
const ROOT = path.resolve('fixtures');
function findSaves(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? findSaves(p) : e.name.endsWith('.sav') ? [p] : [];
  });
}
const saves = findSaves(ROOT);
const progress = saves.filter(f => path.basename(f) === 'progress.sav');

describe('murmur3', () => {
  it('matches hashes from the game', () => {
    expect(murmur3('AttackByWeapon')).toBe(0xb58c29c3);
    expect(murmur3('HorizontalSlash')).toBe(0xa1389237);
  });
});

describe.skipIf(saves.length === 0)('GameData parser on fixtures', () => {
  it.each(saves.map(f => [path.relative(ROOT, f), f]))('%s decodes cleanly', (_rel, f) => {
    const buf = fs.readFileSync(f);
    expect(buf.readUInt32LE(0)).toBe(MAGIC);
    const g = parseGameData(buf);
    expect(g.warnings).toEqual([]);
    expect(g.entries.size).toBeGreaterThan(0);
  });

  it.each(progress.map(f => [path.relative(ROOT, f), f]))('%s has the expected shape', (_rel, f) => {
    const g = parseGameData(fs.readFileSync(f));
    expect(g.version).toBe(0x002d80eb);
    expect(g.dataStart).toBe(0x175d8);
    expect(g.entries.size).toBe(11925);
    const counts: Record<string, number> = {};
    for (const e of g.entries.values()) counts[e.type] = (counts[e.type] ?? 0) + 1;
    expect(counts.Bool).toBe(10212);
    expect(counts.Int).toBe(1144);
  });

  it('gives the same output every run', () => {
    for (const f of saves) {
      const buf = fs.readFileSync(f);
      const a = parseGameData(buf);
      const b = parseGameData(Buffer.from(buf));
      expect(stable([...a.entries.values()])).toBe(stable([...b.entries.values()]));
      expect([...a.bool64]).toEqual([...b.bool64]);
      expect(diffGameData(a, b)).toEqual([]);
    }
  });

  it('rejects a file with the wrong magic', () => {
    const buf = Buffer.from(fs.readFileSync(progress[0]));
    buf.writeUInt32LE(0xdeadbeef, 0);
    expect(() => parseGameData(buf)).toThrow(/magic/);
  });

  it('rejects a truncated file', () => {
    const buf = fs.readFileSync(progress[0]).subarray(0, 0x1000);
    expect(() => parseGameData(buf)).toThrow();
  });
});
