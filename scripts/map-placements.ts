// Fills in the Gold Skulltula and Heart Piece entries of data/save-mapping.json from
// local/placements.json (built by scripts/extract-placements.ts from the user's RomFS).
// Only 64-bit flag ids and area names end up in the mapping; no game files.
//   npx tsx scripts/map-placements.ts
//
// How the save stores them (confirmed by diff on 2026-11-10):
// - Gold Skulltula: 64-bit flag = the placement id (plus id^2), set when the token is taken.
// - Heart piece lying in the world: 64-bit flag = the placement id.
// - Event/minigame heart pieces: the game's HeartPieceAnchor names the bool flag.
// - Chest heart pieces: chest-open flags are NOT the chest's id; still needs diffs.
import fs from 'node:fs';

type Rule = Record<string, unknown>;
interface Entry { label: string; detect: Rule | null; confidence: 'confirmed' | 'likely' | 'guess'; evidence: string }
interface Placement { id: string; kind: string; gyaml: string; folder: string; maps: string[]; room?: number; pos: number[]; attrs: Record<string, unknown> }
interface Row { id: string; number: number; name: string; chapter: string }

const placements: Placement[] = JSON.parse(fs.readFileSync('local/placements.json', 'utf8'));
const checklist = JSON.parse(fs.readFileSync('data/checklist.json', 'utf8'));
const mapping = JSON.parse(fs.readFileSync('data/save-mapping.json', 'utf8')) as { entries: Record<string, Entry> };
const rowsOf = (cat: string): Row[] => checklist.categories.find((c: { id: string }) => c.id === cat).items;

// Level-file folder -> checklist regions it contains.
const FOLDER_REGIONS: Record<string, string[]> = {
  InsideTheDekuTree: ['Great Deku Tree'], Market: ['Hyrule Castle Town'], HyruleCastle: ['Hyrule Castle'],
  GanonCastle: ["Hyrule Castle (outside Ganon's Castle)"], KakarikoVillage: ['Kakariko Village'], Graveyard: ['Graveyard'],
  HyruleField: ['Hyrule Field', 'Hyrule Field (near Gerudo Valley)', 'Lon Lon Ranch', 'Lake Hylia', 'Lake Hylia (Lakeside Laboratory)'],
  GerudoValley: ['Gerudo Valley'], KokiriForest: ['Kokiri Forest'], LostWood: ['Lost Woods'], DeathMountainTrail: ['Death Mountain Trail'],
  DodongoCavern: ["Dodongo's Cavern"], DeathMountainCrater: ['Death Mountain Crater'], GoronCity: ['Goron City'], ZoraRiver: ["Zora's River"],
  ZoraFountain: ["Zora's Fountain"], InsideJabuJabuBelly: ["Lord Jabu-Jabu's Belly"], SacredForestMeadow: ['Sacred Forest Meadow'],
  ForestTemple: ['Forest Temple'], FireTemple: ['Fire Temple'], ZoraDomain: ["Zora's Domain"], IceCavern: ['Ice Cavern'], WaterTemple: ['Water Temple'],
  BottomOfTheWell: ['Bottom of the Well'], ShadowTemple: ['Shadow Temple'], GerudoFortress: ['Gerudo Fortress'],
  HountedWasteland: ['Haunted Wasteland (Mirage Desert)'], DesertColossus: ['Desert Colossus'], SpiritTemple: ['Spirit Temple'],
};
const flag = (p: Placement): Rule => ({ b64: p.id });
const set = (row: Row, detect: Rule | null, confidence: Entry['confidence'], evidence: string) => {
  mapping.entries[row.id] = { label: row.name, detect, confidence, evidence };
};

/** Map one area: confirmed pairs first, then one-to-one matches, then a pool for the rest. */
function assignGroup(rows: Row[], actors: Placement[], what: string, area: string, extraMatch: { rowTest: (r: Row) => boolean; actorTest: (p: Placement) => boolean; why: string }[], confirmed: Record<number, string> = {}) {
  let R = [...rows];
  let A = [...actors];
  for (const [num, id] of Object.entries(confirmed)) {
    const r = R.find(x => x.number === Number(num));
    const a = A.find(x => x.id === id);
    if (r && a) { set(r, flag(a), 'confirmed', existing.entries[r.id]?.confidence === 'confirmed' ? existing.entries[r.id].evidence : `Diff on 2026-11-10: collecting it set 64-bit flag ${a.id} (its placement id in ${a.folder})`); R = R.filter(x => x !== r); A = A.filter(x => x !== a); }
  }
  for (const m of extraMatch) {
    const r2 = R.filter(m.rowTest);
    const a2 = A.filter(m.actorTest);
    if (r2.length === 1 && a2.length === 1) {
      set(r2[0], flag(a2[0]), 'likely', `${m.why}: the only one in ${area} (placement ${a2[0].id})`);
      R = R.filter(x => x !== r2[0]); A = A.filter(x => x !== a2[0]);
    } else if (r2.length && r2.length === a2.length) {
      pool(r2, a2, `${m.why} (${r2.length} in ${area})`);
      R = R.filter(x => !r2.includes(x)); A = A.filter(x => !a2.includes(x));
    }
  }
  if (R.length === 1 && A.length === 1) set(R[0], flag(A[0]), 'likely', `The only ${what} left in ${area} after the matches above (placement ${A[0].id})`);
  else if (R.length && R.length === A.length) pool(R, A, `${R.length} ${what}s in ${area}`);
  else if (R.length || A.length) console.warn(`  ! ${area}: ${R.length} rows vs ${A.length} placements left unmapped`);
}

/** Confirmed row<->flag pairs already in the mapping file (e.g. exported from the tracker); kept on regenerate. */
const existing = JSON.parse(fs.readFileSync('data/save-mapping.json', 'utf8')) as { entries: Record<string, Entry> };
function confirmedIn(rows: Row[], actors: Placement[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const r of rows) {
    const e = existing.entries[r.id];
    const b = e?.confidence === 'confirmed' && e.detect && 'b64' in e.detect ? String(e.detect.b64) : null;
    if (b && actors.some(a => a.id === b)) out[r.number] = b;
  }
  return out;
}

function pool(rows: Row[], actors: Placement[], why: string) {
  const flags = actors.map(flag);
  rows.forEach((r, i) => set(r, { count: flags, gte: i + 1 }, 'guess',
    `${why}. The count for this group is exact, but which tile is which isn't known yet: tiles fill in order as the count goes up. One before/after snapshot per spot pins it down.`));
}

// ---------------- Gold Skulltulas ----------------
const gsRows = rowsOf('gold_skulltulas');
const gsActors = placements.filter(p => p.kind === 'gold_skulltula');
// Checklist rows whose Skulltula appears from a soft-soil (bean) patch. Listed by number
// because the public checklist has no descriptions to search.
const SOIL_ROWS = new Set([11, 14, 15, 17, 18, 19, 20, 28, 54, 88]);
const soil = { rowTest: (r: Row) => SOIL_ROWS.has(r.number), actorTest: (p: Placement) => !!p.attrs.IsMagicBeanSoil, why: 'Soft-soil Skulltula (placement has IsMagicBeanSoil)' };
for (const [folder, regions] of Object.entries(FOLDER_REGIONS)) {
  const rows = gsRows.filter(r => regions.includes(r.chapter));
  const actors = gsActors.filter(a => a.folder === folder);
  if (!rows.length && !actors.length) continue;
  assignGroup(rows, actors, 'Gold Skulltula', regions.join(' / '), [soil], { ...(folder === 'InsideTheDekuTree' ? { 1: '0xBCE05898CE61F1C0' } : {}) as Record<number, string>, ...confirmedIn(rows, actors) });
}

// ---------------- Heart Pieces ----------------
const hpRows = rowsOf('heart_pieces');
const anchors = placements.filter(p => p.kind === 'heart_piece_anchor');
const pieces = placements.filter(p => p.kind === 'heart_piece');
const byNum = (n: number) => hpRows.find(r => r.number === n)!;

// Event pieces: the anchor names the flag. Row numbers from the checklist.
const EVENT_ROWS: Record<string, number> = {
  Npc_Hylia_001_IsGetHeartPiece: 1, GraveYard_DiggingHoleTour_Drop_HeartPiece: 2, MiniGame_Fishing_GetHeartPiece: 6,
  SubEvent_FindRichard_GetHeartPiece: 7, Minigame_SkullKidSession_IsGetHeartPiece: 8, Npc_SkullKid_Child_IsGetHeartPiece: 9,
  GoronLargePot_IsGetHeartPiece: 10, MiniGame_BombchuBowling_ClearThirdTime: 13, KakarikoVillage_IsAfterSave_Npc_Hylia_025: 20,
  Npc_Hylia_045_HasDived: 22, MiniGame_FrogTenors_StormSong: 27, MiniGame_FrogTenors_InsectRepellent: 28,
  MiniGame_ChoiceTreasure_IsClear: 29, MiniGame_HorsebackArchery_GotaHeart: 31,
  HyruleField_Enemy_Scrub_Business_HeartPiece_01: 34, DeathMountain_Enemy_Scrub_Business_HeartPiece_01: 36,
};
for (const a of anchors) {
  const p = a.attrs.HeartPieceAnchor_GameDataPath as string | undefined;
  if (!p) continue;
  const n = EVENT_ROWS[p];
  if (!n) { console.warn(`  ! anchor flag ${p} not assigned to a row`); continue; }
  const rule: Rule = n === 20
    ? { any: [{ name: p }, { name: 'KakarikoVillage_GatheringTokenGold_GetReward50' }] }
    : { name: p };
  set(byNum(n), rule, 'likely', `The game's own heart-piece map marker (HeartPieceAnchor in ${a.folder}) names this flag: ${p}${n === 20 ? '; also accepts the 50-token reward flag' : ''}`);
}

// Pieces lying in the world: a heart-piece placement sits on the anchor; its id is the flag.
const WORLD_ROWS: Record<string, number[]> = {
  DeathMountainCrater: [11, 24], DeathMountainTrail: [23], DesertColossus: [32], GerudoValley: [5], Graveyard: [17],
  HyruleField: [3, 21], KakarikoVillage: [12, 18], ZoraFountain: [25, 26], ZoraRiver: [14, 15],
};
for (const [folder, nums] of Object.entries(WORLD_ROWS)) {
  const rows = nums.map(byNum);
  const actors = pieces.filter(p => p.folder === folder);
  assignGroup(rows, actors, 'world heart piece', folder, [], confirmedIn(rows, actors));
}

// Chest pieces: the anchor marks the chest, but chest-open flags aren't the chest id.
for (const n of [4, 16, 30, 33, 35]) {
  const r = byNum(n);
  if (!mapping.entries[r.id]?.detect) set(r, null, 'guess', 'Chest heart piece. The game marks it (HeartPieceAnchor type 1 next to a chest), but chests store their "opened" flag under a different key than their placement id. Needs one before/after snapshot.');
}
// Dampé's race keeps its named flag.
set(byNum(19), { name: 'UnderTheGrave_DampeRace_HeartGeted' }, 'likely', 'Flag name from game files: UnderTheGrave_DampeRace_HeartGeted');

fs.writeFileSync('data/save-mapping.json', JSON.stringify(mapping, null, 2) + '\n');
const count = (cat: string) => rowsOf(cat).map(r => mapping.entries[r.id]).reduce((acc, e) => { const k = e?.detect ? e.confidence : 'unmapped'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {} as Record<string, number>);
console.log('Gold Skulltulas:', count('gold_skulltulas'));
console.log('Heart Pieces:   ', count('heart_pieces'));
