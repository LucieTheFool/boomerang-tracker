import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseGameData } from '../src/gamedata/parser.js';
import { evaluate, evaluateCounter, Rule, CounterRule, ruleKeys } from '../src/gamedata/detect.js';
import { cleanName, slug } from '../scripts/build-checklist.js';

const mapping = JSON.parse(fs.readFileSync('data/save-mapping.json', 'utf8')) as {
  entries: Record<string, { label: string; detect: Rule | null; confidence: string; evidence: string }>;
  counters: Record<string, CounterRule & { confidence: string; evidence: string }>;
};
const checklist = JSON.parse(fs.readFileSync('data/checklist.json', 'utf8')) as {
  categories: { id: string; kind: string; items: { id: string }[] }[];
};
const fixture = path.resolve('fixtures/save/slot_05/progress.sav');

describe('checklist.json', () => {
  it('has the expected Part A totals', () => {
    const n = (id: string) => checklist.categories.find(c => c.id === id)!.items.length;
    expect([n('heart_pieces'), n('heart_containers'), n('gold_skulltulas'), n('songs'), n('equipment'), n('items'), n('masks'),
      n('bottles'), n('great_fairies'), n('capacity'), n('stones_medallions'), n('dungeons'), n('bosses'), n('mini_bosses'), n('side_quests')])
      .toEqual([36, 8, 100, 13, 12, 27, 5, 5, 6, 14, 9, 12, 10, 10, 6]);
  });
  it('cleans doubled alt-text names', () => {
    expect(cleanName('Kokiri Sword Kokiri Sword')).toBe('Kokiri Sword');
    expect(cleanName('Heart Container (Gohma Gohma)')).toBe('Heart Container (Gohma)');
    expect(cleanName("Zelda's Lullaby")).toBe("Zelda's Lullaby");
    expect(slug("Lord Jabu-Jabu's Belly")).toBe('lord_jabu_jabus_belly');
  });
});

describe('save-mapping.json', () => {
  const ids = new Set(checklist.categories.flatMap(c => c.items.map(i => i.id)));

  it('only maps ids that exist in the checklist', () => {
    expect(Object.keys(mapping.entries).filter(id => !ids.has(id))).toEqual([]);
    const counterCats = checklist.categories.filter(c => c.kind === 'counter').map(c => c.id);
    expect(Object.keys(mapping.counters).filter(id => !counterCats.includes(id))).toEqual([]);
  });

  it('every entry has a confidence level and evidence (unmapped ones say why)', () => {
    for (const [id, e] of Object.entries(mapping.entries)) {
      expect(['confirmed', 'likely', 'guess'], id).toContain(e.confidence);
      expect(e.evidence, id).toBeTruthy();
    }
  });

  it.skipIf(!fs.existsSync(fixture))('every rule reads keys that exist in a real save', () => {
    const g = parseGameData(fs.readFileSync(fixture));
    const bad = Object.entries(mapping.entries).filter(([, e]) => e.detect && evaluate(e.detect, g) === 'unknown').map(([id]) => id);
    expect(bad).toEqual([]);
    for (const [id, c] of Object.entries(mapping.counters)) expect(evaluateCounter(c, g), id).not.toBeNull();
  });

  it('matches enum values by name', () => {
    expect(ruleKeys({ any: [{ name: 'IsGet.Item_Hookshot' }, { b64: '0x3F93661D8E17C1D0' }] }).size).toBe(2);
  });
});
