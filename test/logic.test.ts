import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { lintLogic, evaluateLogic, parseExpr, Logic, LogicFile } from '../src/core/logic.js';
import { parseGameData } from '../src/gamedata/parser.js';
import { evaluate } from '../src/gamedata/detect.js';

const logic = JSON.parse(fs.readFileSync('data/logic.json', 'utf8')) as LogicFile;
const checklist = JSON.parse(fs.readFileSync('data/checklist.json', 'utf8'));
const rows = checklist.categories.flatMap((c: { id: string; items: { id: string; number: number; chapter?: string }[] }) =>
  c.items.map(i => ({ id: i.id, key: `${c.id}#${i.number}`, chapter: i.chapter })));
const partA = checklist.categories.filter((c: { part: string; kind: string }) => c.part === 'A' && c.kind === 'list')
  .flatMap((c: { id: string; items: { number: number }[] }) => c.items.map(i => `${c.id}#${i.number}`));

describe('logic.json', () => {
  it('has no unknown names, regions or rows', () => {
    expect(lintLogic(logic, new Set(rows.map((r: { key: string }) => r.key)))).toEqual([]);
  });
  it('covers every Part A checklist row', () => {
    expect(partA.filter((k: string) => !logic.locations[k])).toEqual([]);
  });
  it('parses and/or with and binding tighter', () => {
    expect(parseExpr('child and A or adult and B')).toEqual({ op: 'or', args: [
      { op: 'and', args: [{ op: 'atom', name: 'child' }, { op: 'atom', name: 'A' }] },
      { op: 'and', args: [{ op: 'atom', name: 'adult' }, { op: 'atom', name: 'B' }] }] });
  });
});

const save = 'fixtures/regression/2026-11-11-after-lonlon-bottle.sav';
describe.skipIf(!fs.existsSync(save))('logic on a real save', () => {
  const g = parseGameData(fs.readFileSync(save));
  it('every item rule reads keys that exist in the save', () => {
    const bad = Object.entries(logic.items).filter(([, r]) => evaluate(r, g) === 'unknown').map(([k]) => k);
    expect(bad).toEqual([]);
  });
  it('gives sensible early-game answers', () => {
    const L = new Logic(logic, g);
    expect(L.reachable('child').has('Kokiri Forest')).toBe(true);
    const st = evaluateLogic(logic, g, rows);
    const byKey = (k: string) => st.get(rows.find((r: { key: string }) => r.key === k)!.id)!;
    expect(byKey('heart_containers#1').ages).toEqual(['child']); // Gohma: child with slingshot
    expect(byKey('items#9').ages).toEqual([]); // Hammer needs adult
  });
});
