import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import { userFolderForExe, resolveUserFolders, OOT_TITLE_ID } from '../src/gamedata/saves.js';

// Made-up game folders in a temp directory (no real saves involved).
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-saves-'));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
const PROFILE = '0123456789abcdef0123456789abcdef';
function gameFolder(name: string, { bin = false, saves = true, exe = 'hookshot.exe' } = {}) {
  const dir = path.join(root, name);
  const exeDir = bin ? path.join(dir, 'bin') : dir;
  fs.mkdirSync(exeDir, { recursive: true });
  fs.writeFileSync(path.join(exeDir, exe), '');
  if (saves) {
    const slot = path.join(dir, 'user', 'save', PROFILE, 'slot_00');
    fs.mkdirSync(slot, { recursive: true });
    fs.writeFileSync(path.join(slot, 'progress.sav'), '');
  }
  return { exe: path.join(exeDir, exe), user: path.join(dir, 'user', 'save', PROFILE) };
}

describe('the running game\'s save folder', () => {
  it('finds it next to the exe (Longshot, Hookshot builds)', () => {
    const g = gameFolder('Longshot');
    expect(userFolderForExe(g.exe)).toBe(g.user);
  });
  it('finds it when the exe is in bin\\', () => {
    const g = gameFolder('Hookshot', { bin: true });
    expect(userFolderForExe(g.exe)).toBe(g.user);
  });
  it('finds it next to Triforce.exe (NX2navi builds)', () => {
    const g = gameFolder('Triforce', { exe: 'Triforce.exe' });
    expect(userFolderForExe(g.exe)).toBe(g.user);
  });
  it('finds it next to bin\\relink-game.exe (Project ReLink builds)', () => {
    const g = gameFolder('ReLink', { bin: true, exe: 'relink-game.exe' });
    expect(userFolderForExe(g.exe)).toBe(g.user);
  });
  it('gives nothing when that install has no saves yet', () => {
    expect(userFolderForExe(gameFolder('Fresh', { saves: false }).exe)).toBeNull();
  });
});

describe("an emulator's save folders", () => {
  const ACCOUNT = 'FEDCBA9876543210FEDCBA9876543210'; // made up
  function emulatorData(root2: string, titles: string[]) {
    const out: Record<string, string> = {};
    for (const t of titles) {
      const dir = path.join(root2, 'nand', 'user', 'save', '0000000000000000', ACCOUNT, t);
      fs.mkdirSync(path.join(dir, 'slot_00'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'slot_00', 'progress.sav'), '');
      out[t] = dir;
    }
    return out;
  }

  it("finds Ocarina of Time's title folder in the data folder, and only that one", () => {
    const d = emulatorData(path.join(root, 'fritchii'), [OOT_TITLE_ID, '0100000000010000']);
    expect(resolveUserFolders(path.join(root, 'fritchii'))).toEqual([d[OOT_TITLE_ID]]);
  });
  it('finds it from any folder on the way down', () => {
    const data = path.join(root, 'fritchii2');
    const d = emulatorData(data, [OOT_TITLE_ID]);
    for (const start of [path.join(data, 'nand', 'user', 'save'), path.join(data, 'nand', 'user', 'save', '0000000000000000'), path.dirname(d[OOT_TITLE_ID]), d[OOT_TITLE_ID]])
      expect(resolveUserFolders(start)).toEqual([d[OOT_TITLE_ID]]);
  });
  it('follows a running emulator to its portable user folder or its data folder', () => {
    const exeDir = path.join(root, 'Fritchii-v1');
    fs.mkdirSync(exeDir, { recursive: true });
    const exe = path.join(exeDir, 'lichii.exe');
    fs.writeFileSync(exe, '');
    const appData = path.join(root, 'AppData');
    const windows = { platform: 'win32' as const, env: { APPDATA: appData } };
    const inData = emulatorData(path.join(appData, 'fritchii'), [OOT_TITLE_ID])[OOT_TITLE_ID];
    expect(userFolderForExe(exe, windows)).toBe(inData);
    const portable = emulatorData(path.join(exeDir, 'user'), [OOT_TITLE_ID])[OOT_TITLE_ID];
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(path.join(portable, 'slot_00', 'progress.sav'), later, later);
    expect(userFolderForExe(exe, windows)).toBe(portable); // the most recently played one
  });
});
