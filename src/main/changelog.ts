// Change log: one JSON object per line in <userData>/logs/changes-YYYY-MM.jsonl.
// Records every change in the values the tracker reads (live or from saves), plus
// identifications and hand ticks, so a mapping can be confirmed after the fact
// ("I got the Volvagia heart container last night"). Local only; never uploaded.
import fs from 'node:fs';
import path from 'node:path';
import type { ChangeRow } from '../shared/types.js';

export type LogEntry =
  | { kind: 'change'; source: 'live' | 'save'; slot?: string; area?: string; known: ChangeRow[]; unknown: ChangeRow[]; unknownTotal: number }
  | { kind: 'identify'; how: 'answer' | 'auto-area' | 'auto-group' | 'undo' | 'skip'; items: string[]; flags: string[]; area?: string }
  | { kind: 'manual'; item: string; ticked: boolean; slot?: string }
  | { kind: 'source'; status: string; detail?: string };

/** Unknown keys per entry are capped; anything the mapping reads is always kept. */
const MAX_UNKNOWN = 150;

export class ChangeLog {
  enabled = true;
  constructor(readonly dir: string) {}

  file(d = new Date()) {
    return path.join(this.dir, `changes-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}.jsonl`);
  }

  write(entry: LogEntry) {
    if (!this.enabled) return;
    try {
      const e = entry.kind === 'change' && entry.unknown.length > MAX_UNKNOWN ? { ...entry, unknown: entry.unknown.slice(0, MAX_UNKNOWN) } : entry;
      fs.mkdirSync(this.dir, { recursive: true });
      fs.appendFileSync(this.file(), JSON.stringify({ at: new Date().toISOString(), ...e }) + '\n');
    } catch (err) {
      console.error('change log', err);
    }
  }
}
