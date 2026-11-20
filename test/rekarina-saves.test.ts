import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import { userFolderForExe, resolveUserFolders, candidateGameFolders, effectiveSaveFolder, listSlots, mostRecentSlot, isGameFolder } from '../src/gamedata/saves.js';
import { watchTarget, isSaveChange } from '../src/main/watcher.js';
import { parseGameData } from '../src/gamedata/parser.js';
import { Tracker, ChecklistFile, MappingFile } from '../src/core/tracker.js';
import { slotTitle, recentTitle } from '../src/renderer/slot-label.js';

// Made-up Rekarina installs in a temp directory (no real saves involved).
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-rekarina-'));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
const UID = 'd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0';

/** <root>\<name>\game\Rekarina.exe, and its profile with save\<uid>\slot_00..02. */
function install(name: string, { slots = ['slot_00', 'slot_01', 'slot_02'], tx = true } = {}) {
  const dir = path.join(root, name);
  const game = path.join(dir, 'game');
  const profile = path.join(game, 'profile');
  const user = path.join(profile, 'save', UID);
  fs.mkdirSync(game, { recursive: true });
  fs.writeFileSync(path.join(game, 'Rekarina.exe'), '');
  for (const s of slots) put(path.join(user, s));
  if (tx) fs.mkdirSync(path.join(profile, 'save-tx'), { recursive: true });
  return { dir, game, profile, user, exe: path.join(game, 'Rekarina.exe'), tx: path.join(profile, 'save-tx') };
}

function put(slotDir: string, mtime?: Date) {
  fs.mkdirSync(slotDir, { recursive: true });
  const f = path.join(slotDir, 'progress.sav');
  fs.writeFileSync(f, '');
  fs.writeFileSync(path.join(slotDir, 'caption.sav'), '');
  if (mtime) fs.utimesSync(f, mtime, mtime);
}

describe('finding a Rekarina install', () => {
  it('recognises the install folder and the game folder inside it', () => {
    const g = install('Rekarina');
    expect(isGameFolder(g.dir)).toBe(true);
    expect(isGameFolder(g.game)).toBe(true);
  });

  it('finds the save folder from the install, the game folder, the profile and save folders', () => {
    const g = install('Rekarina-a');
    for (const start of [g.dir, g.game, g.profile, path.join(g.profile, 'save'), g.user]) expect(resolveUserFolders(start)).toEqual([g.user]);
  });

  it("follows the running game's exe to game\\profile\\save\\<id>", () => {
    const g = install('Rekarina-b');
    expect(userFolderForExe(g.exe)).toBe(g.user);
  });

  it('looks under <drive>\\Games and <home>\\Games for folders named like Rekarina', () => {
    const drive = path.join(root, 'drive-d');
    const games = path.join(drive, 'Games');
    fs.mkdirSync(games, { recursive: true });
    fs.renameSync(install('Rekarina-c').dir, path.join(games, 'Rekarina 1.2.1'));
    fs.mkdirSync(path.join(games, 'Something else', 'game'), { recursive: true });
    const home = path.join(root, 'home');
    const found = candidateGameFolders(home, [drive], { platform: 'win32' });
    expect(found).toContain(path.join(games, 'Rekarina 1.2.1'));
    expect(found).not.toContain(path.join(games, 'Something else'));
    expect(found).toContain(path.join(home, 'Games', 'Rekarina'));
  });
});

describe("Rekarina's save journal", () => {
  it('uses save\\<id> when there is no save-tx folder, or nothing ready in it', () => {
    const none = install('J-none', { tx: false });
    expect(effectiveSaveFolder(none.user)).toBe(none.user);
    const empty = install('J-empty');
    expect(effectiveSaveFolder(empty.user)).toBe(empty.user);
  });

  it('uses the highest-numbered finished commit', () => {
    const g = install('J-ready');
    put(path.join(g.tx, 'ready-0000000001', 'slot_00'));
    put(path.join(g.tx, 'ready-0000000003', 'slot_00'));
    put(path.join(g.tx, 'ready-0000000002', 'slot_00'));
    expect(effectiveSaveFolder(g.user)).toBe(path.join(g.tx, 'ready-0000000003'));
  });

  it('skips a ready folder without slots, and never reads work, new or old', () => {
    const g = install('J-skip');
    put(path.join(g.tx, 'ready-0000000004', 'slot_00'));
    fs.mkdirSync(path.join(g.tx, 'ready-0000000009', 'slot_00'), { recursive: true }); // no progress.sav
    fs.mkdirSync(path.join(g.tx, 'ready-0000000010'), { recursive: true });
    for (const n of ['work', 'new', 'old']) put(path.join(g.tx, n, 'slot_00'));
    expect(effectiveSaveFolder(g.user)).toBe(path.join(g.tx, 'ready-0000000004'));
    const only = install('J-only-work');
    for (const n of ['work', 'new', 'old']) put(path.join(only.tx, n, 'slot_00'));
    expect(effectiveSaveFolder(only.user)).toBe(only.user);
  });

  it('lists the slots of the pending save, marked as pending, under the same names', () => {
    const g = install('J-list');
    const later = new Date(Date.now() + 60_000);
    for (const s of ['slot_00', 'slot_01', 'slot_02']) put(path.join(g.tx, 'ready-0000000007', s));
    put(path.join(g.tx, 'ready-0000000007', 'slot_01'), later);
    const slots = listSlots(g.user);
    expect(slots.map(s => [s.name, s.pending])).toEqual([['slot_00', true], ['slot_01', true], ['slot_02', true]]);
    expect(mostRecentSlot(slots).progress).toBe(path.join(g.tx, 'ready-0000000007', 'slot_01', 'progress.sav'));
    expect(listSlots(install('J-plain').user).every(s => !s.pending)).toBe(true);
  });

  it('follows a commit that lands: the same slots, back in save\\<id>', () => {
    const g = install('J-commit', { slots: [] });
    fs.mkdirSync(g.user, { recursive: true }); // no slots yet
    const ready = path.join(g.tx, 'ready-0000000002');
    put(path.join(ready, 'slot_00'));
    expect(resolveUserFolders(g.game)).toEqual([g.user]); // first save, still parked
    expect(listSlots(g.user)[0].pending).toBe(true);
    // The game's swap: save\<id> -> save-tx\old, ready-<n> -> save\<id>.
    fs.rmSync(g.user, { recursive: true, force: true });
    fs.renameSync(ready, g.user);
    expect(listSlots(g.user).map(s => [s.dir, s.pending])).toEqual([[path.join(g.user, 'slot_00'), undefined]]);
  });

  it('marks pending slots in the slot picker details', () => {
    expect(slotTitle({ name: 'slot_00', mtimeMs: 1, pending: true })).toMatch(/waiting for the game/);
    expect(recentTitle({ name: 'slot_00', mtimeMs: 1, pending: true })).toMatch(/^Slot 0 · .*waiting for the game/);
    expect(slotTitle({ name: 'slot_00', mtimeMs: 1 })).toBeUndefined();
  });
});

describe('watching Rekarina saves', () => {
  it('watches the profile folder, never save\\<id> itself', () => {
    const g = install('W-rek');
    expect(watchTarget(g.user)).toEqual({ dir: g.profile, journal: true });
  });

  it('keeps watching the user folder itself for the other games', () => {
    const user = path.join(root, 'Hookshot', 'user', 'save', UID);
    put(path.join(user, 'slot_00'));
    expect(watchTarget(user)).toEqual({ dir: user, journal: false });
  });

  it("reacts to committed and finished saves, not to the game's working copy or backups", () => {
    for (const f of ['save', `save\\${UID}\\slot_00\\progress.sav`, 'save-tx\\ready-0000000003', 'save-tx\\ready-0000000003\\slot_00\\caption.sav', null])
      expect(isSaveChange(f, true)).toBe(true);
    for (const f of ['save-tx\\work\\slot_00\\progress.sav', 'save-tx\\new\\slot_00\\progress.sav', 'save-tx\\old', 'save-backup\\20261119-120000-000\\slot_00\\progress.sav', 'account.uid'])
      expect(isSaveChange(f, true)).toBe(false);
    expect(isSaveChange('slot_00\\progress.sav', false)).toBe(true);
    expect(isSaveChange('slot_00\\tmp', false)).toBe(false);
  });
});

// The reviewer's copy of real Rekarina 1.2.1 saves: REKARINA_REF=<...>\rekarina-ref\save. Game data, never committed.
const REF = process.env.REKARINA_REF;
describe.skipIf(!REF || !fs.existsSync(REF))('real Rekarina saves', () => {
  it('parses every slot without warnings, and the tracker evaluates it', () => {
    const users = resolveUserFolders(REF!);
    expect(users).toHaveLength(1);
    const slots = listSlots(users[0]);
    expect(slots.length).toBeGreaterThan(0);
    const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
    const tracker = new Tracker(read('data/checklist.json') as ChecklistFile, read('data/save-mapping.json') as MappingFile);
    for (const s of slots) {
      const data = parseGameData(fs.readFileSync(s.progress));
      expect(data.warnings, s.name).toEqual([]);
      expect(data.entries.size, s.name).toBeGreaterThan(10_000);
      const { summary, categories } = tracker.evaluate(data);
      expect(categories.length).toBeGreaterThan(0);
      expect(summary.totalA).toBeGreaterThan(250);
    }
  });
});
