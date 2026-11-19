import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseGameData } from '../src/gamedata/parser.js';
import { Tracker, ChecklistFile, MappingFile, DescriptionsFile, applyDescriptions } from '../src/core/tracker.js';
import { regionsForArea } from '../src/core/areas.js';

const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const tracker = new Tracker(read('data/checklist.json') as ChecklistFile, read('data/save-mapping.json') as MappingFile);
const slot = (n: string) => `fixtures/save/slot_${n}/progress.sav`;
const have = fs.existsSync(slot('05')) && fs.existsSync(slot('02'));

describe.skipIf(!have)('Tracker on real saves', () => {
  it('passes Big Poe spots as unmapped display rows, outside items', () => {
    const { categories } = tracker.evaluate(parseGameData(fs.readFileSync(slot('05'))));
    const poes = categories.find(c => c.id === 'big_poes')!;
    expect(poes.items).toEqual([]);
    expect(poes.spots).toHaveLength(10);
    expect(poes.spots!.every(s => s.state === 'unmapped' && !s.done && s.chapter === 'Hyrule Field')).toBe(true);
    expect(categories.find(c => c.id === 'magic_beans_planted')!.spots).toBeUndefined();
  });

  it('reads the summary for slot_05', () => {
    const { summary, categories } = tracker.evaluate(parseGameData(fs.readFileSync(slot('05'))));
    expect(summary.hearts).toBe(7);
    expect(summary.heartPiecesHeld).toBe(3);
    expect(summary.tokens).toBe(15);
    expect(summary.claimable.map(c => c.reward)).toEqual(["Adult's Wallet"]);
    // All three pieces are matched to a spot, the Zora's Domain chest one by its chest-open flag.
    const hp = categories.find(c => c.id === 'heart_pieces')!;
    expect(hp.items.filter(i => i.done).map(i => i.number)).toEqual([12, 16, 18]);
    expect(hp.hint).toBeUndefined();
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

describe('Location descriptions', () => {
  const checklist = read('data/checklist.json') as ChecklistFile;
  const desc = read('data/descriptions.json') as DescriptionsFile;
  const rows = checklist.categories.flatMap(c => c.items);

  it('describes every checklist entry and nothing else', () => {
    const ids = new Set(rows.map(r => r.id));
    expect(rows.filter(r => !desc.rows[r.id]?.where).map(r => r.id)).toEqual([]);
    expect(Object.keys(desc.rows).filter(id => !ids.has(id))).toEqual([]);
  });

  it('names Skulltula and heart piece spots "<area>: <title>"', () => {
    const merged = applyDescriptions(checklist, desc).categories.flatMap(c => c.items);
    const gs = merged.find(r => r.id === 'gold_skulltulas.098')!;
    expect(gs.name).toBe(`${gs.chapter}: ${desc.rows['gold_skulltulas.098'].title}`);
    expect(gs.where).toBe(desc.rows['gold_skulltulas.098'].where);
    // Rows without a title keep their name.
    const song = merged.find(r => r.id === 'songs.zeldas_lullaby')!;
    expect(song.name).toBe("Zelda's Lullaby");
    expect(song.where).toBeTruthy();
    // Every located spot gets its own name.
    const located = merged.filter(r => /^(gold_skulltulas|heart_pieces)\./.test(r.id));
    expect(new Set(located.map(r => r.name)).size).toBe(located.length);
  });
});

describe('Room keys data', () => {
  const checklist = read('data/checklist.json') as ChecklistFile;
  const mapping = read('data/save-mapping.json') as MappingFile;
  const cat = checklist.categories.find(c => c.id === 'room_keys')!;

  it('is a Part C category excluded from 100% with every pickup mapped by name', () => {
    expect(cat.part).toBe('C');
    expect(cat.countsToward100).toBe(false);
    expect(cat.items.length).toBe(25);
    for (const it of cat.items) expect(mapping.entries[it.id]?.detect, it.id).toHaveProperty('name');
    expect(mapping.entries['room_keys.forest_temple_1'].detect).toEqual({ name: 'ForestTemple_Room00_GetSmallKey' });
  });
  it('leaves keys held unmapped for now', () => {
    expect(mapping.keys).toBeUndefined();
  });
});
