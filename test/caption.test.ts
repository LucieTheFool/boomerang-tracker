import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { readCaption } from '../src/gamedata/caption.js';
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
const captions = findSaves(ROOT).filter(f => path.basename(f) === 'caption.sav');

// verified 2026-11-18 vs Longshot reference save, see docs/longshot-crossref.md
const HASHES: Record<string, number> = {
  'CaptionData.BancScenePath': 0x0cccc6cd, 'CaptionData.LocationName': 0xf74e0e8e,
  'CaptionData.Date.Year': 0x9811a3f7, 'CaptionData.Date.Month': 0xdfd840d3, 'CaptionData.Date.Day': 0xbd46f485,
  'CaptionData.Date.Hour': 0x23f3d75e, 'CaptionData.Date.Minute': 0x27853bf7, 'CaptionData.Date.Second': 0x5ee50bed,
  'CaptionData.Life': 0x1e55ecc5, 'CaptionData.MaxLife': 0x74bd05d0, 'CaptionData.MP': 0x19f26b6a,
  'CaptionData.MPMax': 0x943f8ec3, 'CaptionData.CurrentRupee': 0xa9557547, 'CaptionData.GoldToken': 0xdc941483,
  'CaptionData.Pos': 0x8b26618e, 'CaptionData.Dir': 0xaccbda17, 'CaptionData.SerialNumber': 0x51c58419,
  'CaptionData.IsAutoSave': 0x25f03caa, 'CaptionData.IsClear': 0xc72044fc, 'CaptionData.IsDefenseUP': 0xe8bd6759,
  'CaptionData.IsEnableUseAmiibo': 0x7c5b03dc, 'CaptionData.ScreenShot': 0x63696a32,
  'CaptionData.Item.Item_Melody_ZeldaLullaby': 0x238ae327, 'CaptionData.Item.Item_Melody_EponaSong': 0x91288adc,
  'CaptionData.Item.Item_Melody_SariaSong': 0x0f941212, 'CaptionData.Item.Item_Melody_SunSong': 0xfb2b5f6b,
  'CaptionData.Item.Item_Melody_TimeSong': 0x380a5616, 'CaptionData.Item.Item_Melody_StormSong': 0xab6b5962,
  'CaptionData.Item.Item_Melody_ForestMinuet': 0x99b50b91, 'CaptionData.Item.Item_Melody_FireBolero': 0x17464eb8,
  'CaptionData.Item.Item_Melody_WaterSerenade': 0x85f5194d, 'CaptionData.Item.Item_Melody_ShadowNocturne': 0x574aef59,
  'CaptionData.Item.Item_Melody_SpiritRequiem': 0x83254520, 'CaptionData.Item.Item_Melody_LightPrelude': 0xf9d63fd4,
  'CaptionData.Item.Item_Melody_ScarecrowSong': 0x2f793671,
  'CaptionData.Item.Item_Medal_Fire': 0x10dc0608, 'CaptionData.Item.Item_Medal_Forest': 0x75bd1ecf,
  'CaptionData.Item.Item_Medal_Water': 0xe1ca50c6, 'CaptionData.Item.Item_Medal_Shadow': 0x89ae7032,
  'CaptionData.Item.Item_Medal_Spirit': 0xba6a1b74, 'CaptionData.Item.Item_Medal_Light': 0x059ce596,
  'CaptionData.Item.Item_Stone_Fire': 0x50c6bedf, 'CaptionData.Item.Item_Stone_Forest': 0xfb112756,
  'CaptionData.Item.Item_Stone_Water': 0x2f61ab71,
};

describe('caption key hashes', () => {
  it.each(Object.entries(HASHES))('%s', (name, hash) => {
    expect(murmur3(name)).toBe(hash);
  });
});

type Rec = [string, number]; // [key name, inline value]

/** Minimal GameData container: Bool, Int, Float inline; Vector3 + String64 in the data area. */
function buildCaption(o: { bools: Rec[]; ints: Rec[]; floats: Rec[]; pos: [number, number, number]; strings: [string, string][] }): Buffer {
  const h = (n: string) => murmur3(n);
  const recs: [number, number][] = [];
  for (const [n, v] of o.bools) recs.push([h(n), v]);
  recs.push([0, 2]);
  for (const [n, v] of o.ints) recs.push([h(n), v >>> 0]);
  recs.push([0, 4]);
  for (const [n, v] of o.floats) { const b = Buffer.alloc(4); b.writeFloatLE(v); recs.push([h(n), b.readUInt32LE(0)]); }
  recs.push([0, 10]);
  const vecIdx = recs.length;
  recs.push([h('CaptionData.Pos'), 0]);
  recs.push([0, 16]);
  const strIdx = recs.length;
  for (const [n] of o.strings) recs.push([h(n), 0]);

  const dataStart = 0x28 + recs.length * 8;
  const head = Buffer.alloc(dataStart);
  head.writeUInt32LE(0x01020304, 0);
  head.writeUInt32LE(0x002d80eb, 4);
  head.writeUInt32LE(dataStart, 8);
  const vec = Buffer.alloc(12);
  o.pos.forEach((v, i) => vec.writeFloatLE(v, i * 4));
  const strs = o.strings.map(([, s]) => { const b = Buffer.alloc(64); b.write(s); return b; });
  recs[vecIdx][1] = dataStart;
  strs.forEach((_, i) => { recs[strIdx + i][1] = dataStart + 12 + i * 64; });
  recs.forEach(([a, v], i) => { head.writeUInt32LE(a, 0x28 + i * 8); head.writeUInt32LE(v, 0x28 + i * 8 + 4); });
  return Buffer.concat([head, vec, ...strs]);
}

describe('readCaption (synthetic)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caption-'));
  const C = (n: string) => `CaptionData.${n}`;
  const file = path.join(dir, 'caption.sav');
  fs.writeFileSync(file, buildCaption({
    bools: [
      [C('IsAutoSave'), 0],
      [C('Item.Item_Melody_ZeldaLullaby'), 1], [C('Item.Item_Melody_EponaSong'), 1], [C('Item.Item_Melody_SunSong'), 0],
      [C('Item.Item_Medal_Fire'), 1], [C('Item.Item_Medal_Water'), 0], [C('Item.Item_Stone_Fire'), 0],
    ],
    ints: [
      [C('Date.Year'), 2026], [C('Date.Month'), 11], [C('Date.Day'), 17], [C('Date.Hour'), 18],
      [C('Date.Minute'), 23], [C('Date.Second'), 45], [C('Life'), 12], [C('MaxLife'), 20],
      [C('MP'), 8], [C('MPMax'), 16], [C('CurrentRupee'), 250], [C('GoldToken'), 3],
    ],
    floats: [[C('Dir'), -71.5]],
    pos: [-46.5, 118.25, 15.5],
    strings: [[C('BancScenePath'), 'Market/Market_Child'], [C('LocationName'), 'Market']],
  }));

  it('reads every field by key', () => {
    expect(readCaption(file)).toEqual({
      area: 'Market/Market_Child',
      location: 'Market',
      date: { year: 2026, month: 11, day: 17, hour: 18, minute: 23, second: 45 },
      pos: { x: -46.5, y: 118.25, z: 15.5 },
      dir: -71.5,
      life: 12, maxLife: 20, mp: 8, mpMax: 16, rupees: 250, goldTokens: 3,
      isAutoSave: false,
      songs: ['ZeldaLullaby', 'EponaSong'],
      medals: ['Fire'],
      stones: [],
    });
  });

  it('returns null for a missing file', () => {
    expect(readCaption(path.join(dir, 'nope.sav'))).toBeNull();
  });

  it('returns null for wrong magic', () => {
    const bad = path.join(dir, 'bad.sav');
    const b = fs.readFileSync(file);
    b.writeUInt32LE(0xdeadbeef, 0);
    fs.writeFileSync(bad, b);
    expect(readCaption(bad)).toBeNull();
  });
});

describe.skipIf(captions.length === 0)('readCaption on fixtures', () => {
  it.each(captions.map(f => [path.relative(ROOT, f), f]))('%s', (_rel, f) => {
    const c = readCaption(f)!;
    expect(c).not.toBeNull();
    expect(c.area).toBeTruthy();
    expect(c.area).toContain('/');
    const d = c.date!;
    expect(d.year).toBeGreaterThanOrEqual(2000); expect(d.year).toBeLessThanOrEqual(2100);
    expect(d.month).toBeGreaterThanOrEqual(1); expect(d.month).toBeLessThanOrEqual(12);
    expect(d.day).toBeGreaterThanOrEqual(1); expect(d.day).toBeLessThanOrEqual(31);
    expect(d.hour).toBeGreaterThanOrEqual(0); expect(d.hour).toBeLessThanOrEqual(23);
    expect(d.minute).toBeGreaterThanOrEqual(0); expect(d.minute).toBeLessThanOrEqual(59);
    expect(d.second).toBeGreaterThanOrEqual(0); expect(d.second).toBeLessThanOrEqual(60);
    const songs = ['ZeldaLullaby', 'EponaSong', 'SariaSong', 'SunSong', 'TimeSong', 'StormSong', 'ForestMinuet',
      'FireBolero', 'WaterSerenade', 'ShadowNocturne', 'SpiritRequiem', 'LightPrelude', 'ScarecrowSong'];
    const medals = ['Fire', 'Forest', 'Water', 'Shadow', 'Spirit', 'Light'];
    const stones = ['Fire', 'Forest', 'Water'];
    for (const s of c.songs) expect(songs).toContain(s);
    for (const m of c.medals) expect(medals).toContain(m);
    for (const s of c.stones) expect(stones).toContain(s);
  });
});
