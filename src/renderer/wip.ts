// WIP 100% sections (Settings → Advanced → Developer options): My Play Data, Hall of Fallen Foes,
// Threads of Time: only what the checklist doesn't already list (equipment, songs, bottles,
// Great Fairies and capacity are checklist categories; data/equipment-items-upgrades.json stays as
// reference). Built from the reference files in data/. Nothing new is read from the save: an entry
// the checklist already tracks (data/wip-links.json) shows that row's status, every other entry
// shows as not mapped.
import medalsFile from '../../data/zelda-notes-medals.json';
import hallFile from '../../data/hall-of-fallen-foes.json';
import questsFile from '../../data/threads-of-time-quests.json';
import linksFile from '../../data/wip-links.json';

/**
 * One entry. detail = a short fact (bosses, tiers), shown beside a row; tip = a longer one
 * (a quest's reward), shown only on hover; sub = its sub-quests;
 * link = the checklist row that already tracks it (absent: not mapped yet).
 */
export interface WipEntry { id: string; name: string; detail?: string; tip?: string; sub?: WipEntry[]; link?: string }

/**
 * A titled group. total is the game's count; entries holds what the data lists so far
 * (fewer than total while a reference file is incomplete). folds: one closed group per area.
 */
export interface WipSection {
  id: string;
  title: string;
  total: number;
  layout: 'chips' | 'rows';
  entries: WipEntry[];
  folds?: WipSection[];
}

/** A My Play Data bar toward the Master threshold. link = checklist category whose collected count is the stat. */
export interface WipStat { id: string; name: string; master: number; unit: string; link?: string }

export interface WipCard {
  id: string;
  title: string;
  /** What the card covers, for the heading's tooltip */
  about: string;
  /** Key into SYMBOLS (symbols.tsx), drawn before the title */
  symbol: string;
  total: number;
  sections: WipSection[];
  stats?: WipStat[];
  /** Medals listed without a Master threshold (My Play Data) */
  unthresholded?: number;
}

/** display: false = a medal the checklist already counts (Token Collector = Gold Skulltulas), left out of the card. */
interface MedalsFile { medals: { id: string; name: string; display?: boolean; tiers?: { master?: { threshold: number | null; unit: string } } }[] }
interface Named { id: string; name: string }
interface HallFile {
  total_statues: number;
  categories: { id: string; name: string; enemies: (Named & { pedestal: string })[] }[];
  gauntlet_trials: (Named & { bosses: string[] })[];
}
type Quest = Named & { order: number; reward?: string; sub_quests?: Named[] };
interface QuestsFile { main_story_quests: { total: number; quests: Quest[] }; side_quests: { total: number; quests: Quest[] } }

const entry = ({ id, name }: Named, detail?: string): WipEntry => (detail ? { id, name, detail } : { id, name });
const sectionTotal = (s: WipSection) => s.total;

export function playDataCard(file: MedalsFile): WipCard {
  const medals = file.medals.filter(m => m.display !== false);
  const stats: WipStat[] = [];
  for (const m of medals) {
    const master = m.tiers?.master;
    if (master && typeof master.threshold === 'number') stats.push({ id: m.id, name: m.name, master: master.threshold, unit: master.unit });
  }
  return { id: 'wip.play_data', title: 'My Play Data', symbol: 'medal', about: 'Zelda Notes medals: your play stats toward each Master medal', total: stats.length, sections: [], stats, unthresholded: medals.length - stats.length };
}

export function hallCard(file: HallFile): WipCard {
  const folds: WipSection[] = file.categories.map(c => ({ id: `wip.hall.${c.id}`, title: c.name, total: c.enemies.length, layout: 'chips', entries: c.enemies.map(e => entry(e)) }));
  const listed = folds.reduce((n, f) => n + f.total, 0);
  // Statues on a rectangular pedestal (bosses and mini-bosses) can be fought again.
  const rematches = file.categories.flatMap(c => c.enemies.filter(e => e.pedestal === 'rectangular').map(e => entry(e)));
  const sections: WipSection[] = [
    { id: 'wip.hall.statues', title: 'Monster Statues', total: Math.max(file.total_statues, listed), layout: 'chips', entries: [], folds },
    { id: 'wip.hall.trials', title: 'Gauntlet Trials', total: file.gauntlet_trials.length, layout: 'rows', entries: file.gauntlet_trials.map(t => entry(t, `${t.bosses.length} bosses`)) },
    { id: 'wip.hall.rematches', title: 'Boss Rematches', total: rematches.length, layout: 'chips', entries: rematches },
  ];
  return { id: 'wip.hall', title: 'Hall of Fallen Foes', symbol: 'statue', about: 'Monster Statues, Gauntlet Trials and Boss Rematches', total: sections.reduce((n, s) => n + sectionTotal(s), 0), sections };
}

export function threadsCard(file: QuestsFile): WipCard {
  const quests = (list: Quest[]): WipEntry[] => [...list].sort((a, b) => a.order - b.order).map(q => ({
    ...entry(q),
    ...(q.reward ? { tip: `Reward: ${q.reward}` } : {}),
    ...(q.sub_quests?.length ? { sub: q.sub_quests.map(s => entry(s)) } : {}),
  }));
  const sections: WipSection[] = [
    { id: 'wip.threads.main', title: 'Main Quests', total: file.main_story_quests.total, layout: 'rows', entries: quests(file.main_story_quests.quests) },
    { id: 'wip.threads.side', title: 'Side Quests', total: file.side_quests.total, layout: 'rows', entries: quests(file.side_quests.quests) },
  ];
  return { id: 'wip.threads', title: 'Threads of Time', symbol: 'questThread', about: 'Main and side quests', total: sections.reduce((n, s) => n + sectionTotal(s), 0), sections };
}

/** "3,000 rupees", "100%" */
export function thresholdText(n: number, unit: string): string {
  return unit === 'percent' ? `${n}%` : `${n.toLocaleString('en-US')} ${unit}`;
}

/** data/wip-links.json: reference id → checklist item id; medal id → checklist category id. */
export interface WipLinks { entries: Record<string, string>; stats: Record<string, string> }

export function withLinks(card: WipCard, links: WipLinks): WipCard {
  const entry = (e: WipEntry): WipEntry => {
    const out: WipEntry = { ...e, ...(e.sub ? { sub: e.sub.map(entry) } : {}) };
    if (links.entries[e.id]) out.link = links.entries[e.id];
    return out;
  };
  const section = (s: WipSection): WipSection => ({ ...s, entries: s.entries.map(entry), ...(s.folds ? { folds: s.folds.map(section) } : {}) });
  const stats = card.stats?.map(st => (links.stats[st.id] ? { ...st, link: links.stats[st.id] } : st));
  return { ...card, sections: card.sections.map(section), ...(stats ? { stats } : {}) };
}

/** What the cards read from the current checklist: each row's status, and each category's collected count. */
export interface WipStatus {
  rows: Map<string, { done: boolean; categoryId: string; categoryLabel: string }>;
  categories: Map<string, number>;
}

export function wipStatus(categories: { id: string; label: string; done: number; items: { id: string; done: boolean }[] }[]): WipStatus {
  const rows: WipStatus['rows'] = new Map();
  for (const c of categories) for (const i of c.items) rows.set(i.id, { done: i.done, categoryId: c.id, categoryLabel: c.label });
  return { rows, categories: new Map(categories.map(c => [c.id, c.done])) };
}

/** The checklist row behind an entry, or undefined when it isn't mapped (or the row is missing from this checklist). */
export const rowOf = (e: WipEntry, st: WipStatus) => (e.link ? st.rows.get(e.link) : undefined);

/** Collected count when every entry of the game's list is a checklist row; null = unknown. */
export function sectionDone(s: WipSection, st: WipStatus): number | null {
  if (s.folds || s.entries.length < s.total) return null;
  let n = 0;
  for (const e of s.entries) { const r = rowOf(e, st); if (!r) return null; if (r.done) n++; }
  return n;
}

export function cardDone(card: WipCard, st: WipStatus): number | null {
  if (card.stats) return null; // medal tiers aren't read
  let n = 0;
  for (const s of card.sections) { const d = sectionDone(s, st); if (d === null) return null; n += d; }
  return n;
}

/** How many entries and stat bars of a card are not mapped, out of how many. */
export function unmappedCount(card: WipCard, st: WipStatus): { unmapped: number; of: number } {
  let unmapped = 0, of = 0;
  const entry = (e: WipEntry) => { of++; if (!rowOf(e, st)) unmapped++; e.sub?.forEach(entry); };
  const section = (s: WipSection) => { s.entries.forEach(entry); s.folds?.forEach(section); };
  card.sections.forEach(section);
  for (const s of card.stats ?? []) { of++; if (!(s.link && st.categories.has(s.link))) unmapped++; }
  return { unmapped, of };
}

/** The three cards, in the order they follow the checklist. */
export const wipCards: WipCard[] = [
  playDataCard(medalsFile),
  hallCard(hallFile),
  threadsCard(questsFile),
].map(c => withLinks(c, linksFile));
