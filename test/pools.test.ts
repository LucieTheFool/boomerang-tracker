import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { applyLearned, findPools, findIdentifications, MapEntry } from '../src/core/pools.js';
import { parseGameData } from '../src/gamedata/parser.js';
import { Tracker, ChecklistFile, MappingFile } from '../src/core/tracker.js';

const F = ['0x0000000000000010', '0x0000000000000020', '0x0000000000000030'];
const pooled = (n: number): MapEntry => ({ label: `row ${n}`, detect: { count: F.map(b64 => ({ b64 })), gte: n }, confidence: 'guess', evidence: 'pool' });
const entries: Record<string, MapEntry> = { a: pooled(1), b: pooled(2), c: pooled(3), x: { label: 'x', detect: { name: 'Foo' }, confidence: 'likely', evidence: '' } };
const order = ['a', 'b', 'c', 'x'];
const describeRow = (id: string) => ({ number: order.indexOf(id) + 1, name: id, category: 'Gold Skulltulas', chapter: 'Fire Temple' });

describe('pools', () => {
  it('finds rows that share flags', () => {
    expect(findPools(entries, order)).toEqual([{ key: F.join(','), flags: F, rows: ['a', 'b', 'c'] }]);
  });

  it('asks which row a new flag belongs to', () => {
    const { ask, auto } = findIdentifications(findPools(entries, order), new Set([F[1]]), describeRow);
    expect(auto).toEqual([]);
    expect(ask).toHaveLength(1);
    expect(ask[0].pick).toBe(1);
    expect(ask[0].candidates.map(c => c.id)).toEqual(['a', 'b', 'c']);
    expect(ask[0].area).toBe('Fire Temple');
  });

  it('applies an answer and shrinks the pool', () => {
    const { entries: out, pools } = applyLearned(entries, order, [{ flags: [F[1]], items: ['c'] }]);
    expect(out.c.detect).toEqual({ b64: F[1] });
    expect(out.c.confidence).toBe('confirmed');
    expect(pools[0].rows).toEqual(['a', 'b']);
    expect(pools[0].flags).toEqual([F[0], F[2]]);
    expect(out.a.detect).toEqual({ count: [{ b64: F[0] }, { b64: F[2] }], gte: 1 });
  });

  it('identifies the last one by elimination', () => {
    const { entries: out, pools } = applyLearned(entries, order, [{ flags: [F[0]], items: ['a'] }, { flags: [F[1]], items: ['b'] }]);
    expect(out.c.detect).toEqual({ b64: F[2] });
    expect(pools).toEqual([]);
  });

  it('answers by itself when every remaining row was collected at once', () => {
    const { pools } = applyLearned(entries, order, [{ flags: [F[0]], items: ['a'] }]);
    const { ask, auto } = findIdentifications(pools, new Set([F[1], F[2]]), describeRow);
    expect(ask).toEqual([]);
    expect(auto).toEqual([{ flags: [F[1], F[2]], items: ['b', 'c'] }]);
  });
});

// End to end on a real save: pretend a Fire Temple Skulltula was just collected.
const snapDir = 'fixtures/snapshots/';
const snap = fs.existsSync(snapDir) ? fs.readdirSync(snapDir).find(f => f.includes('After-Great-Deku')) : undefined;
describe.skipIf(!snap)('identify flow on a real save', () => {
  it('asks about the Fire Temple rows, then confirms the answer', () => {
    const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
    const tracker = new Tracker(read('data/checklist.json') as ChecklistFile, read('data/save-mapping.json') as MappingFile);
    const before = parseGameData(fs.readFileSync(snapDir + snap));
    const fire = tracker.pools.find(p => p.rows.some(r => r.startsWith('gold_skulltulas.055')))!;
    expect(fire.rows).toHaveLength(5);

    const after = parseGameData(fs.readFileSync(snapDir + snap));
    after.bool64.add(BigInt(fire.flags[2]));
    const { ask } = tracker.identifications(before, after);
    expect(ask).toHaveLength(1);
    expect(ask[0].candidates.map(c => c.number)).toEqual([55, 56, 57, 58, 59]);

    // Before answering: one Fire Temple tile is ticked by count (the first in the group).
    const gs = (t: Tracker, g: typeof after) => t.evaluate(g).categories.find(c => c.id === 'gold_skulltulas')!;
    expect(gs(tracker, after).done).toBe(2);
    // The user says it was #57.
    tracker.setLearned([{ flags: [ask[0].flags[0]], items: [ask[0].candidates[2].id] }]);
    const item = gs(tracker, after).items.find(i => i.number === 57)!;
    expect(item.done).toBe(true);
    expect(item.confidence).toBe('confirmed');
    expect(gs(tracker, after).items.filter(i => i.chapter === 'Fire Temple' && i.done).map(i => i.number)).toEqual([57]);
  });
});
