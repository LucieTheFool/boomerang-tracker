import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

// electron-builder (v26) adds a platform's plain-string `files` to its own first matcher, ahead of the
// top-level list; a first matcher made only of `!` patterns gets `**/*` in front, i.e. the whole repo
// (src/, docs/, scripts/ …) goes into the package. So every platform list must carry the positive
// patterns itself. The reviewer re-checks the real app.asar; this guards the config.
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const build = pkg.build;
const top: string[] = build.files;
const positives = (list: string[]) => list.filter(p => !p.startsWith('!'));
const platformLists = Object.entries(build)
  .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v) && Array.isArray((v as { files?: unknown }).files))
  .map(([k, v]) => [k, (v as { files: unknown[] }).files] as const);

describe('package files', () => {
  it('top-level files is exactly the app output, data and package.json, without local data', () => {
    expect(top).toEqual([
      'dist/**',
      'dist-electron/**',
      '!dist-electron/*.map',
      'data/**',
      '!data/checklist.local.json',
      'package.json',
    ]);
  });

  it('linux.files repeats the top-level patterns and still leaves koffi out', () => {
    const linux: string[] = build.linux?.files;
    if (!linux) return;
    for (const p of top) expect(linux).toContain(p);
    expect(positives(linux)).toEqual(positives(top));
    expect(linux).toContain('!node_modules/koffi/**');
  });

  it('Linux window association: desktopName is set and synced to the .desktop file', () => {
    expect(pkg.desktopName).toBe('boomerang-tracker.desktop');
    expect(build.linux.syncDesktopName).toBe(true);
  });

  it('no platform files list is only negations', () => {
    for (const [name, list] of platformLists) {
      expect(list.every(p => typeof p === 'string'), `${name}.files has non-string entries`).toBe(true);
      expect(positives(list as string[]).length, `${name}.files is only negations`).toBeGreaterThan(0);
      expect(list, `${name}.files may package checklist.local.json`).toContain('!data/checklist.local.json');
    }
  });
});
