// Settings live in <userData>/settings.json. Written atomically (temp file + rename).
import fs from 'node:fs';
import path from 'node:path';
import { NO_FILTERS } from '../shared/types.js';
import type { UiPrefs, IdentifyRequest, OverlayMode, AvailableFilters } from '../shared/types.js';
import type { LearnedGroup } from '../core/pools.js';

export interface OverlaySettings {
  bounds?: { x: number; y: number; width: number; height: number };
  opacity: number;
  locked: boolean;
  mode: OverlayMode;
}

export interface Settings {
  saveDir?: string;
  /** null = follow the most recently saved slot */
  pinnedSlot: string | null;
  /** manual ticks: "<userDir>|<slot>" -> item id -> true */
  manual: Record<string, Record<string, boolean>>;
  ui: UiPrefs;
  devPanel: boolean;
  mainBounds?: { x: number; y: number; width: number; height: number };
  overlay: OverlaySettings;
  hotkeys: { toggleOverlay: string; lockOverlay: string };
  /** Answers to "which one was this?": flags -> checklist rows. Game facts, so not per slot. */
  learned: LearnedGroup[];
  /** Questions not answered yet (kept across restarts) */
  pendingIdentify: IdentifyRequest[];
  /** Read progress live from a running Hookshot, Longshot, NX2navi, ReLink or Fritchii (read-only). hint = last table address, hints = the last few. */
  live: { enabled: boolean; hint?: string; hints?: string[] };
  /** Keep a local log of every tracked change (logs/changes-YYYY-MM.jsonl). */
  changeLog: boolean;
}

export const DEFAULTS: Settings = {
  pinnedSlot: null,
  manual: {},
  ui: { hideCollected: false, hiddenCategories: [], collapsed: [], showParts: { B: true, C: false } },
  devPanel: false,
  overlay: { opacity: 0.85, locked: true, mode: 'counters' },
  hotkeys: { toggleOverlay: 'Control+Shift+O', lockOverlay: 'Control+Shift+L' },
  learned: [],
  pendingIdentify: [],
  live: { enabled: true },
  changeLog: true,
};

const HEX = /^[0-9a-f]{1,16}$/i;
const OVERLAY_MODES: readonly unknown[] = ['counters', 'remaining', 'available'] satisfies OverlayMode[];
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isHex = (x: unknown): x is string => typeof x === 'string' && HEX.test(x);
const isString = (x: unknown): x is string => typeof x === 'string';
const bool = (x: unknown, fallback: boolean) => (typeof x === 'boolean' ? x : fallback);
const text = (x: unknown, fallback: string) => (isString(x) ? x : fallback);
const textOrNull = (x: unknown, fallback: string | null) => (x === null || isString(x) ? x : fallback);
const strings = (x: unknown, fallback: string[]) => (Array.isArray(x) ? x.filter(isString) : [...fallback]);

// The clean* functions below repair what a hand-edited or older settings.json may hold: a field
// of the wrong type gets its default, and fields we don't know are kept.

/** Live table hints: hex only (a bad one would fail every attach). */
export function cleanLive(raw: unknown): Settings['live'] {
  const { hint, hints, ...rest } = isObj(raw) ? raw : {};
  const out: Settings['live'] = { ...rest, enabled: rest.enabled !== false };
  const good = Array.isArray(hints) ? hints.filter(isHex) : [];
  if (good.length) out.hints = good;
  if (isHex(hint)) out.hint = hint;
  return out;
}

export function cleanFilters(raw: unknown): AvailableFilters {
  const f = isObj(raw) ? raw : {};
  return {
    ...f,
    search: text(f.search, NO_FILTERS.search),
    area: textOrNull(f.area, NO_FILTERS.area),
    category: textOrNull(f.category, NO_FILTERS.category),
    age: f.age === 'child' || f.age === 'adult' || f.age === null ? f.age : NO_FILTERS.age,
    nightOnly: bool(f.nightOnly, NO_FILTERS.nightOnly),
    hereOnly: bool(f.hereOnly, NO_FILTERS.hereOnly),
  };
}

export function cleanUi(raw: unknown): UiPrefs {
  const { availableHeight, availableFilters, ...rest } = isObj(raw) ? raw : {};
  const d = DEFAULTS.ui;
  const parts = isObj(rest.showParts) ? rest.showParts : {};
  const out: UiPrefs = {
    ...rest,
    hideCollected: bool(rest.hideCollected, d.hideCollected),
    hiddenCategories: strings(rest.hiddenCategories, d.hiddenCategories),
    collapsed: strings(rest.collapsed, d.collapsed),
    showParts: { ...parts, B: bool(parts.B, d.showParts.B), C: bool(parts.C, d.showParts.C) },
  };
  if (typeof availableHeight === 'number' && Number.isFinite(availableHeight) && availableHeight > 0) out.availableHeight = availableHeight;
  if (isObj(availableFilters)) out.availableFilters = cleanFilters(availableFilters);
  return out;
}

export function cleanOverlay(raw: unknown): OverlaySettings {
  const o = isObj(raw) ? raw : {};
  const d = DEFAULTS.overlay;
  return {
    ...o,
    opacity: typeof o.opacity === 'number' && o.opacity >= 0 && o.opacity <= 1 ? o.opacity : d.opacity,
    locked: bool(o.locked, d.locked),
    mode: OVERLAY_MODES.includes(o.mode) ? (o.mode as OverlayMode) : d.mode,
  };
}

export function cleanHotkeys(raw: unknown): Settings['hotkeys'] {
  const h = isObj(raw) ? raw : {};
  const d = DEFAULTS.hotkeys;
  // An empty string is valid: that shortcut is turned off.
  return { ...h, toggleOverlay: text(h.toggleOverlay, d.toggleOverlay), lockOverlay: text(h.lockOverlay, d.lockOverlay) };
}

/**
 * Older versions used ids like "gold_skulltulas.055_<description>"; they are
 * now "gold_skulltulas.055". Rewrites hand ticks, identified spots and open questions.
 * Returns true if anything changed.
 */
export function migrateIds(s: Settings): boolean {
  const re = /^(gold_skulltulas|heart_pieces)\.(\d{3})_.+$/;
  const fix = (id: string) => id.replace(re, '$1.$2');
  let changed = false;
  for (const [slot, ticks] of Object.entries(s.manual ?? {})) {
    const next: Record<string, boolean> = {};
    for (const [id, v] of Object.entries(ticks)) { const n = fix(id); if (n !== id) changed = true; next[n] = v; }
    s.manual[slot] = next;
  }
  for (const g of s.learned ?? []) g.items = g.items.map(id => { const n = fix(id); if (n !== id) changed = true; return n; });
  for (const q of s.pendingIdentify ?? []) for (const c of q.candidates) { const n = fix(c.id); if (n !== c.id) { changed = true; c.id = n; } }
  return changed;
}

export class SettingsStore {
  data: Settings;
  constructor(private file: string) {
    this.data = structuredClone(DEFAULTS);
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isObj(raw)) return;
      this.data = { ...this.data, ...raw, ui: cleanUi(raw.ui), overlay: cleanOverlay(raw.overlay), hotkeys: cleanHotkeys(raw.hotkeys), live: cleanLive(raw.live) };
      if (migrateIds(this.data)) this.save();
    } catch { /* first run or unreadable: use defaults */ }
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
  update(fn: (s: Settings) => void) { fn(this.data); this.save(); }
}
