import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { Controller } from '../src/main/controller.js';
import { SettingsStore } from '../src/main/settings.js';
import { LiveSource, liveUnavailableReason } from '../src/main/live.js';
import { findProcesses, initMemoryAccess } from '../src/main/procmem.js';

// Everything that could reach the game: the process list (tasklist.exe), koffi, and the
// procmem functions that use them. Watched, so the test can say none of it ran.
const koffiLoaded = vi.hoisted(() => vi.fn());
vi.mock('koffi', () => {
  koffiLoaded();
  return { default: { load() { throw new Error('test: no kernel32 here'); } } };
});
vi.mock('node:child_process', () => ({ execFile: vi.fn() }));
vi.mock('../src/main/procmem.js', async orig => {
  const m = await orig<typeof import('../src/main/procmem.js')>();
  return { ...m, initMemoryAccess: vi.fn(m.initMemoryAccess), findProcesses: vi.fn(m.findProcesses) };
});

const MESSAGE = "Live tracking isn't available on Linux yet. The tracker follows your save files and updates each time the game saves.";

// A made-up save folder in a temp directory (no real saves involved).
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-linux-live-'));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
let n = 0;

/** The smallest GameData container the parser accepts: no entries. */
function emptySave(): Buffer {
  const recs = [[0, 2], [0, 16]];
  const dataStart = 0x28 + recs.length * 8;
  const b = Buffer.alloc(dataStart);
  b.writeUInt32LE(0x01020304, 0);
  b.writeUInt32LE(0x002d80eb, 4);
  b.writeUInt32LE(dataStart, 8);
  recs.forEach(([a, v], i) => { b.writeUInt32LE(a, 0x28 + i * 8); b.writeUInt32LE(v, 0x2c + i * 8); });
  return b;
}

/** A tracker on `platform` whose settings already point at a save folder (so start() doesn't look around this PC). */
function tracker(platform: NodeJS.Platform) {
  const dir = path.join(root, `run-${++n}`);
  const user = path.join(dir, 'hookshot', 'save', '0123456789abcdef0123456789abcdef');
  fs.mkdirSync(path.join(user, 'slot_00'), { recursive: true });
  fs.writeFileSync(path.join(user, 'slot_00', 'progress.sav'), emptySave());
  const settings = new SettingsStore(path.join(dir, 'userdata', 'settings.json'));
  settings.update(s => { s.saveDir = user; s.live.enabled = true; });
  return new Controller({ appDir: process.cwd(), userData: path.join(dir, 'userdata'), snapshots: path.join(dir, 'snaps'), version: 'test' }, settings, { platform });
}

describe('live tracking on Linux', () => {
  let errors: ReturnType<typeof vi.spyOn>;
  const controllers: Controller[] = [];
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(initMemoryAccess).mockClear();
    vi.mocked(findProcesses).mockClear();
    vi.mocked(execFile).mockClear();
    koffiLoaded.mockClear();
  });
  afterEach(() => { for (const c of controllers.splice(0)) c.stop(); vi.restoreAllMocks(); });

  it('is reported unavailable with a plain message, and nothing reaches for the game', async () => {
    const c = tracker('linux');
    controllers.push(c);
    expect(c.state.live).toEqual({ status: 'unavailable', detail: MESSAGE, enabled: false, using: false });
    await c.start();
    expect(c.state.status).toBe('ok'); // the saves are read
    expect(c.state.platform).toBe('linux');
    expect(c.state.live).toEqual({ status: 'unavailable', detail: MESSAGE, enabled: false, using: false });
    await c.setLiveEnabled(true); // the toggle is disabled; even so, nothing starts
    expect(c.state.live.status).toBe('unavailable');
    expect(initMemoryAccess).not.toHaveBeenCalled();
    expect(findProcesses).not.toHaveBeenCalled();
    expect(execFile).not.toHaveBeenCalled();
    expect(koffiLoaded).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it('tells the user where Linux saves are when none are found', async () => {
    const c = tracker('linux');
    controllers.push(c);
    await c.useFolder(undefined);
    expect(c.state.status).toBe('no-folder');
    expect(c.state.message).toContain('~/.local/share/hookshot/save/<id>');
    expect(c.state.message).not.toMatch(/%APPDATA%|\\/);
  });

  it('a live source on Linux stops before the process list and memory access', async () => {
    const statuses: string[] = [];
    const live = new LiveSource({ hints: [], onHint() {}, onChange() {}, onStatus: () => statuses.push(live.info.status), platform: 'linux' });
    await live.start();
    expect(live.info).toEqual({ status: 'unavailable', detail: MESSAGE });
    expect(statuses).toEqual(['unavailable']);
    expect(initMemoryAccess).not.toHaveBeenCalled();
    expect(findProcesses).not.toHaveBeenCalled();
    expect(execFile).not.toHaveBeenCalled();
    live.stop();
  });

  it('is tried on Windows (the same checks, so they would catch it)', async () => {
    expect(liveUnavailableReason('win32')).toBeUndefined();
    const c = tracker('win32');
    controllers.push(c);
    await c.start();
    expect(initMemoryAccess).toHaveBeenCalledTimes(1);
    expect(c.state.live.enabled).toBe(true);
  });
});
