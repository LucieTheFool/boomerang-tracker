// Text for the slot picker. <option> holds plain text only, so each slot is one line,
// and a part whose data is missing is simply left out.
import type { SlotSummary } from '../shared/types';

export function timeAgo(ms: number | undefined, now = Date.now()): string {
  if (!ms) return '—';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ms).toLocaleString();
}

const known = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

const QUARTERS = ['', '¼', '½', '¾'];

/** 4.75 -> "4¾", 0.5 -> "½", 5 -> "5", 0 -> "0"; empty when there is no usable number. */
export function heartsText(hearts: number | undefined): string {
  if (!known(hearts)) return '';
  const q = Math.round(hearts * 4);
  const whole = Math.floor(q / 4);
  const part = QUARTERS[q % 4];
  return whole || !part ? `${whole}${part}` : part;
}

/** "Nov 17, 4:33 PM" (in the system's language and time zone unless given). */
export function formatSavedAt(ms: number, locale?: string, timeZone?: string): string {
  return new Date(ms).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone });
}

export interface SlotLabelOptions {
  formatTime?: (ms: number) => string;
  now?: number;
}

function slotNumber(name: string) {
  const m = name.match(/^slot_0*(\d+)$/);
  return m ? `Slot ${m[1]}` : name;
}

function areaText({ area, age }: SlotSummary) {
  if (!age) return area ?? '';
  if (!area) return age;
  // Area names that carry the age already end in it.
  return area.endsWith(`(${age})`) ? area : `${area} (${age})`;
}

function heartsPart(s: SlotSummary) {
  const now = heartsText(s.hearts);
  if (!now) return '';
  const max = heartsText(s.maxHearts);
  return max ? `${now}/${max} hearts` : `${now} ${s.hearts === 1 ? 'heart' : 'hearts'}`;
}

/** "Slot 3 · Hyrule Field (child) · 5/5 hearts · Nov 17, 4:33 PM · auto" */
export function slotLabel(s: SlotSummary, { formatTime = ms => formatSavedAt(ms), now = Date.now() }: SlotLabelOptions = {}): string {
  const time = known(s.savedAt) ? formatTime(s.savedAt) : s.mtimeMs > 0 ? timeAgo(s.mtimeMs, now) : '';
  return [slotNumber(s.name), areaText(s), heartsPart(s), time, s.autoSave ? 'auto' : ''].filter(Boolean).join(' · ');
}

/** The "follow the newest save" option, naming only the slot so the toolbar stays short. */
export function recentLabel(s: SlotSummary | undefined): string {
  return s ? `Most recent (${slotNumber(s.name)})` : 'Most recent';
}

const counted = (n: number | undefined, one: string) => (known(n) ? `${n} ${one}${n === 1 ? '' : 's'}` : '');

/** The option's tooltip: "999 rupees · 16 Gold Skulltula tokens · 12 songs · 6 medals · 3 stones" */
export function slotTitle(s: SlotSummary): string | undefined {
  const parts = [counted(s.rupees, 'rupee'), counted(s.tokens, 'Gold Skulltula token'), counted(s.songs, 'song'), counted(s.medals, 'medal'), counted(s.stones, 'stone')];
  return parts.filter(Boolean).join(' · ') || undefined;
}
