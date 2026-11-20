import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { Controller, gameFolderOfExe } from '../src/main/controller.js';
import { SettingsStore } from '../src/main/settings.js';
import { LiveSource, type LiveMem } from '../src/main/live.js';

// Made-up Hookshot and Rekarina installs in a temp directory (no real saves involved).
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-follow-'));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
const UID = 'f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0';
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

function putSlot(user: string, slot = 'slot_00') {
  fs.mkdirSync(path.join(user, slot), { recursive: true });
  fs.writeFileSync(path.join(user, slot, 'progress.sav'), emptySave());
}

/** <root>\Hookshot-<n>\hookshot.exe with user\save\<uid>\slot_00. */
function hookshot() {
  const dir = path.join(root, `Hookshot-${++n}`);
  const user = path.join(dir, 'user', 'save', UID);
  putSlot(user);
  return { dir, user, exe: path.join(dir, 'hookshot.exe') };
}

/** <root>\Rekarina-<n>\game\Rekarina.exe with game\profile\save\<uid> (slot_00 unless `saves: false`) and save-tx. */
function rekarina({ saves = true } = {}) {
  const game = path.join(root, `Rekarina-${++n}`, 'game');
  const profile = path.join(game, 'profile');
  const user = path.join(profile, 'save', UID);
  fs.mkdirSync(path.join(profile, 'save'), { recursive: true });
  fs.mkdirSync(path.join(profile, 'save-tx'), { recursive: true });
  if (saves) putSlot(user);
  return { user, exe: path.join(game, 'Rekarina.exe'), tx: path.join(profile, 'save-tx') };
}

describe('following the running game', () => {
  let logs: ReturnType<typeof vi.spyOn>;
  const controllers: Controller[] = [];
  /** The [follow] lines logged so far. */
  const follows = () => logs.mock.calls.map(c => c.join(' ')).filter(l => l.startsWith('[follow]'));

  beforeEach(() => { logs = vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { for (const c of controllers.splice(0)) c.stop(); vi.restoreAllMocks(); });

  /** A tracker showing `start`'s saves, as after settings pointed at it. */
  async function tracker(start: string) {
    const data = path.join(root, `userdata-${++n}`);
    const c = new Controller({ appDir: process.cwd(), userData: data, snapshots: path.join(data, 'snaps'), version: 'test' }, new SettingsStore(path.join(data, 'settings.json')));
    controllers.push(c);
    await c.useFolder(start);
    return c;
  }

  it('switches on a later try when the first one found no save folder', async () => {
    const hs = hookshot(), rk = rekarina({ saves: false });
    const c = await tracker(hs.dir);
    await c.followGame(rk.exe, 1);
    expect(c.state.saveDir).toBe(hs.user);
    putSlot(rk.user); // the game wrote its first save
    await c.followGame(rk.exe, 1);
    expect(c.state.saveDir).toBe(rk.user);
    expect(c.settings.data.saveDir).toBe(rk.user);
    expect(follows()).toEqual([`[follow] no saves found for ${rk.exe}`, `[follow] switched to ${rk.user}`]);
  });

  it('switches once Windows gives the exe path, through the live source', async () => {
    const hs = hookshot(), rk = rekarina();
    const c = await tracker(hs.dir);
    const clock = { t: 100_000 };
    let exe: string | undefined;
    let following: Promise<void> | undefined;
    const mem: LiveMem = { read: () => null, regions: () => [], imagePath: () => exe, alive: () => true, close() {} };
    const live = new LiveSource({
      hints: [], onHint() {}, onChange() {}, onStatus() {}, now: () => clock.t,
      onGame: (e, attach) => { following = c.followGame(e, attach); },
      findGame: async () => ({ image: 'Rekarina.exe', pid: 77 }), open: () => mem,
    });
    await live.tick();
    await following;
    expect(c.state.saveDir).toBe(hs.user);
    exe = rk.exe;
    clock.t += 5000;
    await live.tick();
    await following;
    expect(c.state.saveDir).toBe(rk.user);
    expect(follows()).toEqual(['[follow] no exe path', `[follow] switched to ${rk.user}`]);
  });

  it('never switches while a slot is pinned', async () => {
    const hs = hookshot(), rk = rekarina();
    const c = await tracker(hs.dir);
    await c.pinSlot('slot_00');
    for (let i = 0; i < 3; i++) await c.followGame(rk.exe, 1);
    expect(c.state.saveDir).toBe(hs.user);
    expect(follows()).toEqual(['[follow] pinned']);
  });

  it("keeps a folder the user chose during the attach, and follows again on the next one", async () => {
    const hs = hookshot(), rk = rekarina();
    const c = await tracker(hs.dir);
    await c.followGame(rk.exe, 1);
    expect(c.state.saveDir).toBe(rk.user);
    await c.useFolder(hs.dir); // folder:browse
    for (let i = 0; i < 3; i++) await c.followGame(rk.exe, 1);
    expect(c.state.saveDir).toBe(hs.user);
    expect(follows().filter(l => l.includes('you chose'))).toEqual([`[follow] keeping the folder you chose: ${hs.user}`]);

    await c.followGame(rk.exe, 2); // the game was started again
    expect(c.state.saveDir).toBe(rk.user);
  });

  it('stays put, and says so once, when already on the game\'s saves', async () => {
    const rk = rekarina();
    const c = await tracker(rk.user);
    const switched = vi.spyOn(c as unknown as { openFolder(dir: string): Promise<void> }, 'openFolder');
    for (let i = 0; i < 5; i++) await c.followGame(rk.exe, 1);
    expect(switched).not.toHaveBeenCalled();
    expect(c.state.saveDir).toBe(rk.user);
    expect(follows()).toEqual([`[follow] already using ${rk.user}`]);
  });

  it('names the game folder above game/ in a Linux-style exe path', async () => {
    const hs = hookshot(), rk = rekarina();
    const c = await tracker(hs.dir);
    const exe = rk.exe.split(path.sep).join('/').replace(/\.exe$/, ''); // .../Rekarina-<n>/game/Rekarina
    const game = exe.slice(0, -'/game/Rekarina'.length);
    await c.followGame(exe, 1);
    expect(c.state.saveDir).toBe(rk.user);
    expect(c.state.toasts.map(t => t.text)).toContain(`Switched to the saves of the game that's running (${game}).`);
  });

  it("switches on the next try after Rekarina's save swap had save\\<uid> away for a moment", async () => {
    const hs = hookshot(), rk = rekarina();
    putSlot(path.join(rk.tx, 'ready-1')); // a finished save waiting to be swapped in
    const c = await tracker(hs.dir);
    // The swap: save\<uid> -> save-tx\old, then ready-1 -> save\<uid>. A try in between finds nothing.
    fs.renameSync(rk.user, path.join(rk.tx, 'old'));
    await c.followGame(rk.exe, 1);
    expect(c.state.saveDir).toBe(hs.user);
    fs.renameSync(path.join(rk.tx, 'ready-1'), rk.user);
    await c.followGame(rk.exe, 1);
    expect(c.state.saveDir).toBe(rk.user);
    expect(c.state.status).toBe('ok');
    expect(follows()).toEqual([`[follow] no saves found for ${rk.exe}`, `[follow] switched to ${rk.user}`]);
  });
});

describe('the game folder of a running exe', () => {
  it('works with Linux paths', () => {
    expect(gameFolderOfExe('/home/link/Games/Rekarina/game/Rekarina')).toBe('/home/link/Games/Rekarina');
    expect(gameFolderOfExe('/home/link/Applications/Hookshot/bin/hookshot')).toBe('/home/link/Applications/Hookshot');
    expect(gameFolderOfExe('/home/link/Games/Longshot/Longshot')).toBe('/home/link/Games/Longshot');
    expect(gameFolderOfExe('/opt/binaries/hookshot')).toBe('/opt/binaries'); // only a folder named bin or game
  });
  it.skipIf(process.platform !== 'win32')('works with Windows paths', () => {
    expect(gameFolderOfExe('D:\\Games\\Rekarina\\game\\Rekarina.exe')).toBe('D:\\Games\\Rekarina');
    expect(gameFolderOfExe('C:\\Games\\ReLink\\BIN\\relink-game.exe')).toBe('C:\\Games\\ReLink');
    expect(gameFolderOfExe('D:\\Games\\Longshot\\hookshot.exe')).toBe('D:\\Games\\Longshot');
  });
});
