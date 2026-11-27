// Pure parts of in-app updates: which mode a build runs in, version comparison,
// settings sanitation, and parsing the GitHub releases/latest reply. No Electron,
// no Node — fully unit-testable (test/update-logic.test.ts).
import type { UpdateMode } from '../shared/types.js';

/** The updates block of Settings. */
export interface UpdatesSettings {
  check: boolean;
  autoDownload: boolean;
  /** A release the user chose to ignore; the check won't nag about it again. */
  skipVersion?: string;
}

/** Defaults: off until the user opts in (their decision). */
export const UPDATES_DEFAULTS: UpdatesSettings = { check: false, autoDownload: false };

/**
 * Which in-app update path a build uses, detected once at startup.
 * - running from source (not packaged) → off
 * - Windows: portable (PORTABLE_EXECUTABLE_DIR set) → check-only, otherwise full
 * - Linux: AppImage (APPIMAGE set) → full, otherwise check-only
 * - any other platform → check-only (never auto-install an unverified build)
 */
export function detectMode(env: NodeJS.ProcessEnv, platform: NodeJS.Platform, isPackaged: boolean): UpdateMode {
  if (!isPackaged) return 'off';
  if (platform === 'win32') return env.PORTABLE_EXECUTABLE_DIR ? 'check-only' : 'full';
  if (platform === 'linux') return env.APPIMAGE ? 'full' : 'check-only';
  return 'check-only';
}

/**
 * True when the app should schedule its automatic checks (startup + every 6 h).
 * off when the mode is off or the user's "check" toggle is off — then no request
 * is ever made automatically. A manual "Check now" bypasses this and always runs.
 */
export function autoCheckArms(mode: UpdateMode, check: boolean): boolean {
  return mode !== 'off' && check;
}

function parseVer(v: string): { nums: [number, number, number]; pre: (string | number)[] } | null {
  let s = v.trim();
  if (s.startsWith('v') || s.startsWith('V')) s = s.slice(1);
  const m = s.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!m) return null;
  const nums: [number, number, number] = [Number(m[1]), m[2] !== undefined ? Number(m[2]) : 0, m[3] !== undefined ? Number(m[3]) : 0];
  const pre: (string | number)[] = m[4] ? m[4].split('.').map(p => (/^\d+$/.test(p) ? Number(p) : p)) : [];
  return { nums, pre };
}

function comparePre(a: (string | number)[], b: (string | number)[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1; // no pre-release = newer than a pre-release of the same core
  if (b.length === 0) return -1;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1;
    if (typeof x === 'number') return -1; // numeric identifiers sort before alphanumeric
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
}

/**
 * Compare two semver-ish versions (an optional leading "v" is ignored).
 * Returns -1, 0 or 1. A pre-release is older than the same plain version.
 * Unparseable input compares equal (0): we never claim an update we can't read.
 */
export function compareVersions(a: string, b: string): number {
  const va = parseVer(a), vb = parseVer(b);
  if (!va || !vb) return 0;
  for (let i = 0; i < 3; i++) if (va.nums[i] !== vb.nums[i]) return va.nums[i] < vb.nums[i] ? -1 : 1;
  return comparePre(va.pre, vb.pre);
}

/** Sanitise the stored updates block the same way the pad toggle is repaired. */
export function sanitizeUpdates(raw: unknown): UpdatesSettings {
  if (typeof raw !== 'object' || raw === null) return { ...UPDATES_DEFAULTS };
  const r = raw as Record<string, unknown>;
  const out: UpdatesSettings = { check: r.check === true, autoDownload: r.autoDownload === true };
  if (typeof r.skipVersion === 'string' && r.skipVersion.trim()) out.skipVersion = r.skipVersion.trim();
  return out;
}

/** The public release page, used when a reply has no usable html_url. */
export const RELEASES_URL = 'https://github.com/LucieTheFool/boomerang-tracker/releases/latest';

/**
 * Convert a GitHub releases/latest JSON reply into { version, url, notes },
 * or null when it isn't a usable release (missing/garbage tag_name).
 * The version drops any leading "v".
 */
export function parseLatestRelease(json: unknown): { version: string; url: string; notes: string } | null {
  if (typeof json !== 'object' || json === null) return null;
  const r = json as Record<string, unknown>;
  if (typeof r.tag_name !== 'string' || !r.tag_name.trim()) return null;
  const version = r.tag_name.trim().replace(/^[vV]/, '');
  const url = typeof r.html_url === 'string' && r.html_url.trim() ? r.html_url.trim() : RELEASES_URL;
  const notes = typeof r.body === 'string' ? r.body : '';
  return { version, url, notes };
}
