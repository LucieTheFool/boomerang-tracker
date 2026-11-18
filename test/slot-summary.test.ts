import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { CaptionCache, captionTime, prettyArea, slotSummaryFromCaption } from '../src/main/slot-summary.js';
import { Controller } from '../src/main/controller.js';
import { SettingsStore } from '../src/main/settings.js';
import type { CaptionInfo } from '../src/gamedata/caption.js';
import { murmur3 } from '../src/gamedata/murmur3.js';

const DATE = { year: 2026, month: 11, day: 17, hour: 16, minute: 33, second: 42 };
const info = (extra: Partial<CaptionInfo> = {}): CaptionInfo => ({
  area: 'HyruleField/HyruleField_Child', location: 'HyruleField', date: DATE,
  life: 20, maxLife: 20, rupees: 999, goldTokens: 16, isAutoSave: true,
  songs: Array(12).fill('s'), medals: Array(6).fill('m'), stones: Array(3).fill('t'),
  ...extra,
});

describe('slotSummaryFromCaption', () => {
  it('maps a full caption', () => {
    expect(slotSummaryFromCaption('slot_03', 123, info())).toStrictEqual({
      name: 'slot_03', mtimeMs: 123, area: 'Hyrule Field (child)', age: 'child',
      hearts: 5, maxHearts: 5, savedAt: new Date(2026, 10, 17, 16, 33, 42).getTime(), autoSave: true,
      rupees: 999, tokens: 16, songs: 12, medals: 6, stones: 3,
    });
  });

  it('turns quarter hearts into hearts', () => {
    const s = slotSummaryFromCaption('slot_01', 1, info({ life: 19, maxLife: 20 }));
    expect([s.hearts, s.maxHearts]).toEqual([4.75, 5]);
    expect(slotSummaryFromCaption('slot_01', 1, info({ life: 0 })).hearts).toBe(0);
  });

  it('takes the age from the area suffix', () => {
    expect(slotSummaryFromCaption('slot_01', 1, info({ area: 'Market/Market_Adult' })).age).toBe('adult');
    expect(slotSummaryFromCaption('slot_01', 1, info({ area: 'Market/Market_Child' })).age).toBe('child');
    expect(slotSummaryFromCaption('slot_01', 1, info({ area: 'Dungeon/Forest' }))).not.toHaveProperty('age');
  });

  it('keeps a false auto-save flag', () => {
    expect(slotSummaryFromCaption('slot_01', 1, info({ isAutoSave: false })).autoSave).toBe(false);
  });

  it('leaves everything out without a caption', () => {
    expect(slotSummaryFromCaption('slot_01', 1, null)).toStrictEqual({ name: 'slot_01', mtimeMs: 1 });
  });

  it('still uses an area found another way', () => {
    expect(slotSummaryFromCaption('slot_01', 1, null, 'Market/Market_Adult'))
      .toStrictEqual({ name: 'slot_01', mtimeMs: 1, area: 'Market (adult)', age: 'adult' });
  });

  it('leaves out fields the caption lacks or has as nonsense', () => {
    const s = slotSummaryFromCaption('slot_01', 1, info({ area: undefined, date: undefined, life: undefined, maxLife: -4, rupees: -1, goldTokens: undefined, isAutoSave: undefined }));
    for (const k of ['area', 'age', 'savedAt', 'hearts', 'maxHearts', 'rupees', 'tokens', 'autoSave']) expect(s).not.toHaveProperty(k);
  });

  it('has no save time for an invalid date', () => {
    expect(slotSummaryFromCaption('slot_01', 1, info({ date: { ...DATE, month: 13 } }))).not.toHaveProperty('savedAt');
  });
});

describe('captionTime', () => {
  it('reads the date as local time', () => {
    expect(captionTime(DATE)).toBe(new Date(2026, 10, 17, 16, 33, 42).getTime());
  });

  it.each([
    ['month 13', { month: 13 }], ['month 0', { month: 0 }], ['day 0', { day: 0 }], ['Feb 30', { month: 2, day: 30 }],
    ['Feb 29 outside a leap year', { month: 2, day: 29 }], ['hour 24', { hour: 24 }], ['minute 60', { minute: 60 }],
    ['second 61', { second: 61 }], ['year 0', { year: 0 }], ['a fraction', { day: 1.5 }],
  ])('rejects %s', (_what, change) => {
    expect(captionTime({ ...DATE, ...change })).toBeUndefined();
  });

  it('accepts a leap day and a leap second', () => {
    expect(captionTime({ ...DATE, year: 2028, month: 2, day: 29 })).toBe(new Date(2028, 1, 29, 16, 33, 42).getTime());
    expect(captionTime({ ...DATE, second: 60 })).toBe(new Date(2026, 10, 17, 16, 34, 0).getTime());
  });

  it('has nothing for no date', () => {
    expect(captionTime(undefined)).toBeUndefined();
  });
});

it('prettyArea is unchanged', () => {
  expect(prettyArea('HyruleField_Child')).toBe('Hyrule Field (child)');
  expect(prettyArea('Market')).toBe('Market');
});

const dirs: string[] = [];
const tempDir = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'slot-summary-')); dirs.push(d); return d; };
afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('CaptionCache', () => {
  const setup = (content = 'caption') => {
    const file = path.join(tempDir(), 'caption.sav');
    fs.writeFileSync(file, content);
    fs.utimesSync(file, 1000, 1000);
    const read = vi.fn((_f: string): CaptionInfo | null => info());
    return { file, read, cache: new CaptionCache(read) };
  };

  it('reads once while path, mtime and size stay the same', () => {
    const { file, read, cache } = setup();
    const first = cache.get(file);
    expect(cache.get(file)).toBe(first);
    expect(first.rawArea).toBe('HyruleField/HyruleField_Child');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reads again when the mtime changes', () => {
    const { file, read, cache } = setup();
    cache.get(file);
    fs.utimesSync(file, 2000, 2000);
    cache.get(file);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('reads again when only the size changes', () => {
    const { file, read, cache } = setup();
    cache.get(file);
    fs.writeFileSync(file, 'a longer caption');
    fs.utimesSync(file, 1000, 1000);
    cache.get(file);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps files apart', () => {
    const { file, read, cache } = setup();
    const other = path.join(path.dirname(file), 'other.sav');
    fs.copyFileSync(file, other);
    fs.utimesSync(other, 1000, 1000);
    cache.get(file);
    cache.get(other);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('remembers an unreadable caption until it changes', () => {
    const { file, read, cache } = setup();
    read.mockReturnValue(null);
    expect(cache.get(file)).toEqual({ info: null });
    cache.get(file);
    expect(read).toHaveBeenCalledTimes(1);
    read.mockReturnValue(info());
    fs.utimesSync(file, 2000, 2000);
    expect(cache.get(file).info).not.toBeNull();
  });

  it('does not try to read a missing file', () => {
    const { file, read, cache } = setup();
    expect(cache.get(`${file}.missing`)).toEqual({ info: null });
    expect(read).not.toHaveBeenCalled();
  });

  it('reads again after being cleared', () => {
    const { file, read, cache } = setup();
    cache.get(file);
    cache.clear();
    cache.get(file);
    expect(read).toHaveBeenCalledTimes(2);
  });
});

/** Minimal GameData container with Bool, Int and String64 entries. */
function container(o: { bools?: [string, number][]; ints?: [string, number][]; strings?: [string, string][] }): Buffer {
  const strings = o.strings ?? [];
  const recs: [number, number][] = (o.bools ?? []).map(([n, v]) => [murmur3(n), v]);
  recs.push([0, 2]);
  for (const [n, v] of o.ints ?? []) recs.push([murmur3(n), v]);
  recs.push([0, 16]);
  const strAt = recs.length;
  for (const [n] of strings) recs.push([murmur3(n), 0]);
  const dataStart = 0x28 + recs.length * 8;
  const head = Buffer.alloc(dataStart);
  head.writeUInt32LE(0x01020304, 0);
  head.writeUInt32LE(0x002d80eb, 4);
  head.writeUInt32LE(dataStart, 8);
  strings.forEach((_, i) => { recs[strAt + i][1] = dataStart + i * 64; });
  recs.forEach(([a, v], i) => { head.writeUInt32LE(a, 0x28 + i * 8); head.writeUInt32LE(v, 0x2c + i * 8); });
  return Buffer.concat([head, ...strings.map(([, s]) => { const b = Buffer.alloc(64); b.write(s); return b; })]);
}

describe('Controller slot list', () => {
  const C = (n: string) => `CaptionData.${n}`;
  const caption = container({
    bools: [[C('IsAutoSave'), 1], [C('Item.Item_Melody_SunSong'), 1]],
    ints: [[C('Date.Year'), 2026], [C('Date.Month'), 11], [C('Date.Day'), 17], [C('Date.Hour'), 16], [C('Date.Minute'), 33], [C('Date.Second'), 42],
      [C('Life'), 19], [C('MaxLife'), 20], [C('CurrentRupee'), 999], [C('GoldToken'), 16]],
    strings: [[C('BancScenePath'), 'HyruleField/HyruleField_Child']],
  });

  async function start(slots: Record<string, Buffer | null>) {
    const root = tempDir();
    const user = path.join(root, 'user');
    for (const [name, cap] of Object.entries(slots)) {
      fs.mkdirSync(path.join(user, name), { recursive: true });
      fs.writeFileSync(path.join(user, name, 'progress.sav'), container({}));
      if (cap) fs.writeFileSync(path.join(user, name, 'caption.sav'), cap);
    }
    const c = new Controller({ appDir: process.cwd(), userData: root, snapshots: path.join(root, 'snaps'), version: 'test' }, new SettingsStore(path.join(root, 'settings.json')));
    await c.useFolder(user);
    return c;
  }
  const bySlot = (c: Controller, name: string) => c.state.slots.find(s => s.name === name)!;

  it('fills the slots from caption.sav', async () => {
    const c = await start({ slot_03: caption });
    c.stop();
    expect(bySlot(c, 'slot_03')).toMatchObject({
      area: 'Hyrule Field (child)', age: 'child', hearts: 4.75, maxHearts: 5, autoSave: true,
      savedAt: new Date(2026, 10, 17, 16, 33, 42).getTime(), rupees: 999, tokens: 16, songs: 1, medals: 0, stones: 0,
    });
  });

  it('keeps listing slots whose caption is missing or broken', async () => {
    const c = await start({ slot_01: caption, slot_02: null, slot_03: Buffer.from('not a save') });
    c.stop();
    expect(c.state.status).toBe('ok');
    expect(c.state.slots.map(s => s.name)).toEqual(['slot_01', 'slot_02', 'slot_03']);
    for (const name of ['slot_02', 'slot_03']) expect(Object.keys(bySlot(c, name)).sort()).toEqual(['mtimeMs', 'name']);
  });

  it('falls back to any area string in a caption without the usual keys', async () => {
    const c = await start({ slot_01: container({ strings: [['SomethingElse', 'Market/Market_Adult']] }) });
    c.stop();
    expect(bySlot(c, 'slot_01')).toMatchObject({ area: 'Market (adult)', age: 'adult' });
  });

  it('does not touch caption.sav on a refresh that changed nothing', async () => {
    const c = await start({ slot_01: caption, slot_02: container({ strings: [['SomethingElse', 'Market/Market_Adult']] }), slot_03: Buffer.from('not a save') });
    c.stop();
    const reads = vi.spyOn(fs, 'readFileSync');
    await c.refresh(false);
    expect(reads.mock.calls.filter(([f]) => String(f).endsWith('caption.sav'))).toEqual([]);
  });
});
