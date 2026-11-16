import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { lintLogic, evaluateLogic, parseExpr, missingLabel, Logic, LogicFile } from '../src/core/logic.js';
import { parseGameData, GameDataFile, Entry } from '../src/gamedata/parser.js';
import { murmur3 } from '../src/gamedata/murmur3.js';
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
  it('names missing requirements the way players know them', () => {
    expect(missingLabel(logic, 'Explosives')).toBe('Bombs or Bombchus');
    expect(missingLabel(logic, 'HookshotItem')).toBe('Hookshot');
    expect(missingLabel(logic, 'Tokens 50')).toBe('50 Gold Skulltula tokens');
    expect(missingLabel(logic, 'adult')).toBe('adult');
  });
  it('parses and/or with and binding tighter', () => {
    expect(parseExpr('child and A or adult and B')).toEqual({ op: 'or', args: [
      { op: 'and', args: [{ op: 'atom', name: 'child' }, { op: 'atom', name: 'A' }] },
      { op: 'and', args: [{ op: 'atom', name: 'adult' }, { op: 'atom', name: 'B' }] }] });
  });
});

// A made-up save holding only the flags given (everything else unset).
function fakeSave(flags: string[] = []): GameDataFile {
  const entries = new Map<number, Entry>();
  for (const n of flags) { const h = murmur3(n); entries.set(h, { hash: h, type: 'Bool', value: true, recordOffset: 0 }); }
  return { version: 0, dataStart: 0, size: 0, entries, bool64: new Set(), warnings: [] };
}
const statusOf = (g: GameDataFile) => {
  const st = evaluateLogic(logic, g, rows);
  return (k: string) => st.get(rows.find((r: { key: string }) => r.key === k)!.id)!;
};

describe('logic on a brand-new file', () => {
  it("can't leave the forest before the Deku Tree, by any route", () => {
    const reach = new Logic(logic, fakeSave()).reachable('child');
    for (const r of ['Hyrule Field', 'Goron City', "Zora's River", 'Kakariko Village', 'Lake Hylia', 'Hyrule Castle Town']) expect(reach.has(r)).toBe(false);
    expect(reach.has('Kokiri Forest')).toBe(true);
  });
  it('can after clearing it', () => {
    expect(new Logic(logic, fakeSave(['HavePlayedEvent.Dm_Deku_BossOut'])).reachable('child').has('Hyrule Field')).toBe(true);
  });
  it('needs something to kill a Gold Skulltula with', () => {
    const metZelda = 'IsGet.Item_ZeldaLetter';
    expect(statusOf(fakeSave([metZelda]))('gold_skulltulas#16').ages).toEqual([]);
    expect(statusOf(fakeSave([metZelda, 'IsGet.Weapon_Sword_Kokiri']))('gold_skulltulas#16').ages).toEqual(['child']);
  });
  it("keeps night-only child checks for after meeting Zelda (the remake's clock starts then)", () => {
    expect(statusOf(fakeSave(['IsGet.Weapon_Sword_Kokiri']))('gold_skulltulas#16').ages).toEqual([]);
    expect(statusOf(fakeSave(['IsGet.Weapon_Sword_Kokiri', 'IsGet.Item_Melody_ZeldaLullaby']))('gold_skulltulas#16').ages).toEqual(['child']);
  });
  it("needs Talon back at the ranch for Epona's Song and the milk bottle", () => {
    const out = ['HavePlayedEvent.Dm_Deku_BossOut', 'IsGet.Item_Ocarina_Fairy'];
    expect(statusOf(fakeSave(out))('songs#3').ages).toEqual([]);
    expect(statusOf(fakeSave(out))('bottles#3').ages).toEqual([]);
    expect(statusOf(fakeSave([...out, 'Talon_AfterWakeUp']))('songs#3').ages).toEqual(['child']);
    expect(statusOf(fakeSave([...out, 'Talon_AfterWakeUp']))('bottles#3').ages).toEqual(['child']);
  });
  describe('tiered upgrades: whichever place you do first gives the next tier', () => {
    const base = ['HavePlayedEvent.Dm_Deku_BossOut', 'IsGet.Weapon_Range_SlingShot'];
    it('offers the bigger seed bag first, not the biggest', () => {
      const s = statusOf(fakeSave(base));
      expect(s('capacity#7').ages).toEqual(['child']);
      expect(s('capacity#8').ages).toEqual([]);
      expect(s('capacity#8').missing).toEqual(['the first upgrade']);
    });
    it('after the Market gallery, the Lost Woods game gives the biggest', () => {
      const s = statusOf(fakeSave([...base, 'IsGet.Item_BulletBag_Medium']));
      expect(s('capacity#8').ages).toEqual(['child']);
      expect(s('capacity#8').region).toBe('Lost Woods');
    });
    it('after the Lost Woods game, the Market gallery gives the biggest', () => {
      const s = statusOf(fakeSave([...base, 'IsGet.Item_BulletBag_Medium', 'LostWood_HitTargetOfDekuScrub_FirstClear']));
      expect(s('capacity#8').ages).toEqual(['child']);
      expect(s('capacity#8').region).toBe('Hyrule Castle Town');
    });
    it('without a flag per place, only offers the next tier when an unused place must be open', () => {
      const mini: LogicFile = {
        start: { child: 'Home', adult: 'Home' }, canBeAdult: 'false', numbers: {}, macros: {}, regionAliases: {}, warps: [], locations: {},
        items: { Mid: { name: 'Have.Mid' }, Big: { name: 'Have.Big' }, Key: { name: 'Have.Key' } },
        regions: { Home: { exits: { Far: 'Key' } }, Far: { exits: {} } },
        progressive: { bag: { rows: ['capacity#7', 'capacity#8'], have: ['Mid', 'Big'], sources: [
          { name: 'home game', region: 'Home' }, { name: 'far game', region: 'Far' }] } },
      };
      const st = (flags: string[]) => { const m = evaluateLogic(mini, fakeSave(flags), rows); return (k: string) => m.get(rows.find((r: { key: string }) => r.key === k)!.id)!; };
      expect(st([])('capacity#7').ages).toEqual(['child']); // either place
      expect(st(['Have.Mid'])('capacity#8').ages).toEqual([]); // the open one may be the one used
      expect(st(['Have.Mid', 'Have.Key'])('capacity#8').ages).toEqual(['child']); // both open: one is unused
    });
  });
  it('with the letter and Zelda\'s Lullaby but no explosives: no crater, no river, no bracelet', () => {
    const flags = ['HavePlayedEvent.Dm_Deku_BossOut', 'IsGet.Item_Ocarina_Fairy', 'IsGet.Item_ZeldaLetter', 'IsGet.Item_Melody_ZeldaLullaby'];
    const g = fakeSave(flags);
    const L = new Logic(logic, g);
    const reach = L.reachable('child');
    expect(L.test('ZeldasLullaby', 'child')).toBe(true);
    expect(reach.has('Goron City')).toBe(true);
    for (const r of ['Death Mountain Crater', "Zora's River", "Zora's Domain"]) expect(reach.has(r)).toBe(false);
    expect(statusOf(g)('items#10').ages).toEqual([]); // Goron's Bracelet also needs Saria's Song
    expect(new Logic(logic, fakeSave([...flags, 'IsGet.Item_BombBag_Small'])).reachable('child').has("Zora's Domain")).toBe(true);
  });
  it('needs a way to stun the Lost Woods scrub before buying its upgrade', () => {
    expect(statusOf(fakeSave())('capacity#11').ages).toEqual([]);
    expect(statusOf(fakeSave(['IsGet.Weapon_Shield_Deku']))('capacity#11').ages).toEqual(['child']);
  });
});

const save = 'fixtures/regression/2026-11-11-after-lonlon-bottle.sav';
describe.skipIf(!fs.existsSync(save))('logic on a real save', () => {
  // The describe body still runs when skipped, so only read the save when it's there.
  const g = fs.existsSync(save) ? parseGameData(fs.readFileSync(save)) : ({} as GameDataFile);
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
