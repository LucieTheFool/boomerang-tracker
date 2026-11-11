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

/** Given a game folder, a "save" folder, or a user folder, return the user folders inside. */
export function resolveUserFolders(start: string): string[] {
  if (!fs.existsSync(start)) return [];
  if (isUserFolder(start)) return [start];
  const tries = [start, path.join(start, 'save'), path.join(start, 'user', 'save')];
  const out: string[] = [];
  for (const t of tries) {
    if (!fs.existsSync(t)) continue;
    for (const n of fs.readdirSync(t)) {
      const p = path.join(t, n);
      if (/^[0-9a-f]{32}$/i.test(n) && isUserFolder(p)) out.push(p);
    }
  }
  return [...new Set(out)];
}

/** Places Hookshot saves usually live. The first existing one wins. */
export function candidateGameFolders(): string[] {
  const home = os.homedir();
  const c = [path.join(home, 'Games', 'Hookshot')];
  // Launchers (e.g. QuiverLauncher) install Hookshot builds as Apps\<name>-Hookshot.
  for (const drive of ['C:', 'D:', 'E:', 'F:']) {
    for (const base of [path.join(drive + '\\', 'Games', 'QuiverLauncher', 'Apps'), path.join(home, 'QuiverLauncher', 'Apps')]) {
      try {
        for (const n of fs.readdirSync(base)) if (/hookshot/i.test(n)) c.push(path.join(base, n));
      } catch { /* not there */ }
    }
  }
  return [...new Set(c)];
}

export function autoDetectUserFolder(): string | null {
  for (const g of candidateGameFolders()) {
    const u = resolveUserFolders(g);
    if (u.length) return u.sort((a, b) => latestMtime(b) - latestMtime(a))[0];
  }
  return null;
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
