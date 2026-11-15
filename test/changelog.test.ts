import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ChangeLog } from '../src/main/changelog';

describe('change log', () => {
  it('appends one JSON line per entry to a monthly file, and caps unknown keys', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-log-'));
    const log = new ChangeLog(dir);
    const row = (k: string) => ({ key: k, type: 'Bool', old: 'false', new: 'true' });
    log.write({ kind: 'change', source: 'live', area: 'LostWood_Child', known: [row('0x1')], unknown: Array.from({ length: 400 }, (_, i) => row(`0x${i}`)), unknownTotal: 400 });
    log.write({ kind: 'manual', item: 'songs.001', ticked: true });
    const lines = fs.readFileSync(log.file(), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ kind: 'change', source: 'live', area: 'LostWood_Child', unknownTotal: 400 });
    expect(lines[0].unknown).toHaveLength(150);
    expect(lines[0].at).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(path.basename(log.file())).toMatch(/^changes-\d{4}-\d\d\.jsonl$/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes nothing when turned off', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-log-'));
    const log = new ChangeLog(dir);
    log.enabled = false;
    log.write({ kind: 'manual', item: 'x', ticked: true });
    expect(fs.existsSync(log.file())).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
