// Finding save folders and reading saves safely. No Electron imports.
// Saves are only ever read. A read is accepted only when the file looks complete
// (magic matches, size is stable across the read, and the parser accepts it).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseGameData, GameDataFile, MAGIC } from './parser.js';

export interface SlotInfo {
  name: string; // "slot_03"
  dir: string;
  progress: string;
  caption: string;
  mtimeMs: number; // progress.sav modified time
}

/** A user folder holds slot_* dirs: <...>\save\<32-hex user id>\ */
export function isUserFolder(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some(n => /^slot_\d+$/.test(n) && fs.existsSync(path.join(dir, n, 'progress.sav')));
  } catch { return false; }
}

/**
 * Given a game folder, a "save" folder, or a user folder, return the user folders inside.
 * Also an emulator's data folder (or any folder down to the account one): see emulatorUserFolders.
 */
export function resolveUserFolders(start: string): string[] {
  if (!fs.existsSync(start)) return [];
  if (isUserFolder(start)) return [start];
  const tries = [start, path.join(start, 'save'), path.join(start, 'user', 'save')];
  const out: string[] = [];
  for (const t of tries) {
    for (const n of readdir(t)) {
      const p = path.join(t, n);
      if (/^[0-9a-f]{32}$/i.test(n) && isUserFolder(p)) out.push(p);
    }
  }
  out.push(...emulatorUserFolders(start));
  return [...new Set(out)];
}

function readdir(dir: string): string[] {
  try { return fs.readdirSync(dir); } catch { return []; }
}

/** Ocarina of Time's title id: emulators keep its saves in a folder named after it. */
export const OOT_TITLE_ID = '0400486024DEC000';

/**
 * Emulators keep saves as <data>\nand\user\save\0000000000000000\<32-hex account>\<title id>\slot_*
 * (<data> is e.g. %APPDATA%\fritchii, or a portable "user" folder next to the exe). Only
 * Ocarina of Time's title folder counts: other games' saves can look alike.
 */
function emulatorUserFolders(start: string): string[] {
  const out: string[] = [];
  const saveDirs = [start, path.join(start, 'save'), path.join(start, 'nand', 'user', 'save'), path.join(start, 'user', 'nand', 'user', 'save')];
  const accountDirs = [start, ...saveDirs.map(d => path.join(d, '0000000000000000'))];
  for (const a of accountDirs) {
    const accounts = /^[0-9a-f]{32}$/i.test(path.basename(a)) ? [a] : readdir(a).filter(n => /^[0-9a-f]{32}$/i.test(n)).map(n => path.join(a, n));
    for (const acc of accounts) {
      const title = readdir(acc).find(n => n.toUpperCase() === OOT_TITLE_ID);
      if (title && isUserFolder(path.join(acc, title))) out.push(path.join(acc, title));
    }
  }
  return out;
}

/** Emulator exes, and the data folders (under %APPDATA%) they keep saves in. Fritchii runs as lichii.exe. */
const EMULATOR_EXES = ['lichii.exe'];
function emulatorDataDirs(appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')): string[] {
  return ['fritchii', 'lichii'].map(n => path.join(appData, n));
}

/** Game exes, at the top of a game folder or in bin\: Hookshot, its fork Longshot, NX2navi's Triforce, Project ReLink. */
const GAME_EXES = ['hookshot.exe', path.join('bin', 'hookshot.exe'), 'Longshot.exe', 'Triforce.exe', 'ReLink.exe', path.join('bin', 'relink-game.exe')];
/** Folder names those games are usually installed under. */
const GAME_NAMES = /hookshot|longshot|triforce|nx2navi|relink/i;

function isGameFolder(dir: string): boolean {
  return GAME_EXES.some(f => fs.existsSync(path.join(dir, f)));
}

/** Places Hookshot, Longshot, NX2navi (Triforce) and Project ReLink game folders usually live. */
export function candidateGameFolders(): string[] {
  const home = os.homedir();
  // NX2navi's setup builds the game into %USERPROFILE%\Games\Triforce; Project ReLink's setup defaults to Games\ReLink.
  const c = ['Hookshot', 'Longshot', 'Triforce', 'ReLink'].map(n => path.join(home, 'Games', n));
  const gameDirs = [path.join(home, 'Games')];
  for (const drive of ['C:', 'D:', 'E:', 'F:']) {
    // Launchers (e.g. QuiverLauncher) install builds as Apps\<name>-Hookshot, Apps\<name>-NX2navi.
    for (const base of [path.join(drive + '\\', 'Games', 'QuiverLauncher', 'Apps'), path.join(home, 'QuiverLauncher', 'Apps')]) {
      try {
        for (const n of fs.readdirSync(base)) if (GAME_NAMES.test(n)) c.push(path.join(base, n));
      } catch { /* not there */ }
    }
    gameDirs.push(path.join(drive + '\\', 'Games'));
  }
  // Game folders straight under a Games folder, e.g. D:\Games\Longshot.
  for (const games of gameDirs) {
    try {
      for (const n of fs.readdirSync(games)) { const p = path.join(games, n); if (GAME_NAMES.test(n) && isGameFolder(p)) c.push(p); }
    } catch { /* not there */ }
  }
  // Emulators keep their saves in their own data folder (Fritchii: %APPDATA%\fritchii).
  c.push(...emulatorDataDirs());
  return [...new Set(c)];
}

/**
 * The save folder of the install a running game exe belongs to (exe at the top of the
 * game folder or in bin\), the most recently played profile if there are several. For an
 * emulator: its portable "user" folder next to the exe, or its data folder.
 */
export function userFolderForExe(exe: string, appData?: string): string | null {
  let dir = path.dirname(exe);
  if (path.basename(dir).toLowerCase() === 'bin') dir = path.dirname(dir);
  const roots = EMULATOR_EXES.includes(path.basename(exe).toLowerCase()) ? [dir, ...emulatorDataDirs(appData)] : [dir];
  return roots.flatMap(resolveUserFolders).sort((a, b) => latestMtime(b) - latestMtime(a))[0] ?? null;
}

/** The save folder with the most recent save across every install found. */
export function autoDetectUserFolder(): string | null {
  const all = candidateGameFolders().flatMap(g => resolveUserFolders(g));
  return all.sort((a, b) => latestMtime(b) - latestMtime(a))[0] ?? null;
}

function latestMtime(userDir: string): number {
  return Math.max(0, ...listSlots(userDir).map(s => s.mtimeMs));
}

export function listSlots(userDir: string): SlotInfo[] {
  let names: string[] = [];
  try { names = fs.readdirSync(userDir).filter(n => /^slot_\d+$/.test(n)).sort(); } catch { return []; }
  const out: SlotInfo[] = [];
  for (const name of names) {
    const dir = path.join(userDir, name);
    const progress = path.join(dir, 'progress.sav');
    try {
      const st = fs.statSync(progress);
      out.push({ name, dir, progress, caption: path.join(dir, 'caption.sav'), mtimeMs: st.mtimeMs });
    } catch { /* slot without progress.sav */ }
  }
  return out;
}

export const mostRecentSlot = (slots: SlotInfo[]) => [...slots].sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

export class IncompleteSaveError extends Error {}

/**
 * Read a save without risking a half-written file: read it into memory, check the
 * size didn't change while reading, check the magic, and parse. Retries a few times.
 */
export async function readSaveStable(file: string, { attempts = 5, delayMs = 300 } = {}): Promise<{ buf: Buffer; data: GameDataFile; mtimeMs: number }> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const before = fs.statSync(file);
      const buf = fs.readFileSync(file); // read-only: fs.readFileSync opens with flag 'r'
      const after = fs.statSync(file);
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || buf.length !== after.size)
        throw new IncompleteSaveError('File changed while reading');
      if (buf.length < 0x28 || buf.readUInt32LE(0) !== MAGIC) throw new IncompleteSaveError('Bad magic (file may be mid-write)');
      return { buf, data: parseGameData(buf), mtimeMs: after.mtimeMs };
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
