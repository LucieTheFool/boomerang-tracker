import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import { userFolderForExe } from '../src/gamedata/saves.js';

// Made-up game folders in a temp directory (no real saves involved).
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-saves-'));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
const PROFILE = '0123456789abcdef0123456789abcdef';
function gameFolder(name: string, { bin = false, saves = true } = {}) {
  const dir = path.join(root, name);
  const exeDir = bin ? path.join(dir, 'bin') : dir;
  fs.mkdirSync(exeDir, { recursive: true });
  fs.writeFileSync(path.join(exeDir, 'hookshot.exe'), '');
  if (saves) {
    const slot = path.join(dir, 'user', 'save', PROFILE, 'slot_00');
    fs.mkdirSync(slot, { recursive: true });
    fs.writeFileSync(path.join(slot, 'progress.sav'), '');
  }
  return { exe: path.join(exeDir, 'hookshot.exe'), user: path.join(dir, 'user', 'save', PROFILE) };
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
  it('gives nothing when that install has no saves yet', () => {
    expect(userFolderForExe(gameFolder('Fresh', { saves: false }).exe)).toBeNull();
  });
});
