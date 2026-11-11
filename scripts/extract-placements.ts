// Reads the level placement files (romfs/Banc/**/*.bcett.byml.zs) from the user's own
// install and writes local/placements.json (gitignored): every Gold Skulltula and heart
// piece placement with its 64-bit id, area folder, map files, room and attributes.
//   npx tsx scripts/extract-placements.ts <romfs path>
// The save stores a Gold Skulltula as two 64-bit flags: (id with bit 1 cleared) and
// (id with bit 1 set), both set when the token is taken (confirmed by diff, Deku Tree 3F).
import fs from 'node:fs';
import path from 'node:path';
import { RomFs } from '../src/gamedata/romfs.js';
import { parseByml } from '../src/gamedata/byml.js';

const romfs = process.argv[2];
if (!romfs) { console.error('Usage: npx tsx scripts/extract-placements.ts <romfs path>'); process.exit(1); }
const rom = new RomFs(romfs);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

interface Placement { id: string; kind: string; gyaml: string; folder: string; maps: string[]; room?: number; pos: number[]; attrs: Record<string, unknown> }
const out = new Map<string, Placement>();
const hex = (v: unknown) => '0x' + BigInt(v as bigint).toString(16).toUpperCase().padStart(16, '0');

for (const f of walk(path.join(romfs, 'Banc')).filter(f => f.endsWith('.bcett.byml.zs'))) {
  const rel = path.relative(romfs, f).split(path.sep).join('/');
  let root: { Actors?: Record<string, unknown>[] };
  try { root = parseByml(rom.read(rel)) as typeof root; } catch { continue; }
  const folder = rel.split('/')[1];
  if (folder === 'DreamWorld') continue; // boss-rematch area copies, not real collectibles
  const map = rel.split('/').pop()!.replace('.bcett.byml.zs', '');
  for (const a of root.Actors ?? []) {
    const g = String(a.Gyaml);
    const kind = /Skulltula_Gold/.test(g) ? 'gold_skulltula'
      : g === 'HeartPieceAnchor' ? 'heart_piece_anchor'
      : /Heart_Piece|HeartPiece/i.test(g) ? 'heart_piece'
      : /^Obj_TBox_(?!Pedestal)/.test(g) ? 'chest'
      : null;
    if (!kind) continue;
    const id = hex(a.Hash);
    const dyn = (a.Dynamic ?? {}) as Record<string, unknown>;
    const prev = out.get(id);
    if (prev) { prev.maps.push(map); continue; }
    const attrs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dyn)) if (k !== 'DefaultDungeonRoomIndex') attrs[k.replace(/^Enemy_Skulltula_Gold_/, '')] = v;
    out.set(id, { id, kind, gyaml: g, folder, maps: [map], room: dyn.DefaultDungeonRoomIndex as number | undefined, pos: ((a.Translate as number[]) ?? []).map(x => Math.round(x)), attrs });
  }
}
const list = [...out.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.folder.localeCompare(b.folder) || a.id.localeCompare(b.id));
fs.mkdirSync('local', { recursive: true });
fs.writeFileSync('local/placements.json', JSON.stringify(list, null, 1));
const count = (k: string) => list.filter(p => p.kind === k).length;
console.log(`Wrote local/placements.json: ${count('gold_skulltula')} Gold Skulltulas, ${count('heart_piece_anchor')} heart-piece anchors, ${count('heart_piece')} heart pieces, ${count('chest')} chests`);
