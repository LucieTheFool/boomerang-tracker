import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { withCounterSpots, type ChecklistFile } from '../src/core/tracker.js';

const pub = JSON.parse(fs.readFileSync('data/checklist.json', 'utf8')) as ChecklistFile;
const cat = (id: string, kind: 'list' | 'counter', items: ChecklistFile['categories'][number]['items']): ChecklistFile['categories'][number] =>
  ({ id, label: id, part: 'B', countsToward100: true, kind, items });
const row = (id: string, n: number) => ({ id, number: n, name: `Row ${n}`, iconId: 'bean' });

describe('withCounterSpots', () => {
  it('the public checklist carries the ten Magic Bean spots', () => {
    const beans = pub.categories.find(c => c.id === 'magic_beans_planted')!;
    expect(beans.items.map(i => i.id)).toEqual(Array.from({ length: 10 }, (_, i) => `magic_beans_planted.${String(i + 1).padStart(3, '0')}`));
  });

  it('fills an empty counter in a stale local checklist from the public one', () => {
    const local: ChecklistFile = { categories: [cat('magic_beans_planted', 'counter', [])] };
    const out = withCounterSpots(local, pub);
    expect(out.categories[0].items).toHaveLength(10);
    expect(out.categories[0].items[9].name).toMatch(/Desert Colossus/);
  });

  it('keeps local spots and leaves list categories alone', () => {
    const mine = [row('big_poes.001', 1)];
    const p: ChecklistFile = { categories: [cat('big_poes', 'counter', [row('big_poes.001', 1), row('big_poes.002', 2)]), cat('songs', 'list', [row('songs.a', 1)])] };
    const out = withCounterSpots({ categories: [cat('big_poes', 'counter', mine), cat('songs', 'list', [])] }, p);
    expect(out.categories[0].items).toBe(mine);
    expect(out.categories[1].items).toEqual([]);
  });
});
