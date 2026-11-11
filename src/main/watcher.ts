// Watches a save user folder (all slots) for writes. Uses fs.watch plus a polling
// fallback, since file events on Windows can be missed. Fires `onChange` once things
// have been quiet for `debounceMs` after the last write.
import fs from 'node:fs';
import { listSlots } from '../gamedata/saves.js';

export class SaveWatcher {
  private watcher?: fs.FSWatcher;
  private poll?: NodeJS.Timeout;
  private timer?: NodeJS.Timeout;
  private lastSig = '';

  constructor(private dir: string, private onChange: () => void, private debounceMs = 750, private pollMs = 3000) {}

  start() {
    this.lastSig = this.signature();
    try {
      this.watcher = fs.watch(this.dir, { recursive: true, persistent: false }, (_ev, file) => {
        if (!file || /progress\.sav$|caption\.sav$/i.test(String(file))) this.kick();
      });
      this.watcher.on('error', () => { /* polling still runs */ });
    } catch { /* polling only */ }
    this.poll = setInterval(() => {
      const sig = this.signature();
      if (sig !== this.lastSig) this.kick();
    }, this.pollMs);
  }

  private signature() {
    return listSlots(this.dir).map(s => `${s.name}:${s.mtimeMs}`).join('|');
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
