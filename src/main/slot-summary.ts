// What the slot picker knows about each slot, from its caption.sav (only ever read).
// No Electron imports here.
import fs from 'node:fs';
import { parseGameData } from '../gamedata/parser.js';
import { readCaption, CaptionInfo } from '../gamedata/caption.js';
import type { SlotSummary } from '../shared/types.js';

/** "Market_Child" -> "Market (child)", "HyruleField_Adult" -> "Hyrule Field (adult)" */
export function prettyArea(s: string): string {
  const m = s.match(/^(.*?)(?:_(Adult|Child))?$/)!;
  const base = m[1].replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return m[2] ? `${base} (${m[2].toLowerCase()})` : base;
}

/**
 * A caption date as ms epoch (local time); undefined if any part is out of range. Checks
 * ranges rather than round-tripping through Date, so a time inside a daylight-saving gap
 * still counts. Second 60 is allowed (a leap second, Date rolls it over).
 */
export function captionTime(d: CaptionInfo['date']): number | undefined {
  if (!d) return undefined;
  const { year, month, day, hour, minute, second } = d;
  if (![year, month, day, hour, minute, second].every(n => Number.isInteger(n))) return undefined;
  if (year < 1970 || month < 1 || month > 12 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 60) return undefined;
  if (day < 1 || day > new Date(year, month, 0).getDate()) return undefined;
  const ms = new Date(year, month - 1, day, hour, minute, second).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

const count = (n: number | undefined) => (n !== undefined && Number.isFinite(n) && n >= 0 ? n : undefined);

/** `rawArea` overrides the caption's own area (see readSlotCaption). Unknown fields stay absent. */
export function slotSummaryFromCaption(name: string, mtimeMs: number, info: CaptionInfo | null, rawArea = info?.area): SlotSummary {
  const out: SlotSummary = { name, mtimeMs };
  if (rawArea) {
    out.area = prettyArea(rawArea.split('/').pop()!);
    const age = rawArea.match(/_(Adult|Child)$/)?.[1];
    if (age) out.age = age === 'Adult' ? 'adult' : 'child';
  }
  if (!info) return out;
  const fields: Partial<SlotSummary> = {
    hearts: quarters(info.life),
    maxHearts: quarters(info.maxLife),
    savedAt: captionTime(info.date),
    autoSave: info.isAutoSave,
    rupees: count(info.rupees),
    tokens: count(info.goldTokens),
    songs: info.songs.length,
    medals: info.medals.length,
    stones: info.stones.length,
  };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  return out;
}

function quarters(life: number | undefined) {
  const n = count(life);
  return n === undefined ? undefined : n / 4;
}

export interface SlotCaption {
  info: CaptionInfo | null;
  /** e.g. "Market/Market_Child" */
  rawArea?: string;
}

export function readSlotCaption(file: string, read: (file: string) => CaptionInfo | null = readCaption): SlotCaption {
  const info = read(file);
  if (info?.area) return { info, rawArea: info.area };
  // Last resort for saves from other builds: first String64 containing "/".
  try {
    const cap = parseGameData(fs.readFileSync(file));
    const strs = [...cap.entries.values()].filter(e => e.type === 'String64' && typeof e.value === 'string').map(e => e.value as string);
    return { info, rawArea: strs.find(s => s.includes('/')) ?? strs[0] };
  } catch { return { info }; }
}

/** Reads each caption.sav once per change, going by its path, mtime and size. */
export class CaptionCache {
  private seen = new Map<string, { mtimeMs: number; size: number; caption: SlotCaption }>();

  constructor(private read: (file: string) => CaptionInfo | null = readCaption) {}

  get(file: string): SlotCaption {
    let st: fs.Stats;
    try { st = fs.statSync(file); } catch { this.seen.delete(file); return { info: null }; }
    const hit = this.seen.get(file);
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.caption;
    // Stat first: a write that lands during the read then shows up as a change next time.
    // That also covers a half-written file, so a failed read can be remembered like any other.
    const caption = readSlotCaption(file, this.read);
    this.seen.set(file, { mtimeMs: st.mtimeMs, size: st.size, caption });
    return caption;
  }

  clear() { this.seen.clear(); }
}
