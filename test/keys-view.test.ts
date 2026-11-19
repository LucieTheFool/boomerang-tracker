import { describe, it, expect } from 'vitest';
import { keysView } from '../src/renderer/view.js';
import type { TrackedCategory, TrackedItem } from '../src/shared/types.js';

const item = (id: string, chapter: string, done: boolean, iconId = 'small_key', state: TrackedItem['state'] = done ? 'yes' : 'no'): TrackedItem =>
  ({ id, number: 1, name: id, chapter, iconId, state, done, manual: false } as TrackedItem);
const cat = (id: string, items: TrackedItem[], countsToward100 = false): TrackedCategory =>
  ({ id, label: id, part: 'C', countsToward100, kind: 'list', items, done: items.filter(i => i.done).length, total: items.length });

const cats = [
  cat('room_keys', [
    item('a1', 'Forest Temple', true), item('a2', 'Forest Temple', true), item('a3', 'Forest Temple', false),
    item('b1', 'Fire Temple', false),
    item('c1', 'Water Temple', true, 'small_key', 'unmapped'),
  ]),
  cat('dungeon_items', [
    item('fk', 'Forest Temple', true, 'boss_key'), item('sk', 'Shadow Temple', false, 'boss_key'),
    item('dm', 'Fire Temple', true, 'dungeon_map'), item('dt', 'Great Deku Tree', true, 'compass'),
  ]),
];

describe('keysView', () => {
  it('shows mixed states with held not mapped yet', () => {
    const rows = keysView(cats);
    expect(rows.map(r => r.text)).toEqual([
      'Forest Temple — keys picked up 2/3 · keys held: not mapped yet · boss key ✓',
      'Fire Temple — keys picked up 0/1 · keys held: not mapped yet',
      'Shadow Temple — boss key ✗',
    ]);
  });
  it('hides dungeons without key data (and unmapped pickups)', () => {
    const names = keysView(cats).map(r => r.dungeon);
    expect(names).not.toContain('Water Temple');
    expect(names).not.toContain('Great Deku Tree');
    expect(keysView([])).toEqual([]);
  });
  it('uses held and max when the mapping provides them', () => {
    const [forest] = keysView(cats, { keys: { 'Forest Temple': { held: 1, max: 5 } } });
    expect(forest.text).toBe('Forest Temple — keys picked up 2/5 · keys held 1 · boss key ✓');
    const [unread] = keysView(cats, { keys: { 'Forest Temple': { held: null } } });
    expect(unread.text).toContain('keys held: unknown');
  });
  it('does not touch the 100% count: both source categories are Part C', () => {
    expect(cats.every(c => !c.countsToward100)).toBe(true);
    const before = JSON.stringify(cats);
    keysView(cats);
    expect(JSON.stringify(cats)).toBe(before);
  });
});
