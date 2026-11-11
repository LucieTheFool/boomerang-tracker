// Converts docs/checklist-source.txt (markdown tables) into data/checklist.json.
//   npm run build-checklist
// The "detect" rules are NOT stored here; they live in data/save-mapping.json and are
// merged by id when the app loads. Re-running this script is safe.
import fs from 'node:fs';

const SRC = 'docs/checklist-source.txt';
const OUT = 'data/checklist.json'; // public
const LOCAL_OUT = 'data/checklist.local.json'; // detailed, gitignored; the app prefers it when present

/**
 * Public copy: keeps ids, numbers, item names and areas; drops descriptions,
 * requirements and notes that come from guide text. Gold Skulltula and heart
 * piece rows are named after their area, since their names are descriptions.
 */
function publicCopy(cats: Category[]): Category[] {
  return cats.map(c => ({
    ...c,
    note: undefined,
    items: c.items.map(it => {
      const located = c.id === 'gold_skulltulas' || c.id === 'heart_pieces';
      return {
        id: it.id,
        number: it.number,
        name: located ? (it.chapter ?? c.label) : it.name,
        chapter: it.chapter,
        newInRemake: it.newInRemake,
        iconId: located ? it.iconId : it.iconId,
        detect: null,
      };
    }),
  }));
}

type Part = 'A' | 'B' | 'C';
interface Item {
  id: string;
  number: number;
  name: string;
  chapter?: string; // region / dungeon, used for grouping
  region?: string;
  requirement?: string;
  details?: Record<string, string>;
  newInRemake?: boolean;
  iconId: string;
  detect: null;
}
interface Category {
  id: string;
  label: string;
  part: Part;
  countsToward100: boolean;
  kind: 'list' | 'counter';
  max?: number;
  note?: string;
  items: Item[];
}

// Section heading (without the "(n)" count) -> category settings.
const SECTIONS: Record<string, { id: string; label?: string; icon: string | ((name: string) => string); name?: (row: Record<string, string>) => string; chapter?: string; region?: string; req?: string }> = {
  'Heart Pieces': { id: 'heart_pieces', icon: 'heart_piece', name: r => r['Heart Piece'], region: 'Region', req: 'Requirement', chapter: 'Region' },
  'Heart Containers': { id: 'heart_containers', icon: 'heart_container', name: r => r['Heart Container'], region: 'Dungeon', chapter: 'Dungeon' },
  'Gold Skulltulas': { id: 'gold_skulltulas', icon: 'gold_skulltula', name: r => `${r.Region}: ${r.Location}`, region: 'Region', chapter: 'Region' },
  Songs: { id: 'songs', icon: n => slug(n), name: r => r.Song, region: 'Where you learn it' },
  Equipment: { id: 'equipment', icon: n => slug(n), name: r => r.Equipment, region: 'Where', req: 'Notes' },
  Items: { id: 'items', icon: n => slug(n), name: r => r.Item, region: 'Where', req: 'Notes' },
  'Key items': { id: 'key_items', label: 'Key Items', icon: n => slug(n), name: r => r['Key item'], region: 'Where' },
  Masks: { id: 'masks', icon: n => slug(n), name: r => r.Mask, req: 'How you get it' },
  Bottles: { id: 'bottles', icon: 'bottle', name: r => r.Bottle, region: 'Where' },
  'Great Fairy gifts': { id: 'great_fairies', label: 'Great Fairies', icon: 'great_fairy', name: r => `${r.Location}: ${r.Gift}`, region: 'Location', req: 'Offering' },
  'Capacity upgrades': { id: 'capacity', label: 'Capacity Upgrades', icon: n => slug(n), name: r => r.Upgrade, region: 'Where', req: 'Capacity' },
  'Spiritual Stones and Medallions': { id: 'stones_medallions', label: 'Stones & Medallions', icon: n => slug(n), name: r => r.Name, region: 'From' },
  'Dungeons cleared': { id: 'dungeons', label: 'Dungeons Cleared', icon: 'dungeon', name: r => r.Dungeon, req: 'Boss / final challenge' },
  'Bosses defeated': { id: 'bosses', label: 'Bosses', icon: 'boss', name: r => r.Boss, region: 'Where' },
  'Mini-bosses defeated': { id: 'mini_bosses', label: 'Mini-bosses', icon: 'mini_boss', name: r => r['Mini-boss'], region: 'Where' },
  'Side quests': { id: 'side_quests', label: 'Side Quests', icon: 'side_quest', name: r => r.Quest, req: 'Main reward' },
  'House of Skulltula rewards': { id: 'skulltula_rewards', label: 'House of Skulltula Rewards', icon: 'gold_skulltula', name: r => `${r.Tokens} tokens: ${r.Reward}` },
  'Child trading sequence': { id: 'child_trade', label: 'Child Trading Sequence', icon: n => slug(n), name: r => r.Item, req: 'From → To' },
  'Adult trading sequence': { id: 'adult_trade', label: 'Adult Trading Sequence', icon: n => slug(n), name: r => r.Item, req: 'Trade' },
};
// Sections without a table.
const COUNTERS: Record<string, { id: string; label: string; max: number; icon: string }> = {
  'Big Poes sold': { id: 'big_poes', label: 'Big Poes Sold', max: 10, icon: 'big_poe' },
  'Magic Bean soft-soil spots planted': { id: 'magic_beans_planted', label: 'Magic Bean Spots Planted', max: 10, icon: 'magic_bean' },
};

export function slug(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
}

/** Fix names doubled by image alt-text ("Kokiri Sword Kokiri Sword", "Heart Container (Gohma Gohma)"). */
export function cleanName(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim();
  const words = t.split(' ');
  for (let n = Math.floor(words.length / 2); n >= 1; n--) {
    if (words.length === 2 * n && words.slice(0, n).join(' ') === words.slice(n).join(' ')) { t = words.slice(0, n).join(' '); break; }
  }
  t = t.replace(/\(([^()]+?) \1\)/g, '($1)'); // "(Gohma Gohma)" -> "(Gohma)"
  return t;
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}

function parse(text: string) {
  const lines = text.split(/\r?\n/);
  const cats: Category[] = [];
  let part: Part = 'A';
  let section: string | null = null;
  let declared: number | null = null;
  let cur: Category | null = null;
  let header: string[] | null = null;
  let paragraph: string[] = [];
  const declaredCounts: Record<string, number> = {};

  const flushNote = () => {
    if (cur && paragraph.length && !cur.note) cur.note = paragraph.join(' ').trim();
    paragraph = [];
  };

  for (const line of lines) {
    const partM = line.match(/^# PART ([ABC])/);
    if (partM) { part = partM[1] as Part; cur = null; continue; }
    if (/^# (Corrections|Sources)/.test(line)) { cur = null; section = null; continue; }
    const h = line.match(/^## (.+?)(?: \((\d+)\))?\s*$/);
    if (h) {
      flushNote();
      section = h[1].trim();
      declared = h[2] ? +h[2] : null;
      header = null;
      cur = null;
      const sec = SECTIONS[section];
      const ctr = COUNTERS[section];
      if (sec) {
        cur = { id: sec.id, label: sec.label ?? section, part, countsToward100: part === 'A', kind: 'list', items: [] };
        cats.push(cur);
        if (declared !== null) declaredCounts[sec.id] = declared;
      } else if (ctr) {
        cur = { id: ctr.id, label: ctr.label, part, countsToward100: part === 'A', kind: 'counter', max: ctr.max, items: [] };
        cats.push(cur);
      }
      continue;
    }
    if (!cur || !section) continue;
    if (line.startsWith('|')) {
      flushNote();
      const cells = splitRow(line);
      if (!header) { header = cells; continue; }
      if (cells.every(c => /^-+$/.test(c))) continue;
      const sec = SECTIONS[section];
      if (!sec) continue;
      const row: Record<string, string> = {};
      header.forEach((k, i) => (row[k] = cells[i] ?? ''));
      let name = cleanName(sec.name!(row));
      const newInRemake = /\(NEW in remake\)/i.test(name);
      name = name.replace(/\s*\(NEW in remake\)/i, '').trim();
      const number = parseInt(row['#'], 10);
      const details: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) if (k !== '#' && v && v !== '—') details[k] = cleanName(v);
      // Location rows get plain numbered ids, so the public checklist (no guide text)
      // and a detailed local one share the same ids.
      const idBase = cur.id === 'gold_skulltulas' || cur.id === 'heart_pieces' ? String(number).padStart(3, '0') : slug(name);
      cur.items.push({
        id: `${cur.id}.${idBase}`,
        number,
        name,
        chapter: sec.chapter ? row[sec.chapter] : undefined,
        region: sec.region ? row[sec.region] || undefined : undefined,
        requirement: sec.req ? row[sec.req] || undefined : undefined,
        details,
        newInRemake: newInRemake || undefined,
        iconId: typeof sec.icon === 'function' ? sec.icon(name) : sec.icon,
        detect: null,
      });
      continue;
    }
    if (line.trim()) paragraph.push(line.trim());
    else flushNote();
  }
  flushNote();
  return { cats, declaredCounts };
}

function addExtras(cats: Category[]) {
  // PART C extras that the source describes in prose, not tables.
  const dungeonsMC = ['Great Deku Tree', "Dodongo's Cavern", "Lord Jabu-Jabu's Belly", 'Forest Temple', 'Fire Temple', 'Water Temple', 'Shadow Temple', 'Spirit Temple', 'Ice Cavern', 'Bottom of the Well'];
  const bossKeys = ['Forest Temple', 'Fire Temple', 'Water Temple', 'Shadow Temple', 'Spirit Temple', "Ganon's Castle"];
  const items: Item[] = [];
  let n = 1;
  for (const d of dungeonsMC) for (const t of ['Map', 'Compass'])
    items.push({ id: `dungeon_items.${slug(d)}_${t.toLowerCase()}`, number: n++, name: `${d} ${t}`, chapter: d, iconId: t === 'Map' ? 'dungeon_map' : 'compass', detect: null });
  for (const d of bossKeys) items.push({ id: `dungeon_items.${slug(d)}_boss_key`, number: n++, name: `${d} Boss Key`, chapter: d, iconId: 'boss_key', detect: null });
  cats.push({ id: 'dungeon_items', label: 'Maps, Compasses & Boss Keys', part: 'C', countsToward100: false, kind: 'list',
    note: 'Counts from the original game; not yet confirmed for the remake.', items });
  cats.push({ id: 'amiibo_masks', label: 'amiibo Retro Masks', part: 'C', countsToward100: false, kind: 'list',
    note: 'Cosmetic; never counted toward 100%.',
    items: [
      { id: 'amiibo_masks.young_link', number: 1, name: 'Young Link amiibo mask', iconId: 'mask', detect: null },
      { id: 'amiibo_masks.young_zelda', number: 2, name: 'Young Zelda amiibo mask', iconId: 'mask', detect: null },
    ] });
}

// Expected totals from the original brief (Part A list categories).
const BRIEF: Record<string, number> = {
  heart_pieces: 36, heart_containers: 8, gold_skulltulas: 100, songs: 13, equipment: 12, items: 27, masks: 5, bottles: 5,
  great_fairies: 6, capacity: 14, stones_medallions: 9, dungeons: 12, bosses: 10, mini_bosses: 10, side_quests: 6,
};

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('build-checklist.ts')) {
  const { cats, declaredCounts } = parse(fs.readFileSync(SRC, 'utf8'));
  addExtras(cats);

  let ok = true;
  console.log('category'.padEnd(22), 'part', 'parsed', 'declared', 'brief');
  for (const c of cats) {
    const n = c.kind === 'counter' ? `0–${c.max}` : String(c.items.length);
    const d = declaredCounts[c.id];
    const b = BRIEF[c.id];
    const bad = (d !== undefined && d !== c.items.length) || (b !== undefined && b !== c.items.length);
    if (bad) ok = false;
    console.log(c.id.padEnd(22), ` ${c.part}  `, n.padStart(6), String(d ?? '').padStart(8), String(b ?? '').padStart(5), bad ? '  MISMATCH' : '');
    const ids = new Set<string>();
    for (const it of c.items) { if (ids.has(it.id)) { console.log('  duplicate id', it.id); ok = false; } ids.add(it.id); }
    c.items.forEach((it, i) => { if (it.number !== i + 1) { console.log(`  numbering gap at ${it.id}`); ok = false; } });
  }
  fs.mkdirSync('data', { recursive: true });
  const stamp = new Date().toISOString();
  // Detailed version: your own source text, stays on this PC (gitignored).
  fs.writeFileSync(LOCAL_OUT, JSON.stringify({ source: SRC, generatedAt: stamp, categories: cats }, null, 2) + '\n');
  // Public version: names, numbers and areas only (no guide-written text).
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: stamp, categories: publicCopy(cats) }, null, 2) + '\n');
  console.log(`\nWrote ${LOCAL_OUT} (detailed, local only) and ${OUT} (public). ${ok ? 'All counts match.' : 'CHECK THE MISMATCHES ABOVE.'}`);
  if (!ok) process.exitCode = 1;
}
