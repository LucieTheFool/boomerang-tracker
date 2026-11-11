import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseGameData } from '../src/gamedata/parser.js';
import { Tracker, ChecklistFile, MappingFile } from '../src/core/tracker.js';
import { regionsForArea } from '../src/core/areas.js';

const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const tracker = new Tracker(read('data/checklist.json') as ChecklistFile, read('data/save-mapping.json') as MappingFile);
const slot = (n: string) => `fixtures/save/slot_${n}/progress.sav`;
const have = fs.existsSync(slot('05')) && fs.existsSync(slot('02'));

describe.skipIf(!have)('Tracker on real saves', () => {
  it('reads the summary for slot_05', () => {
    const { summary, categories } = tracker.evaluate(parseGameData(fs.readFileSync(slot('05'))));
    expect(summary.hearts).toBe(7);
    expect(summary.heartPiecesHeld).toBe(3);
    expect(summary.tokens).toBe(15);
    expect(summary.claimable.map(c => c.reward)).toEqual(["Adult's Wallet"]);
    expect(categories.find(c => c.id === 'heart_pieces')!.hint).toMatch(/3 pieces in total/);
    expect(summary.totalA).toBeGreaterThan(250);
  });

  it('flags Prelude of Light as just collected between slot_02 and slot_03', () => {
    const before = parseGameData(fs.readFileSync(slot('02')));
    const after = parseGameData(fs.readFileSync(slot('03')));
    const { categories } = tracker.evaluate(after, {}, before);
    const just = categories.flatMap(c => c.items.filter(i => i.justCollected).map(i => i.name));
    expect(just).toEqual(['Prelude of Light']);
    const rep = tracker.describeChanges(before, after, 'slot_03');
    expect(rep.known.some(r => r.entries?.some(e => e.includes('Prelude of Light')))).toBe(true);
  });

  it('counts manual ticks and labels them', () => {
    const g = parseGameData(fs.readFileSync(slot('05')));
    const id = 'heart_pieces.004'; // a chest heart piece, not detectable from the save yet
    const base = tracker.evaluate(g).summary.doneA;
    const { categories, summary } = tracker.evaluate(g, { [id]: true });
    const item = categories.flatMap(c => c.items).find(i => i.id === id)!;
    expect(item.manual).toBe(true);
    expect(item.done).toBe(true);
    expect(summary.doneA).toBe(base + 1);
  });
});

// Bug 2026-11-11: winning Talon's Lon Lon bottle also ticked the Cucco Lady bottle.
const lonlon = 'fixtures/regression/2026-11-11-after-lonlon-bottle.sav';
describe.skipIf(!fs.existsSync(lonlon))('regression: bottles', () => {
  it('Talon\'s bottle does not tick the Cucco Lady bottle', () => {
    const { categories } = tracker.evaluate(parseGameData(fs.readFileSync(lonlon)));
    const bottles = categories.find(c => c.id === 'bottles')!.items;
    expect(bottles.filter(b => b.done).map(b => b.number)).toEqual([3]);
  });
});

describe('area matching', () => {
  it('maps save area names to checklist regions', () => {
    expect(regionsForArea('Market/Market_Child', [])).toEqual(['Hyrule Castle Town']);
    expect(regionsForArea('GoronCity', ['Goron City', 'Graveyard'])).toEqual(['Goron City']);
    expect(regionsForArea(undefined, ['Goron City'])).toEqual([]);
  });
});
