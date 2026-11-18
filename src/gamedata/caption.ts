// Key-based reader for caption.sav (the per-slot metadata container: area, date, position,
// hearts/MP, learned-state mirror). Same GameData container as progress.sav; see
// docs/longshot-crossref.md, "Caption.sav layout". No Electron imports here.
import fs from 'node:fs';
import { parseGameData, GameDataFile } from './parser.js';
import { murmur3 } from './murmur3.js';

// Key hashes are computed from the names; the hex values in the comments were verified
// 2026-11-18 vs Longshot reference save, see docs/longshot-crossref.md.
const key = (name: string) => murmur3(`CaptionData.${name}`);

const K = {
  area: key('BancScenePath'),       // 0x0cccc6cd
  location: key('LocationName'),    // 0xf74e0e8e
  year: key('Date.Year'),           // 0x9811a3f7
  month: key('Date.Month'),         // 0xdfd840d3
  day: key('Date.Day'),             // 0xbd46f485
  hour: key('Date.Hour'),           // 0x23f3d75e
  minute: key('Date.Minute'),       // 0x27853bf7
  second: key('Date.Second'),       // 0x5ee50bed
  life: key('Life'),                // 0x1e55ecc5 (quarter hearts)
  maxLife: key('MaxLife'),          // 0x74bd05d0
  mp: key('MP'),                    // 0x19f26b6a
  mpMax: key('MPMax'),              // 0x943f8ec3
  rupees: key('CurrentRupee'),      // 0xa9557547
  goldTokens: key('GoldToken'),     // 0xdc941483
  pos: key('Pos'),                  // 0x8b26618e
  dir: key('Dir'),                  // 0xaccbda17
  isAutoSave: key('IsAutoSave'),    // 0x25f03caa
};

// Learned-state mirror bools (all 0x… values verified as above).
const SONGS = ['ZeldaLullaby', 'EponaSong', 'SariaSong', 'SunSong', 'TimeSong', 'StormSong', 'ForestMinuet',
  'FireBolero', 'WaterSerenade', 'ShadowNocturne', 'SpiritRequiem', 'LightPrelude', 'ScarecrowSong'];
const MEDALS = ['Fire', 'Forest', 'Water', 'Shadow', 'Spirit', 'Light'];
const STONES = ['Fire', 'Forest', 'Water'];
const mirror = (kind: string, names: string[]) => names.map(n => ({ name: n, hash: key(`Item.Item_${kind}_${n}`) }));
const SONG_KEYS = mirror('Melody', SONGS);
const MEDAL_KEYS = mirror('Medal', MEDALS);
const STONE_KEYS = mirror('Stone', STONES);

export interface CaptionInfo {
  area: string | undefined;
  location: string | undefined;
  date: { year: number; month: number; day: number; hour: number; minute: number; second: number } | undefined;
  pos?: { x: number; y: number; z: number };
  dir?: number;
  life?: number;
  maxLife?: number;
  mp?: number;
  mpMax?: number;
  rupees?: number;
  goldTokens?: number;
  isAutoSave?: boolean;
  songs: string[];
  medals: string[];
  stones: string[];
}

export function readCaption(file: string): CaptionInfo | null {
  let g: GameDataFile;
  try { g = parseGameData(fs.readFileSync(file)); } catch { return null; }
  const get = (h: number) => g.entries.get(h)?.value;
  const num = (h: number) => { const v = get(h); return typeof v === 'number' ? v : undefined; };
  const str = (h: number) => { const v = get(h); return typeof v === 'string' ? v : undefined; };
  const bool = (h: number) => { const v = get(h); return typeof v === 'boolean' ? v : undefined; };
  const set = (list: { name: string; hash: number }[]) => list.filter(k => bool(k.hash) === true).map(k => k.name);

  const [year, month, day, hour, minute, second] = [K.year, K.month, K.day, K.hour, K.minute, K.second].map(num);
  const date = [year, month, day, hour, minute, second].every(v => v !== undefined)
    ? { year: year!, month: month!, day: day!, hour: hour!, minute: minute!, second: second! }
    : undefined;

  const p = get(K.pos);
  const pos = p && typeof p === 'object' && !Array.isArray(p) && 'x' in p
    ? { x: p.x, y: p.y, z: p.z ?? 0 }
    : undefined;

  return {
    area: str(K.area),
    location: str(K.location),
    date,
    pos,
    dir: num(K.dir),
    life: num(K.life),
    maxLife: num(K.maxLife),
    mp: num(K.mp),
    mpMax: num(K.mpMax),
    rupees: num(K.rupees),
    goldTokens: num(K.goldTokens),
    isAutoSave: bool(K.isAutoSave),
    songs: set(SONG_KEYS),
    medals: set(MEDAL_KEYS),
    stones: set(STONE_KEYS),
  };
}
