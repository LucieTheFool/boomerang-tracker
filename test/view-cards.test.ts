import { describe, expect, it } from 'vitest';
import { buildCards } from '../src/renderer/view';
import type { TrackedCategory, TrackedItem } from '../src/shared/types';

const item = (cat: string, n: number): TrackedItem => ({
  id: `${cat}.${n}`, number: n, name: `${cat} ${n}`, iconId: '', state: 'no', manual: false, done: false,
});
const cat = (id: string, n: number): TrackedCategory => ({
  id, label: id, part: 'A', kind: 'list', countsToward100: true,
  items: Array.from({ length: n }, (_, i) => item(id, i + 1)),
  done: 0, total: n,
});
const cats = () => [
  cat('heart_containers', 4), cat('heart_pieces', 36),
  cat('equipment', 8), cat('key_items', 2), cat('masks', 14), cat('stones_medallions', 8),
  cat('bosses', 9), cat('mini_bosses', 9), cat('songs', 13),
];
const byId = () => new Map(buildCards(cats()).map(c => [c.id, c]));

describe('card splits (view.ts buildCards)', () => {
  it('hearts and pieces of heart are separate cards', () => {
    const m = byId();
    expect(m.has('hearts')).toBe(true);
    expect(m.has('heart_pieces')).toBe(true);
    expect(m.get('hearts')!.sections).toHaveLength(1);
    expect(m.get('hearts')!.sections[0].style).toBe('major');
    expect(m.get('heart_pieces')!.sections).toHaveLength(1);
    expect(m.get('heart_pieces')!.sections[0].style).toBe('numbered');
  });

  it('masks and stones & medallions are separate cards; key item stays with equipment', () => {
    const m = byId();
    expect(m.has('masks')).toBe(true);
    expect(m.has('stones_medallions')).toBe(true);
    expect(m.get('equipment')!.sections).toHaveLength(2); // equipment + key item only
  });

  it('mini-bosses are their own card', () => {
    const m = byId();
    expect(m.has('mini_bosses')).toBe(true);
    expect(m.get('bosses')!.sections).toHaveLength(1);
  });

  it('every checklist item is still displayed exactly once', () => {
    const cards = buildCards(cats());
    let items = 0;
    for (const c of cards) for (const s of c.sections) items += s.tiles.length;
    expect(items).toBe(4 + 36 + 8 + 2 + 14 + 8 + 9 + 9 + 13);
  });
});
