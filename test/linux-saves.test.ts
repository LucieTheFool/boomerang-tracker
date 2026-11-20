import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterAll, afterEach, vi } from 'vitest';
import { autoDetectUserFolder, candidateGameFolders, isGameFolder, resolveUserFolders, OOT_TITLE_ID, type Host } from '../src/gamedata/saves.js';

// Made-up Linux home folders in a temp directory (no real saves involved). The platform,
// home and environment are injected, so this runs the same on Windows and Linux.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-linux-'));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
afterEach(() => vi.restoreAllMocks());
const UID = '0123456789abcdef0123456789abcdef';
const ACCOUNT = 'FEDCBA9876543210FEDCBA9876543210'; // made up
let n = 0;

function newHome() {
  const home = path.join(root, `home-${++n}`);
  fs.mkdirSync(home, { recursive: true });
  return home;
}

/** A user folder with slot_00/progress.sav, saved `hoursAgo` ago. */
function user(dir: string, hoursAgo = 1) {
  const slot = path.join(dir, 'slot_00');
  fs.mkdirSync(slot, { recursive: true });
  const f = path.join(slot, 'progress.sav');
  fs.writeFileSync(f, '');
  const t = new Date(Date.now() - hoursAgo * 3600_000);
  fs.utimesSync(f, t, t);
  return dir;
}

const linux = (home: string, env: NodeJS.ProcessEnv = {}): Partial<Host> => ({ platform: 'linux', home, env });
const candidates = (home: string, env: NodeJS.ProcessEnv = {}) => candidateGameFolders(home, undefined, linux(home, env));

/** Hookshot's documented Linux saves: ~/.local/share/hookshot/save/<user id>/. */
const hookshotSaves = (data: string, hoursAgo?: number) => user(path.join(data, 'hookshot', 'save', UID), hoursAgo);
/** An emulator's nand layout inside its data folder. */
const emulatorSaves = (data: string, title = OOT_TITLE_ID, hoursAgo?: number) =>
  user(path.join(data, 'nand', 'user', 'save', '0000000000000000', ACCOUNT, title), hoursAgo);
/** A Rekarina install (no program file: its Linux name isn't known) with game/profile/save/<id>. */
function rekarina(dir: string, hoursAgo?: number) {
  fs.mkdirSync(path.join(dir, 'game', 'profile', 'save-tx'), { recursive: true });
  return user(path.join(dir, 'game', 'profile', 'save', UID), hoursAgo);
}

describe('finding saves on Linux', () => {
  it("finds Hookshot's ~/.local/share/hookshot/save/<id>", () => {
    const home = newHome();
    const u = hookshotSaves(path.join(home, '.local', 'share'));
    expect(candidates(home)).toContain(path.join(home, '.local', 'share', 'hookshot'));
    expect(resolveUserFolders(path.join(home, '.local', 'share', 'hookshot'))).toEqual([u]);
    expect(autoDetectUserFolder(linux(home))).toBe(u);
  });

  it('uses $XDG_DATA_HOME instead of ~/.local/share when it is set to an absolute path', () => {
    const home = newHome();
    const data = path.join(home, 'xdg-data');
    const u = hookshotSaves(data);
    const found = candidates(home, { XDG_DATA_HOME: data });
    expect(found).toContain(path.join(data, 'hookshot'));
    expect(found).not.toContain(path.join(home, '.local', 'share', 'hookshot'));
    expect(autoDetectUserFolder(linux(home, { XDG_DATA_HOME: data }))).toBe(u);
    // Not absolute: ignored, as the XDG spec says.
    expect(candidates(home, { XDG_DATA_HOME: 'xdg-data' })).toContain(path.join(home, '.local', 'share', 'hookshot'));
  });

  it("finds an emulator's saves in ~/.config, $XDG_CONFIG_HOME and Flatpak's ~/.var/app/<id>", () => {
    const home = newHome();
    const inConfig = emulatorSaves(path.join(home, '.config', 'fritchii'));
    expect(autoDetectUserFolder(linux(home))).toBe(inConfig);

    const cfg = path.join(home, 'xdg-config');
    const inXdg = emulatorSaves(path.join(cfg, 'lichii'));
    expect(candidates(home, { XDG_CONFIG_HOME: cfg })).toContain(path.join(cfg, 'lichii'));
    expect(resolveUserFolders(path.join(cfg, 'lichii'))).toEqual([inXdg]);

    const app = path.join(home, '.var', 'app', 'io.example.Fritchii');
    const inFlatpak = emulatorSaves(path.join(app, 'data', 'fritchii'), OOT_TITLE_ID, 0.5);
    emulatorSaves(path.join(app, 'config', 'fritchii'), '0100000000010000', 0.1); // another game: never counts
    const found = candidates(home);
    expect(found).toContain(path.join(app, 'data', 'fritchii'));
    expect(found).toContain(path.join(app, 'config', 'fritchii'));
    expect(autoDetectUserFolder(linux(home))).toBe(inFlatpak);
  });

  it('finds a Flatpak build of Hookshot in its own data folder', () => {
    const home = newHome();
    const u = hookshotSaves(path.join(home, '.var', 'app', 'io.example.Hookshot', 'data'));
    expect(autoDetectUserFolder(linux(home))).toBe(u);
  });

  it('finds a Rekarina-layout folder under ~/Games by its save layout, with no program file', () => {
    const home = newHome();
    const dir = path.join(home, 'Games', 'Rekarina 1.2.1');
    const u = rekarina(dir);
    rekarina(path.join(home, 'Games', 'Something else')); // not named like one of the games
    const found = candidates(home);
    expect(found).toContain(dir);
    expect(found).not.toContain(path.join(home, 'Games', 'Something else'));
    expect(isGameFolder(dir, 'linux')).toBe(true);
    expect(isGameFolder(dir, 'win32')).toBe(false); // Windows still wants the exe
    expect(autoDetectUserFolder(linux(home))).toBe(u);
  });

  it('recognises the Linux programs (no .exe) as files only', () => {
    const home = newHome();
    const longshot = path.join(home, 'Applications', 'Longshot-1.0');
    fs.mkdirSync(longshot, { recursive: true });
    fs.writeFileSync(path.join(longshot, 'Longshot'), '');
    const relink = path.join(home, 'Games', 'relink-build');
    fs.mkdirSync(path.join(relink, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(relink, 'bin', 'relink-game'), '');
    const notAGame = path.join(home, 'Games', 'hookshot-notes');
    fs.mkdirSync(path.join(notAGame, 'hookshot'), { recursive: true }); // a folder, not the program
    expect(isGameFolder(longshot, 'linux')).toBe(true);
    expect(isGameFolder(relink, 'linux')).toBe(true);
    expect(isGameFolder(notAGame, 'linux')).toBe(false);
    const found = candidates(home);
    expect(found).toEqual(expect.arrayContaining([longshot, relink]));
    expect(found).not.toContain(notAGame);
  });

  it('uses no drive letters: everything it looks at is under the home folder', () => {
    const home = newHome();
    hookshotSaves(path.join(home, '.local', 'share'));
    fs.mkdirSync(path.join(home, '.var', 'app', 'io.example.App'), { recursive: true });
    const looked: string[] = [];
    for (const f of ['readdirSync', 'existsSync', 'statSync'] as const) {
      const real = fs[f] as unknown as (...a: unknown[]) => unknown;
      vi.spyOn(fs, f).mockImplementation(((p: unknown, ...rest: unknown[]) => { looked.push(String(p)); return real.call(fs, p, ...rest); }) as never);
    }
    const found = candidates(home);
    autoDetectUserFolder(linux(home));
    expect(looked.length).toBeGreaterThan(0);
    expect(looked.filter(p => !p.startsWith(home))).toEqual([]);
    expect(found.filter(p => !p.startsWith(home))).toEqual([]);
    expect(found.filter(p => /QuiverLauncher/.test(p))).toEqual([]);
  });

  it('picks the newest save across all of them', () => {
    const home = newHome();
    const hs = hookshotSaves(path.join(home, '.local', 'share'), 3);
    emulatorSaves(path.join(home, '.var', 'app', 'io.example.Fritchii', 'data', 'fritchii'), OOT_TITLE_ID, 2);
    const rk = rekarina(path.join(home, 'Games', 'Rekarina'), 1);
    expect(autoDetectUserFolder(linux(home))).toBe(rk);
    const now = new Date();
    fs.utimesSync(path.join(hs, 'slot_00', 'progress.sav'), now, now);
    expect(autoDetectUserFolder(linux(home))).toBe(hs);
  });
});
