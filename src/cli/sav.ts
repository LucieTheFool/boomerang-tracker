// Research CLI: npm run sav -- <command> [args]
//   dump  <file.sav> [--json] [--type Bool] [--nondefault] [--grep text]
//   diff  <a.sav> <b.sav> [--json]
//   names <romfs path>      build local/names.json from the game's files
//   info  <file.sav>        header and per-type counts
import fs from 'node:fs';
import path from 'node:path';
import { parseGameData, Entry, Value } from '../gamedata/parser.js';
import { diffGameData, stable } from '../gamedata/diff.js';
import { hex32, murmur3 } from '../gamedata/murmur3.js';
import { loadNames, saveNames, NameTable } from '../gamedata/names.js';

/** "A_{x,y}_B" -> ["A_x_B", "A_y_B"], nested and repeated groups allowed. */
function expand(p: string): string[] {
  const m = p.match(/\{([^{}]*)\}/);
  if (!m) return [p];
  return m[1].split(',').flatMap(alt => expand(p.slice(0, m.index) + alt + p.slice(m.index! + m[0].length)));
}
import { buildNameTable } from '../gamedata/harvest.js';
import { autoDetectUserFolder, resolveUserFolders, listSlots, mostRecentSlot, readSaveStable } from '../gamedata/saves.js';

const NAMES_FILE = path.resolve('local/names.json');
const CONFIG_FILE = path.resolve('local/config.json');
const NOISE = /Position|Rotation|Camera|PlayTime|Time$|Timer/;
function readConfig(): { saveDir?: string } {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
function writeConfig(c: object) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2));
}

const args = process.argv.slice(2);
const cmd = args.shift();
const flag = (f: string) => { const i = args.indexOf(f); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (f: string) => { const i = args.indexOf(f); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };

function load(file: string) {
  if (!fs.existsSync(file)) die(`File not found: ${file}`);
  // Read-only, and never from a half-written file: read once into memory.
  return parseGameData(fs.readFileSync(file));
}
function die(msg: string): never { console.error(msg); process.exit(1); }

function keyLabel(k: number | string, names: NameTable) {
  if (typeof k === 'string') return k;
  const n = names.keys.get(k);
  return n ? `${hex32(k)} ${n}` : hex32(k);
}

function fmt(v: Value | undefined, type: string, names: NameTable, indices?: number[]): string {
  if (v === undefined) return '(absent)';
  if (type === 'Enum' && typeof v === 'number') return names.enums.get(v) ?? hex32(v);
  if (type === 'Enum' || type === 'EnumArray') {
    if (Array.isArray(v)) return fmtArray(v.map(x => (typeof x === 'number' ? names.enums.get(x) ?? hex32(x) : x)), indices);
  }
  if (Array.isArray(v)) return fmtArray(v, indices);
  if (typeof v === 'object' && v && 'bytes' in v) return `<${v.bytes.length / 2} bytes>`;
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' && !Number.isInteger(v)) return v.toPrecision(6);
  return stable(v);
}

function fmtArray(a: Value[], indices?: number[]): string {
  if (indices) return `[${a.length}] ` + indices.slice(0, 12).map(i => `${i}=${stable(a[i])}`).join(' ') + (indices.length > 12 ? ` …(+${indices.length - 12})` : '');
  // Show only "interesting" (non-zero / non-false / non-empty) elements of long arrays.
  const s = a.map((x, i) => [i, x] as const).filter(([, x]) => x !== 0 && x !== false && x !== '' && x !== -1);
  if (a.length <= 8) return stable(a);
  return `[${a.length}] ` + s.slice(0, 12).map(([i, x]) => `${i}=${stable(x)}`).join(' ') + (s.length > 12 ? ` …(+${s.length - 12})` : '') + (s.length === 0 ? '(all default)' : '');
}

const isDefaultish = (e: Entry) => {
  const v = e.value;
  if (v === false || v === 0 || v === '') return true;
  if (Array.isArray(v)) return v.every(x => x === false || x === 0 || x === '' || (typeof x === 'object' && x && 'bytes' in x && x.bytes === ''));
  return false;
};

switch (cmd) {
  case 'info': {
    const g = load(args[0]);
    const c: Record<string, number> = {};
    for (const e of g.entries.values()) c[e.type] = (c[e.type] ?? 0) + 1;
    console.log(`version ${hex32(g.version)}  data at 0x${g.dataStart.toString(16)}  size ${g.size}`);
    console.log(`entries ${g.entries.size}  Bool64bitKey flags set: ${g.bool64.size}`);
    console.table(c);
    if (g.warnings.length) console.log('warnings:\n  ' + g.warnings.join('\n  '));
    break;
  }
  case 'dump': {
    const json = flag('--json');
    const nondefault = flag('--nondefault');
    const type = opt('--type');
    const grep = opt('--grep')?.toLowerCase();
    const g = load(args[0]);
    const names = loadNames(NAMES_FILE);
    let list = [...g.entries.values()];
    if (type) list = list.filter(e => e.type === type);
    if (nondefault) list = list.filter(e => !isDefaultish(e));
    if (grep) list = list.filter(e => keyLabel(e.hash, names).toLowerCase().includes(grep));
    if (json) {
      console.log(stable({
        version: g.version, size: g.size, warnings: g.warnings,
        entries: list.map(e => ({ key: hex32(e.hash), name: names.keys.get(e.hash), type: e.type, value: e.value })),
        bool64: (!type || type === 'Bool64bitKey') ? [...g.bool64].map(k => '0x' + k.toString(16).padStart(16, '0')) : undefined,
      }));
    } else {
      for (const e of list) console.log(`${keyLabel(e.hash, names).padEnd(60)} ${e.type.padEnd(14)} ${fmt(e.value, e.type, names)}`);
      if ((!type && !grep && !nondefault) || type === 'Bool64bitKey') {
        console.log(`\nBool64bitKey flags set (${g.bool64.size}):`);
        console.log([...g.bool64].map(k => '0x' + k.toString(16).toUpperCase().padStart(16, '0')).join(' '));
      }
      console.error(`\n${list.length} entries shown. ${names.keys.size ? `${names.keys.size} names loaded.` : 'No names loaded (run: npm run sav -- names <romfs>).'}`);
    }
    break;
  }
  case 'diff': {
    const json = flag('--json');
    const a = load(args[0]);
    const b = load(args[1]);
    const names = loadNames(NAMES_FILE);
    const changes = diffGameData(a, b);
    if (json) { console.log(stable(changes.map(c => ({ ...c, key: typeof c.key === 'number' ? hex32(c.key) : c.key, name: typeof c.key === 'number' ? names.keys.get(c.key) : undefined })))); break; }
    for (const c of changes) {
      const arr = c.indices !== undefined;
      console.log(`${keyLabel(c.key, names).padEnd(60)} ${c.type.padEnd(14)} ${arr ? fmt(c.old, c.type, names, c.indices) + '  →  ' + fmt(c.new, c.type, names, c.indices) : fmt(c.old, c.type, names) + ' → ' + fmt(c.new, c.type, names)}`);
    }
    console.error(`\n${changes.length} changed.`);
    break;
  }
  case 'names': {
    const romfs = args[0] ?? die('Usage: names <romfs path>');
    await buildNameTable(romfs, NAMES_FILE, msg => console.error(msg));
    break;
  }
  case 'snap': {
    // snap [label] [--slot slot_03] [--dir <save folder>] : copy the latest save to
    // fixtures/snapshots/<timestamp>-<slot>-<label>.sav and diff it with the previous snapshot.
    const slotName = opt('--slot');
    const dir = opt('--dir') ?? readConfig().saveDir ?? autoDetectUserFolder();
    if (!dir) die('No save folder found. Pass --dir <folder> once; it is remembered in local/config.json.');
    const users = resolveUserFolders(dir);
    if (!users.length) die(`No slot_* folders with progress.sav under ${dir}`);
    writeConfig({ ...readConfig(), saveDir: users[0] });
    const slots = listSlots(users[0]);
    const slot = slotName ? slots.find(s => s.name === slotName) : mostRecentSlot(slots);
    if (!slot) die(`Slot ${slotName} not found`);
    const { buf, data } = await readSaveStable(slot.progress);
    const label = (args[0] ?? 'snap').replace(/[^\w.-]+/g, '-').slice(0, 60);
    const snapDir = path.resolve('fixtures/snapshots');
    fs.mkdirSync(snapDir, { recursive: true });
    const prev = fs.readdirSync(snapDir).filter(f => f.endsWith('.sav')).sort().pop();
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    const out = path.join(snapDir, `${stamp}-${slot.name}-${label}.sav`);
    fs.writeFileSync(out, buf);
    console.log(`Saved ${path.relative(process.cwd(), out)} (from ${slot.name}, saved ${new Date(slot.mtimeMs).toLocaleString()})`);
    if (prev) {
      const names = loadNames(NAMES_FILE);
      const changes = diffGameData(parseGameData(fs.readFileSync(path.join(snapDir, prev))), data)
        .filter(c => !NOISE.test(typeof c.key === 'number' ? names.keys.get(c.key) ?? '' : '') && !['Float', 'FloatArray', 'Vector3', 'Binary', 'Int64', 'UInt64', 'UInt'].includes(c.type));
      console.log(`\nChanged since ${prev} (play time, position and camera hidden):`);
      for (const c of changes) console.log(`  ${keyLabel(c.key, names).padEnd(60)} ${c.type.padEnd(12)} ${fmt(c.old, c.type, names, c.indices)} → ${fmt(c.new, c.type, names, c.indices)}`);
    }
    break;
  }
  case 'probe': {
    // probe <sav> <pattern>... : hash guessed names ("A_{x,y}_B" expands) and show the ones present.
    // --learn adds hits to local/names.json.
    const learn = flag('--learn');
    const g = load(args.shift()!);
    const names = loadNames(NAMES_FILE);
    let hits = 0;
    for (const pat of args) for (const name of expand(pat)) {
      const h = murmur3(name);
      const e = g.entries.get(h);
      if (!e) continue;
      hits++;
      console.log(`${hex32(h)} ${name.padEnd(60)} ${e.type.padEnd(12)} ${fmt(e.value, e.type, names)}`);
      if (learn && !names.keys.has(h)) names.keys.set(h, name);
    }
    if (learn) saveNames(NAMES_FILE, names);
    console.error(`${hits} hit(s).`);
    break;
  }
  default:
    console.log('Commands: info <sav> | dump <sav> [--json --type T --nondefault --grep s] | diff <a> <b> [--json] | names <romfs> | probe <sav> <pattern...> [--learn]');
}
