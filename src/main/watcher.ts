// Watches a save user folder (all slots) for writes. Uses fs.watch plus a polling
// fallback, since file events on Windows can be missed. Fires `onChange` once things
// have been quiet for `debounceMs` after the last write.
import fs from 'node:fs';
import { listSlots, journalProfile } from '../gamedata/saves.js';

/**
 * The folder to fs.watch for a user folder. Rekarina commits a save by renaming
 * save\<id> away and a finished save-tx\ready-<n> into its place, and Windows refuses
 * that rename while any handle is open inside save\<id> (the newest save then stays
 * parked in ready-<n>). A watch holds a handle on the folder it watches, so for Rekarina
 * the profile folder (holding save\ and save-tx\) is watched instead, never save\<id>.
 */
export function watchTarget(userDir: string): { dir: string; journal: boolean } {
  const profile = journalProfile(userDir);
  return profile ? { dir: profile, journal: true } : { dir: userDir, journal: false };
}

/** Does a change to `file` (relative to the watched folder) concern the saves? */
export function isSaveChange(file: string | null | undefined, journal: boolean): boolean {
  if (!file) return true;
  // Under a Rekarina profile: the committed saves and finished commits (renamed in as whole
  // folders), not the game's working copy (save-tx\work), half-written commits or backups.
  if (journal) return /^save($|[\\/]|-tx[\\/]ready-)/i.test(file);
  return /progress\.sav$|caption\.sav$/i.test(file);
}

export class SaveWatcher {
  private watcher?: fs.FSWatcher;
  private poll?: NodeJS.Timeout;
  private timer?: NodeJS.Timeout;
  private lastSig = '';

  constructor(private dir: string, private onChange: () => void, private debounceMs = 750, private pollMs = 3000) {}

  start() {
    this.lastSig = this.signature();
    const target = watchTarget(this.dir);
    try {
      this.watcher = fs.watch(target.dir, { recursive: true, persistent: false }, (_ev, file) => {
        if (isSaveChange(file === null ? null : String(file), target.journal)) this.kick();
      });
      this.watcher.on('error', () => { /* polling still runs */ });
    } catch { /* polling only */ }
    this.poll = setInterval(() => {
      const sig = this.signature();
      if (sig !== this.lastSig) this.kick();
    }, this.pollMs);
  }

  /** Each slot's folder (a pending Rekarina save lives elsewhere until swapped in) and time. */
  private signature() {
    return listSlots(this.dir).map(s => `${s.dir}:${s.mtimeMs}`).join('|');
  }

  private kick() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.lastSig = this.signature();
      this.onChange();
    }, this.debounceMs);
  }

  stop() {
    this.watcher?.close();
    clearInterval(this.poll);
    clearTimeout(this.timer);
  }
}
