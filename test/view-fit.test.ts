import { describe, expect, it } from 'vitest';
import { FIT_MAX_COLS, fitCardWidth, Card, Section, TileModel } from '../src/renderer/view';
import type { TrackedItem } from '../src/shared/types';

const item = (n: number): TrackedItem => ({
  id: `i${n}`, number: n, name: `Item ${n}`, iconId: '', state: 'no', manual: false, done: false,
});
const tiles = (n: number): TileModel[] =>
  Array.from({ length: n }, (_, i) => ({ kind: 'single', key: `t${i}`, categoryId: 'c', item: item(i) }));
const section = (n: number, style?: 'major' | 'numbered'): Section =>
  style ? { tiles: tiles(n), style } : { tiles: tiles(n) };
const card = (sections: Section[]): Card =>
  ({ id: 'c', kind: 'list', label: 'C', colorCat: 'c', part: 'A', sections, done: 0, total: 0 });

describe('fitCardWidth (fit layout sizing)', () => {
  it('sizes a 14-tile card to four tile columns (294 px)', () => {
    // 4 * 62 + 3 * 6 + 2 * 14
    expect(fitCardWidth(card([section(14)]))).toBe(294);
  });

  it('sizes a 100-tile numbered card wider, at the 10-column cap (462 px)', () => {
    // 10 * 38 + 9 * 6 + 2 * 14
    expect(fitCardWidth(card([section(100, 'numbered')]))).toBe(462);
  });

  it('widens for a major-tile section (4 majors + 20 numbered = 342 px)', () => {
    // major row: 4 * 74 + 3 * 6 = 314 beats the numbered row 5 * 38 + 4 * 6 = 214
    expect(fitCardWidth(card([section(4, 'major'), section(20, 'numbered')]))).toBe(342);
  });

  it('caps long sections at the max columns (200 tiles = 702 px)', () => {
    // 10 * 62 + 9 * 6 + 2 * 14
    expect(fitCardWidth(card([section(200)]))).toBe(702);
    expect(FIT_MAX_COLS).toBe(10);
  });

  it('uses the widest section when they differ (3 majors + 60 normal = 566 px)', () => {
    // normal row at 8 columns: 8 * 62 + 7 * 6 = 538 beats majors 3 * 74 + 2 * 6 = 234
    expect(fitCardWidth(card([section(3, 'major'), section(60)]))).toBe(566);
  });

  it('never gets narrower than the 160 px floor (single tile, no sections)', () => {
    expect(fitCardWidth(card([section(1)]))).toBe(160);
    expect(fitCardWidth(card([]))).toBe(160);
  });
});
