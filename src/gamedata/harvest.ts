// Builds the local name table: scans the user's RomFS (and ExeFS, if present
// next to it) for identifier-like strings, hashes each one with Murmur3, and keeps
// those that match a key in the GameDataList. Output goes to local/ (gitignored).
import fs from 'node:fs';
import path from 'node:path';
import { RomFs, parseSarc, harvestStrings } from './romfs.js';
import { loadGameDataList } from './gamedatalist.js';
import { murmur3 } from './murmur3.js';
import { NameTable, saveNames } from './names.js';

// File types that never hold flag names (textures, audio, models, physics, baked lighting).
const SKIP = /\.(bwav|bntx\.zs|extm|hght|mate|bcul\.zs|bfres\.zs|bphsh\.zs|bphsc\.zs|bphnm\.zs|bkprb\.zs|bars\.zs|bkres\.zs|bpvsts\.zs)$/;

function walk(d: string): string[] {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
}

/** Candidate spellings derived from one harvested string. */
function* variants(s: string): Generator<string> {
  yield s;
  if (s.includes('/')) for (const p of s.split('/')) if (p) yield p;
  // file names like "Npc_Foo.bfevfl" -> "Npc_Foo"
  const dot = s.indexOf('.');
  if (dot > 0 && /\.(b[a-z]+|zs|ainb|byml|bgyml|pack)$/.test(s)) yield s.slice(0, dot);
}

export async function buildNameTable(romfsRoot: string, outFile: string, log: (m: string) => void = () => {}) {
  const gdl = loadGameDataList(romfsRoot);
  const want = new Set<number>();
  for (const k of gdl.entries.keys()) if (typeof k === 'number') want.add(k);
  log(`GameDataList revision ${gdl.revision}: ${gdl.entries.size} keys (${want.size} with 32-bit hashes)`);

  const rom = new RomFs(romfsRoot);
  const strings = new Set<string>();
  const eat = (name: string, b: Buffer, depth = 0) => {
    if (b.length > 4 && b.toString('latin1', 0, 4) === 'SARC' && depth < 3) {
      for (const [k, v] of parseSarc(b)) {
        if (SKIP.test(k)) continue;
        try { eat(k, k.endsWith('.zs') ? rom.decompress(v, k) : v, depth + 1); } catch { /* skip */ }
      }
    } else harvestStrings(b, 3, strings);
  };

  const files = walk(romfsRoot).filter(f => !SKIP.test(f));
  let n = 0;
  let failed = 0;
  for (const f of files) {
    const rel = path.relative(romfsRoot, f);
    try { eat(rel, rom.read(rel)); } catch { failed++; }
    if (++n % 5000 === 0) log(`  scanned ${n}/${files.length} files, ${strings.size} strings`);
  }
  // Hookshot keeps the ExeFS next to the RomFS.
  for (const dir of ['../.hookshot_exefs', '../exefs']) {
    const d = path.resolve(romfsRoot, dir);
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) harvestStrings(fs.readFileSync(path.join(d, f)), 3, strings);
  }
  log(`${strings.size} distinct strings (${failed} files unreadable)`);

  const table: NameTable = { keys: new Map(), enums: gdl.enumNames };
  for (const s of strings) for (const v of variants(s)) {
    const h = murmur3(v);
    if (want.has(h) && !table.keys.has(h)) table.keys.set(h, v);
  }
  // Second pass: many keys are compound names ("IsGet.<actor>", "PouchData.<actor>.StockNum",
  // "<Dungeon>.SmallKeyNum"). Take the prefixes/suffixes seen in names found so far and
  // combine them with actor-like strings from the game files.
  const heads = new Set<string>();
  const tails = new Set<string>();
  const mids = new Set<string>();
  for (const name of table.keys.values()) {
    const parts = name.split('.');
    if (parts.length < 2) continue;
    heads.add(parts[0]);
    if (parts.length >= 3) tails.add(parts[parts.length - 1]);
    for (const p of parts) mids.add(p);
  }
  const actorLike = /^(Item|Armor|Weapon|Npc|Enemy|Obj|Dm|Demo|Event|Gimmick|Animal|Horse|Player|Field|Dungeon)_[A-Za-z0-9_]{1,60}$|^[A-Z][A-Za-z]{2,30}(Temple|Cavern|Well|Castle|Fortress|Grounds|Belly|Tree)$/;
  for (const s of strings) if (actorLike.test(s)) mids.add(s);
  let composed = 0;
  const tailList = [...tails];
  for (const h of heads) for (const m of mids) {
    for (const cand of [`${h}.${m}`, ...tailList.map(t => `${h}.${m}.${t}`), `${m}.${h}`]) {
      const hash = murmur3(cand);
      if (want.has(hash) && !table.keys.has(hash)) { table.keys.set(hash, cand); composed++; }
    }
  }
  // "<Word>.<Suffix>" where the suffix ends a known two-part name. Slow (10+ minutes) and
  // found only 2 extra names on revision 110, so it only runs with OOT_NAMES_DEEP=1.
  const suffixes = new Set<string>();
  for (const name of table.keys.values()) { const p = name.split('.'); if (p.length === 2) suffixes.add(p[1]); }
  const words = process.env.OOT_NAMES_DEEP ? [...strings].filter(s => /^[A-Z][A-Za-z0-9_]{2,40}$/.test(s)) : [];
  for (const w of words) for (const t of suffixes) {
    const cand = `${w}.${t}`;
    const hash = murmur3(cand);
    if (want.has(hash) && !table.keys.has(hash)) { table.keys.set(hash, cand); composed++; }
  }
  log(`Compound names: +${composed}`);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  saveNames(outFile, table, gdl.revision);
  log(`Matched ${table.keys.size} of ${want.size} key names. Wrote ${outFile}`);
  return table;
}
