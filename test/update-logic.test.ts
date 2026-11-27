import { describe, it, expect } from 'vitest';
import {
  detectMode, compareVersions, sanitizeUpdates, parseLatestRelease,
  UPDATES_DEFAULTS, autoCheckArms, RELEASES_URL,
} from '../src/main/update-logic';

describe('detectMode', () => {
  it('running from source is always off', () => {
    expect(detectMode({}, 'win32', false)).toBe('off');
    expect(detectMode({}, 'linux', false)).toBe('off');
    expect(detectMode({ APPIMAGE: '/x/AppImage' }, 'linux', false)).toBe('off');
    expect(detectMode({ PORTABLE_EXECUTABLE_DIR: 'C:/p' }, 'win32', false)).toBe('off');
  });
  it('packaged Windows: portable → check-only, installed → full', () => {
    expect(detectMode({ PORTABLE_EXECUTABLE_DIR: 'C:/portable' }, 'win32', true)).toBe('check-only');
    expect(detectMode({}, 'win32', true)).toBe('full');
    expect(detectMode({ PORTABLE_EXECUTABLE_DIR: '' }, 'win32', true)).toBe('full'); // empty = not set
  });
  it('packaged Linux: AppImage → full, tar.gz → check-only', () => {
    expect(detectMode({ APPIMAGE: '/opt/AppImage' }, 'linux', true)).toBe('full');
    expect(detectMode({}, 'linux', true)).toBe('check-only');
  });
  it('an unverified platform never installs: check-only', () => {
    expect(detectMode({}, 'darwin', true)).toBe('check-only');
  });
});

describe('autoCheckArms', () => {
  it('no automatic check when mode is off or the toggle is off', () => {
    expect(autoCheckArms('off', true)).toBe(false);
    expect(autoCheckArms('off', false)).toBe(false);
    expect(autoCheckArms('full', false)).toBe(false);
    expect(autoCheckArms('check-only', false)).toBe(false);
  });
  it('automatic check when enabled and the mode allows it', () => {
    expect(autoCheckArms('full', true)).toBe(true);
    expect(autoCheckArms('check-only', true)).toBe(true);
  });
});

describe('compareVersions', () => {
  it('compares major/minor/patch numerically', () => {
    expect(compareVersions('0.5.1', '0.5.2')).toBe(-1);
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
    expect(compareVersions('1.0.0', '0.99.99')).toBe(1);
    expect(compareVersions('0.5.2', '0.5.2')).toBe(0);
  });
  it('ignores a leading v (either side)', () => {
    expect(compareVersions('v0.5.1', '0.5.1')).toBe(0);
    expect(compareVersions('v0.5.1', '0.6.0')).toBe(-1);
    expect(compareVersions('0.6.0', 'v0.5.1')).toBe(1);
  });
  it('treats a pre-release as older than the same plain version', () => {
    expect(compareVersions('0.6.0-alpha', '0.6.0')).toBe(-1);
    expect(compareVersions('0.6.0', '0.6.0-alpha')).toBe(1);
  });
  it('orders pre-releases among themselves', () => {
    expect(compareVersions('0.6.0-alpha', '0.6.0-beta')).toBe(-1);
    expect(compareVersions('0.6.0-1', '0.6.0-2')).toBe(-1);
    expect(compareVersions('0.6.0-2', '0.6.0-10')).toBe(-1);
    expect(compareVersions('0.6.0-alpha.1', '0.6.0-alpha')).toBe(1); // more fields = newer
  });
  it('a newer pre-release can still beat an older plain version is false: core wins first', () => {
    expect(compareVersions('0.6.0-alpha', '0.5.9')).toBe(1); // 0.6.0 core > 0.5.9 core
  });
  it('returns 0 for unparseable input (never claims an update we can\'t read)', () => {
    expect(compareVersions('garbage', '0.5.1')).toBe(0);
    expect(compareVersions('0.5.1', '')).toBe(0);
    expect(compareVersions('abc', 'def')).toBe(0);
  });
  it('handles missing minor/patch as zero', () => {
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.3')).toBe(-1);
  });
});

describe('sanitizeUpdates', () => {
  it('missing input → defaults (off)', () => {
    expect(sanitizeUpdates(undefined)).toEqual(UPDATES_DEFAULTS);
    expect(sanitizeUpdates(null)).toEqual(UPDATES_DEFAULTS);
    expect(sanitizeUpdates('x')).toEqual(UPDATES_DEFAULTS);
    expect(sanitizeUpdates(7)).toEqual(UPDATES_DEFAULTS);
  });
  it('wrong types → defaults', () => {
    expect(sanitizeUpdates({ check: 'yes', autoDownload: 1 })).toEqual(UPDATES_DEFAULTS);
    expect(sanitizeUpdates({ check: false, autoDownload: false })).toEqual(UPDATES_DEFAULTS);
  });
  it('booleans pass through', () => {
    expect(sanitizeUpdates({ check: true, autoDownload: true })).toEqual({ check: true, autoDownload: true });
    expect(sanitizeUpdates({ check: true })).toEqual({ check: true, autoDownload: false });
  });
  it('skipVersion: kept when a non-empty string, trimmed, dropped otherwise', () => {
    expect(sanitizeUpdates({ check: false, skipVersion: '0.6.0' }).skipVersion).toBe('0.6.0');
    expect(sanitizeUpdates({ skipVersion: '  0.6.0  ' }).skipVersion).toBe('0.6.0');
    expect(sanitizeUpdates({ skipVersion: '' }).skipVersion).toBeUndefined();
    expect(sanitizeUpdates({ skipVersion: '   ' }).skipVersion).toBeUndefined();
    expect(sanitizeUpdates({ skipVersion: 0.6 }).skipVersion).toBeUndefined();
    expect(sanitizeUpdates({ skipVersion: ['0.6.0'] }).skipVersion).toBeUndefined();
  });
});

describe('parseLatestRelease', () => {
  it('a normal GitHub releases/latest reply', () => {
    const r = parseLatestRelease({
      tag_name: 'v0.5.1',
      name: 'v0.5.1',
      body: 'In-app updates\n',
      html_url: 'https://github.com/LucieTheFool/boomerang-tracker/releases/tag/v0.5.1',
    });
    expect(r).toEqual({ version: '0.5.1', url: 'https://github.com/LucieTheFool/boomerang-tracker/releases/tag/v0.5.1', notes: 'In-app updates\n' });
  });
  it('drops the v prefix but keeps a tag that has none', () => {
    expect(parseLatestRelease({ tag_name: 'v1.2.3', html_url: 'u' })?.version).toBe('1.2.3');
    expect(parseLatestRelease({ tag_name: '1.2.3', html_url: 'u' })?.version).toBe('1.2.3');
  });
  it('missing html_url → the releases page as fallback', () => {
    expect(parseLatestRelease({ tag_name: 'v0.5.1' })?.url).toBe(RELEASES_URL);
    expect(parseLatestRelease({ tag_name: 'v0.5.1', html_url: '' })?.url).toBe(RELEASES_URL);
  });
  it('missing body → empty notes', () => {
    expect(parseLatestRelease({ tag_name: 'v0.5.1', html_url: 'u' })?.notes).toBe('');
  });
  it('garbage / missing tag_name → null', () => {
    expect(parseLatestRelease(null)).toBeNull();
    expect(parseLatestRelease('v0.5.1')).toBeNull();
    expect(parseLatestRelease({})).toBeNull();
    expect(parseLatestRelease({ tag_name: '' })).toBeNull();
    expect(parseLatestRelease({ tag_name: 5 })).toBeNull();
  });
});
