import { describe, it, expect } from 'vitest';
import { reachableSpots, reachableSpotsHere } from '../src/core/spots.js';
import type { ItemLogic, TrackedCategory, TrackedItem } from '../src/shared/types.js';

const reach = (region: string): ItemLogic => ({ region, ages: ['child'], missing: [], night: false, unsure: false });
const blocked = (region: string): ItemLogic => ({ region, ages: [], missing: [`reach ${region}`], night: false, unsure: false });

const spot = (n: number, chapter: string, done: boolean, logic?: ItemLogic): TrackedItem =>
  ({ id: `magic_beans_planted#${n}`, number: n, name: `${chapter}: Soft soil`, chapter, iconId: 'bean', state: done ? 'yes' : 'no', done, manual: false, logic });

const beans = (spots: TrackedItem[], extra: Partial<TrackedCategory> = {}): TrackedCategory =>
  ({ id: 'magic_beans_planted', label: 'Magic Beans', part: 'B', countsToward100: true, kind: 'counter', items: [], done: 0, total: 10, value: 0, max: 10, spots, ...extra });

const cats = [beans([
  spot(1, 'Kokiri Forest', true, reach('Kokiri Forest')),     // done
  spot(2, 'Desert Colossus', false, blocked('Desert Colossus')), // unreachable
  spot(3, 'Lake Hylia', false, reach('Lake Hylia')),           // reachable, here
  spot(4, 'Death Mountain Trail', false, reach('Death Mountain Trail')), // reachable, elsewhere
  spot(5, 'Graveyard', false),                                  // no logic entry
])];
const ids = (rows: { i: TrackedItem }[]) => rows.map(r => r.i.number);

describe('counter spots as reminders', () => {
  it('"Can get now" gets the reachable, not-done spots anywhere', () => {
    expect(ids(reachableSpots(cats))).toEqual([3, 4]);
  });
  it('"Remaining here" gets only the reachable spot in the current area', () => {
    expect(ids(reachableSpotsHere(cats, new Set(['Lake Hylia'])))).toEqual([3]);
    expect(ids(reachableSpotsHere(cats, new Set(['Desert Colossus'])))).toEqual([]);
    expect(ids(reachableSpotsHere(cats, new Set(['Kokiri Forest'])))).toEqual([]);
  });
  it('ignores counters that don\'t count toward 100%, and list categories', () => {
    expect(reachableSpots([beans(cats[0].spots!, { countsToward100: false })])).toEqual([]);
    expect(reachableSpots([beans(cats[0].spots!, { kind: 'list' })])).toEqual([]);
  });
  it('takes spots of any part', () => {
    expect(ids(reachableSpots([beans(cats[0].spots!, { part: 'C' })]))).toEqual([3, 4]);
  });
});
