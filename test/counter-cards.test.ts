import { describe, it, expect } from 'vitest';
import { buildCards } from '../src/renderer/view.js';
import { symbolFor } from '../src/renderer/symbols.js';
import type { TrackedCategory, TrackedItem } from '../src/shared/types.js';

const spot = (n: number): TrackedItem =>
  ({ id: `big_poes.${String(n).padStart(3, '0')}`, number: n, name: `Spot ${n}`, chapter: 'Hyrule Field', iconId: 'big_poe', state: 'unmapped', manual: false, done: false });
const counter = (id: string, part: 'A' | 'B', value: number | null, spots?: TrackedItem[]): TrackedCategory =>
  ({ id, label: id, part, countsToward100: true, kind: 'counter', items: [], done: value ?? 0, total: 10, value, max: 10, ...(spots ? { spots } : {}) });

describe('counter cards', () => {
  const cards = buildCards([
    counter('big_poes', 'A', 3, Array.from({ length: 10 }, (_, i) => spot(i + 1))),
    counter('magic_beans_planted', 'B', 2),
  ]);
  const poes = cards.find(c => c.id === 'big_poes')!;
  const beans = cards.find(c => c.id === 'magic_beans_planted')!;

  it('keeps the Big Poe sold count and adds 10 unmapped location tiles', () => {
    expect(poes).toMatchObject({ kind: 'counter', value: 3, max: 10, done: 3, total: 10 });
    const tiles = poes.sections.flatMap(s => s.tiles);
    expect(tiles).toHaveLength(10);
    expect(tiles.map(t => (t.kind === 'single' ? t.item.name : ''))).toEqual(Array.from({ length: 10 }, (_, i) => `Spot ${i + 1}`));
    expect(tiles.every(t => t.kind === 'single' && t.categoryId === 'big_poes' && t.item.state === 'unmapped' && !t.item.done)).toBe(true);
  });

  it('leaves a counter without spots a plain counter', () => {
    expect(beans).toMatchObject({ kind: 'counter', value: 2, max: 10, sections: [] });
  });

  it('adds a Locations section when a counter has spots', () => {
    const withSpots = buildCards([
      counter('magic_beans_planted', 'B', 2, Array.from({ length: 12 }, (_, i) => ({ ...spot(i + 1), id: `magic_beans_planted.${String(i + 1).padStart(3, '0')}`, name: `Plot ${i + 1}`, iconId: 'bean' }))),
    ]).find(c => c.id === 'magic_beans_planted')!;
    expect(withSpots.sections.map(s => s.title)).toEqual(['Locations']);
    expect(withSpots.sections[0].tiles).toHaveLength(12);
    expect(withSpots.value).toBe(2);
  });

  it('gives every counter card its category symbol for the head', () => {
    expect(poes.symbol).toBe('poe');
    expect(beans.symbol).toBe('plantedBean');
  });

  it('draws bean spot tiles with the planted-bean symbol, not the bean item', () => {
    expect(symbolFor('magic_beans_planted', 'bean', "Zora's River (by the bean seller)")).toBe('plantedBean');
    expect(symbolFor('items', 'magic_bean', 'Magic Bean')).toBe('bean');
  });
});
