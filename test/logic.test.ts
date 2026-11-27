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
  it("reaches Ganon's Castle with the Shadow and Spirit medallions, not with the four other medallions", () => {
    const ms = 'IsGet.Weapon_Sword_Master';
    const reachesGanon = (flags: string[]) => new Logic(logic, fakeSave(flags)).reachable('adult').has("Ganon's Castle");
    expect(reachesGanon([ms, 'IsGet.Item_Medal_Shadow', 'IsGet.Item_Medal_Spirit'])).toBe(true);
    expect(reachesGanon([ms, 'IsGet.Item_Medal_Forest', 'IsGet.Item_Medal_Fire', 'IsGet.Item_Medal_Water', 'IsGet.Item_Medal_Light'])).toBe(false);
    expect(reachesGanon([ms])).toBe(false);
  });
  it('needs the previous mask sold before the next one', () => {
    const withKeaton = (stock: number): GameDataFile => {
      const g = fakeSave(['IsGet.Armor_Child_Mask_Keaton', 'IsGet.Item_ZeldaLetter']);
      const h = murmur3('PouchData.Armor_Child_Mask_Keaton.StockNum');
      g.entries.set(h, { hash: h, type: 'Int', value: stock, recordOffset: 0 });
      return g;
    };
    expect(statusOf(withKeaton(0))('masks#2').missing).not.toContain('Keaton Mask sold');
    expect(statusOf(withKeaton(1))('masks#2').missing).toContain('Keaton Mask sold');
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

describe('Logic.distances', () => {
  it('returns empty map for unknown or unresolved from region', () => {
    const L = new Logic(logic, fakeSave());
    expect(L.distances('child', 'UnknownPlace')).toEqual(new Map());
    expect(L.distances('child', undefined)).toEqual(new Map());
  });

  it('calculates BFS distances on a minimal example', () => {
    const mini: LogicFile = {
      start: { child: 'A', adult: 'A' },
      canBeAdult: 'false',
      items: { Key: { name: 'Have.Key' } },
      numbers: {},
      macros: {},
      regionAliases: {},
      regions: {
        A: { exits: { B: 'true', C: 'Key' } },
        B: { exits: { D: 'true' } },
        C: { exits: { D: 'true' } },
        D: { exits: {} },
      },
      warps: [],
      locations: {},
    };
    const L = new Logic(mini, fakeSave());
    const dist = L.distances('child', 'A');
    expect(dist.get('A')).toBe(0);
    expect(dist.get('B')).toBe(1);
    expect(dist.get('D')).toBe(2);
    expect(dist.has('C')).toBe(false); // needs Key
  });

  it('includes warp songs as 1-hop edges from anywhere', () => {
    const mini: LogicFile = {
      start: { child: 'A', adult: 'A' },
      canBeAdult: 'false',
      items: { Warp: { name: 'Have.Warp' } },
      numbers: {},
      macros: {},
      regionAliases: {},
      regions: {
        A: { exits: { B: 'true' } },
        B: { exits: { C: 'true' } },
        C: { exits: {} },
        Far: { exits: {} },
      },
      warps: [{ to: 'Far', needs: 'Warp' }],
      locations: {},
    };
    const withWarp = new Logic(mini, fakeSave(['Have.Warp']));
    const dist = withWarp.distances('child', 'A');
    expect(dist.get('A')).toBe(0);
    expect(dist.get('Far')).toBe(1); // 1 hop via warp
    expect(dist.get('B')).toBe(1);
    expect(dist.get('C')).toBe(2);

    const noWarp = new Logic(mini, fakeSave());
    const dist2 = noWarp.distances('child', 'A');
    expect(dist2.has('Far')).toBe(false);
  });

  it('Kokiri Forest to Lost Woods is 1 hop (real data sanity check)', () => {
    const afterDeku = ['HavePlayedEvent.Dm_Deku_BossOut'];
    const L = new Logic(logic, fakeSave(afterDeku));
    const dist = L.distances('child', 'Kokiri Forest');
    expect(dist.get('Kokiri Forest')).toBe(0);
    expect(dist.get('Lost Woods')).toBe(1);
  });
});

describe('Logic.nearestDistances', () => {
  it('picks the smaller of child/adult distances per region', () => {
    const mini: LogicFile = {
      start: { child: 'Start', adult: 'Start' },
      canBeAdult: 'MasterSword',
      items: { MasterSword: { name: 'IsGet.Weapon_Sword_Master' } },
      numbers: {},
      macros: {},
      regionAliases: {},
      regions: {
        Start: { exits: { Target: 'adult', A: 'true' } },
        A: { exits: { B: 'true', ChildOnly: 'true' } },
        B: { exits: { Target: 'true' } },
        Target: { exits: {} },
        ChildOnly: { exits: {} },
      },
      warps: [],
      locations: {},
    };
    const L = new Logic(mini, fakeSave(['IsGet.Weapon_Sword_Master']));
    const dist = L.nearestDistances('Start');
    expect(dist.get('Start')).toBe(0);
    expect(dist.get('Target')).toBe(1); // adult shortcut is 1, child route is 3
    expect(dist.get('ChildOnly')).toBe(2); // only reachable as child
  });
});

// Quest chains (2026-11-26): holding a quest object is not enough for the next
// step — the previous turn-in has to be recorded in the save.
describe('quest chains: held vs turned in', () => {
  type Field = [string, { type: 'Bool' | 'Int' | 'BoolArray'; value: boolean | number | boolean[] }];
  const save = (fields: Field[]): GameDataFile => ({
    version: 0, dataStart: 0, size: 0,
    entries: new Map(fields.map(([n, e]): [number, Entry] => [murmur3(n), { hash: murmur3(n), type: e.type, value: e.value, recordOffset: 0 }])),
    bool64: new Set(), warnings: [],
  });
  const b = (n: string, v: boolean = true): Field => [n, { type: 'Bool', value: v }];
  const i = (n: string, v: number): Field => [n, { type: 'Int', value: v }];
  const fence = (n: number): Field => [
    'MiniGame_CatchCucco_PutsInFence',
    { type: 'BoolArray', value: Array.from({ length: 7 }, (_, k) => k < n) },
  ];
  const statusOf = (g: GameDataFile) => (key: string) =>
    evaluateLogic(logic, g, rows).get(rows.find((r: { key: string; id: string }) => r.key === key)!.id)!;

  it('mask chain: holding the Keaton offers the sale; only selling it unlocks the Skull Mask', () => {
    const atHeld = statusOf(save([
      b('HavePlayedEvent.Dm_Deku_BossOut'),
      b('IsGet.Armor_Child_Mask_Keaton'),
      i('PouchData.Armor_Child_Mask_Keaton.StockNum', 1),
    ]));
    expect(atHeld('masks#6').ages).toContain('child'); // can sell it now
    expect(atHeld('masks#2').missing).toContain('Keaton Mask sold');

    const atSold = statusOf(save([
      b('HavePlayedEvent.Dm_Deku_BossOut'),
      b('IsGet.Armor_Child_Mask_Keaton'),
      i('PouchData.Armor_Child_Mask_Keaton.StockNum', 0),
    ]));
    expect(atSold('masks#6').ages).toEqual([]); // already turned in
    expect(atSold('masks#6').missing).toContain('Keaton Mask (in hand, can be turned in)');
    expect(atSold('masks#2').ages).toContain('child');
  });

  it('mask chain: selling the Bunny Hood waits for all three Spiritual Stones', () => {
    const hood: Field[] = [
      b('HavePlayedEvent.Dm_Deku_BossOut'),
      b('IsGet.Armor_Child_Mask_Bunny'),
      i('PouchData.Armor_Child_Mask_Bunny.StockNum', 1),
    ];
    const noStones = statusOf(save(hood));
    expect(noStones('masks#9').ages).toEqual([]);
    expect(noStones('masks#9').missing).toContain('all three Spiritual Stones');

    const stones = statusOf(save([
      ...hood,
      b('IsGet.Item_Stone_Forest'), b('IsGet.Item_Stone_Fire'), b('IsGet.Item_Stone_Water'),
    ]));
    expect(stones('masks#9').ages).toContain('child');
  });

  it('cucco chain: six returned leaves the Cucco Lady bottle gated; the seventh unlocks it', () => {
    const atSix = statusOf(save([b('HavePlayedEvent.Dm_Deku_BossOut'), b('MiniGame_CatchCucco_IsCompleted', false), fence(6)]));
    expect(atSix('bottles#7').ages).toContain('child'); // can still bring them back
    expect(atSix('bottles#2').missing).toContain('All seven Cuccos returned');

    const atSeven = statusOf(save([b('HavePlayedEvent.Dm_Deku_BossOut'), b('MiniGame_CatchCucco_IsCompleted', false), fence(7)]));
    expect(atSeven('bottles#2').ages).toContain('child');
  });

  it('Ruto letter chain: holding the letter offers showing it; showing it (or finishing Jabu-Jabu) unlocks King Zora\'s bottle', () => {
    const base: Field[] = [
      b('HavePlayedEvent.Dm_Deku_BossOut'), b('IsGet.Item_Ocarina_Fairy'), b('IsGet.Item_Melody_ZeldaLullaby'),
      b('IsGet.Item_Scale_Silver'), b('Get_StoneOfWater_GetRutoLetter'),
    ];
    const held = statusOf(save(base));
    expect(held('bottles#6').ages).toContain('child'); // can show it now
    expect(held('bottles#4').missing).toContain('Ruto\'s Letter shown');

    const shown = statusOf(save([...base, b('Get_StoneOfWater_TalkedZoraAboutRutoLetter')]));
    expect(shown('bottles#4').ages).toContain('child');

    // the talk flag stays false on the real saves; the Jabu-Jabu event says the same thing
    const viaJabu = statusOf(save([...base, b('HavePlayedEvent.Get_StoneOfWater_JabuJabuEat')]));
    expect(viaJabu('bottles#4').ages).toContain('child');
  });

  it('Poe chain: bottled Poes reach the bottle at five sold; the collector waits for that', () => {
    const flags: Field[] = [
      b('IsGet.Weapon_Sword_Master'),
      i('Step_Get_Epona', murmur3('Complete')), b('IsGet.Item_Melody_EponaSong'), b('IsGet.Item_Ocarina_Fairy'),
      b('IsGet.Weapon_Range_Bow'),
      i('PouchData.BottleA.StockNum', 1),
      i('PouchData.BottleB.StockNum', 0), i('PouchData.BottleC.StockNum', 0),
      i('PouchData.BottleD.StockNum', 0), i('PouchData.BottleE.StockNum', 0),
    ];
    const three = statusOf(save([...flags, i('GhostShop_CouponNum', 300)]));
    expect(three('bottles#8').ages).toContain('adult'); // can sell the next Poes
    expect(three('bottles#5').missing).toContain('Five Big Poes sold');

    const five = statusOf(save([...flags, i('GhostShop_CouponNum', 500)]));
    expect(five('bottles#5').ages).toContain('adult');
  });
});

// Maps and compasses (dungeon_items#1..#20, part C): the chests sit inside the
// dungeon, before the boss — so each pair is gated only on the items beyond entry
// that reach its chest (region reach already covers entry), never on a *Done macro.
// The Great Deku Tree pair is entry only: the 2026-11-10 snapshots show the map
// picked up before the Slingshot. The unsure entries are remake floors taken from
// walkthroughs; confirm them with the docs/maps-compasses.md runbook.
describe('maps and compasses', () => {
  const save = (flags: string[], bottles = 0): GameDataFile => {
    const entries = new Map<number, Entry>();
    for (const n of flags) { const h = murmur3(n); entries.set(h, { hash: h, type: 'Bool', value: true, recordOffset: 0 }); }
    for (const [k, v] of [['PouchData.BottleA.StockNum', bottles], ['PouchData.BottleB.StockNum', 0], ['PouchData.BottleC.StockNum', 0], ['PouchData.BottleD.StockNum', 0], ['PouchData.BottleE.StockNum', 0]] as const) {
      entries.set(murmur3(k), { hash: murmur3(k), type: 'Int', value: v, recordOffset: 0 });
    }
    return { version: 0, dataStart: 0, size: 0, entries, bool64: new Set(), warnings: [] };
  };

  it('offers the Deku Tree map and compass at entry, child', () => {
    const atEntry = statusOf(fakeSave(['IsGet.Weapon_Sword_Kokiri', 'IsGet.Weapon_Shield_Deku']));
    expect(atEntry('dungeon_items#1').ages).toEqual(['child']);
    expect(atEntry('dungeon_items#2').ages).toEqual(['child']);
    expect(statusOf(fakeSave())('dungeon_items#1').ages).toEqual([]);
  });

  it("offers Dodongo's Cavern map and compass at entry with explosives, without beating the boss", () => {
    const dekuClear = ['HavePlayedEvent.Dm_Deku_BossOut', 'IsGet.Item_ZeldaLetter'];
    const inCavern = statusOf(save([...dekuClear, 'IsGet.Armor_Child_Gauntlet_Goron', 'IsGet.Item_BombBag_Small']));
    expect(inCavern('dungeon_items#3').ages).toEqual(['child']);
    expect(inCavern('dungeon_items#4').ages).toEqual(['child']);
    expect(statusOf(save([...dekuClear, 'IsGet.Armor_Child_Gauntlet_Goron', 'IsGet.Weapon_Range_SlingShot']))('dungeon_items#3').ages).toEqual([]);
    expect(statusOf(save([...dekuClear, 'IsGet.Armor_Child_Gauntlet_Goron']))('dungeon_items#3').ages).toEqual([]);
  });

  it('offers Jabu-Jabu map and compass at entry, but only with the Boomerang', () => {
    const atFountain = ['HavePlayedEvent.Dm_Deku_BossOut', 'IsGet.Item_Scale_Silver',
      'IsGet.Item_Ocarina_Fairy', 'IsGet.Item_Melody_ZeldaLullaby', 'IsGet.Item_Bottle_Letter'];
    const without = statusOf(save([...atFountain, 'IsGet.Weapon_Range_SlingShot'], 1));
    expect(without('dungeon_items#5').ages).toEqual([]);
    expect(without('dungeon_items#6').ages).toEqual([]);
    const withBoomerang = statusOf(save([...atFountain, 'IsGet.Item_Boomerang'], 1));
    expect(withBoomerang('dungeon_items#5').ages).toEqual(['child']);
    expect(withBoomerang('dungeon_items#6').ages).toEqual(['child']);
  });

  it('offers the Forest Temple map at entry and the compass once the Bow is held, without beating the boss', () => {
    const base = ['IsGet.Weapon_Sword_Master', 'IsGet.Item_Hookshot', 'IsGet.Item_Melody_ForestMinuet'];
    expect(statusOf(save(base))('dungeon_items#7').ages).toEqual(['adult']);
    expect(statusOf(save(base))('dungeon_items#8').ages).toEqual([]);
    expect(statusOf(save([...base, 'IsGet.Weapon_Range_Bow']))('dungeon_items#8').ages).toEqual(['adult']);
  });

  it('offers the Fire Temple map at entry and the compass once the Bow is held, without beating the boss', () => {
    const base = ['IsGet.Weapon_Sword_Master', 'IsGet.Armor_Adult_Goron', 'IsGet.Item_Hookshot', 'IsGet.Item_BombBag_Small'];
    expect(statusOf(save(base))('dungeon_items#9').ages).toEqual(['adult']);
    expect(statusOf(save(base))('dungeon_items#10').ages).toEqual([]);
    expect(statusOf(save([...base, 'IsGet.Weapon_Range_Bow']))('dungeon_items#10').ages).toEqual(['adult']);
  });

  it('offers the Water Temple map with the lullaby and the compass with explosives, without beating the boss', () => {
    const gear = ['IsGet.Weapon_Sword_Master', 'IsGet.Item_Hookshot', 'IsGet.Armor_Adult_HeavyBoot',
      'IsGet.Armor_Adult_Zora', 'IsGet.Item_Ocarina_Fairy', 'IsGet.Item_Melody_ZeldaLullaby'];
    expect(statusOf(save(gear))('dungeon_items#11').ages).toEqual(['adult']);
    expect(statusOf(save(gear))('dungeon_items#12').ages).toEqual([]);
    expect(statusOf(save([...gear, 'IsGet.Item_BombBag_Small']))('dungeon_items#12').ages).toEqual(['adult']);
    expect(statusOf(save(gear.filter((f) => f !== 'IsGet.Item_Melody_ZeldaLullaby')))('dungeon_items#11').ages).toEqual([]);
  });

  it('offers the Shadow Temple map with Hookshot and Lens, the compass also with explosives, without beating the boss', () => {
    const base = ['IsGet.Weapon_Sword_Master', 'IsGet.Item_Ocarina_Fairy', 'IsGet.Item_Melody_ShadowNocturne',
      'IsGet.Item_DinFire', 'IsGet.Item_Hookshot', 'IsGet.Armor_GlassTruth'];
    const withMagic = (extra: string[]) => {
      const g = save([...base, ...extra]);
      g.entries.set(murmur3('PlayerStatus.MPMax'), { hash: murmur3('PlayerStatus.MPMax'), type: 'Int', value: 3, recordOffset: 0 });
      return g;
    };
    expect(statusOf(withMagic([]))('dungeon_items#13').ages).toEqual(['adult']);
    expect(statusOf(withMagic([]))('dungeon_items#14').ages).toEqual([]);
    expect(statusOf(withMagic(['IsGet.Item_BombBag_Small']))('dungeon_items#14').ages).toEqual(['adult']);
  });

  it('offers the Spirit Temple compass with the adult-side gear and the map with Deku Sticks, without beating the boss', () => {
    const base = ['IsGet.Weapon_Sword_Master', 'IsGet.Item_Token_Gerudo', 'IsGet.Item_Longshot',
      'IsGet.Armor_Adult_Gauntlet_Silver', 'IsGet.Item_BombBag_Small', 'IsGet.Item_Ocarina_Fairy', 'IsGet.Item_Melody_ZeldaLullaby'];
    expect(statusOf(save(base))('dungeon_items#16').ages).toEqual(['adult']);
    expect(statusOf(save(base.filter((f) => f !== 'IsGet.Item_BombBag_Small')))('dungeon_items#16').ages).toEqual([]);
    expect(statusOf(save(base))('dungeon_items#15').ages).toEqual([]);
    expect(statusOf(save([...base, 'IsGet.Item_DekuStick']))('dungeon_items#15').ages).toEqual(['adult']);
  });
});

// Audit method (docs/logic-audit.md): a save can only show a map or compass the game
// let you have — so no fixture save may have one set that the logic says was ungettable.
describe.skipIf(!fs.existsSync('fixtures'))('map and compass logic vs fixture saves', () => {
  const collect = (dir: string): string[] => {
    let out: string[] = [];
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      out = out.concat(e.isDirectory() ? collect(p) : [p]);
    }
    return out;
  };
  const saves = [...collect('fixtures/regression'), ...collect('fixtures/snapshots'), ...collect('fixtures/save')].filter(p => p.endsWith('.sav'));
  const mapping = JSON.parse(fs.readFileSync('data/save-mapping.json', 'utf8'));
  it('every set map or compass flag was gettable', () => {
    const bad: string[] = [];
    for (const f of saves) {
      let g: GameDataFile;
      try { g = parseGameData(fs.readFileSync(f)); } catch { continue; }
      const st = evaluateLogic(logic, g, rows);
      for (const r of rows) {
        if (!r.key.startsWith('dungeon_items#') || Number(r.key.split('#')[1]) > 20) continue;
        const rule = mapping.entries[r.id]?.detect;
        if (rule && evaluate(rule, g) === 'yes' && st.get(r.id)!.ages.length === 0) bad.push(`${f} ${r.key}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
