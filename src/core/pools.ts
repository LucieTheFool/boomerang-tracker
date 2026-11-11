// "Pools": checklist rows that share a set of 64-bit flags because the level files don't
// say which placement is which row (e.g. 5 Gold Skulltulas in the Fire Temple). A pool's
// count is exact; tiles fill in order. The user can identify a placement when it gets
// collected ("which one was this?"); answers become "learned" groups that are applied here.
import type { Rule } from '../gamedata/detect.js';
import type { IdentifyRequest } from '../shared/types.js';

export interface MapEntry { label: string; detect: Rule | null; confidence: 'confirmed' | 'likely' | 'guess'; evidence: string }

/** A user answer: these flags belong to these rows (same length; order unknown if > 1). */
export interface LearnedGroup { flags: string[]; items: string[]; at?: string }

export interface Pool { key: string; flags: string[]; rows: string[] }

const isPoolRule = (r: Rule | null | undefined): r is { count: { b64: string }[]; gte: number } =>
  !!r && 'count' in r && Array.isArray(r.count) && r.count.every(x => 'b64' in (x as object));

const norm = (f: string) => '0x' + BigInt(f).toString(16).toUpperCase().padStart(16, '0');

/** Find pools in mapping entries, rows in checklist order. */
export function findPools(entries: Record<string, MapEntry>, order: string[]): Pool[] {
  const pools = new Map<string, Pool>();
  for (const id of order) {
    const r = entries[id]?.detect;
    if (!isPoolRule(r)) continue;
    const flags = r.count.map(x => norm(x.b64));
    const key = [...flags].sort().join(',');
    const p = pools.get(key) ?? { key, flags, rows: [] };
    p.rows.push(id);
    pools.set(key, p);
  }
  return [...pools.values()];
}

/**
 * Returns a copy of the entries with learned groups applied: learned rows get their own
 * rules, and every pool shrinks to the rows and flags that are still unidentified.
 * A pool down to one row and one flag becomes an exact rule (identified by elimination).
 */
export function applyLearned(entries: Record<string, MapEntry>, order: string[], learned: LearnedGroup[]): { entries: Record<string, MapEntry>; pools: Pool[] } {
  const out: Record<string, MapEntry> = { ...entries };
  const pools = findPools(entries, order);
  const learnedFlags = new Set(learned.flatMap(g => g.flags.map(norm)));
  const learnedItems = new Set(learned.flatMap(g => g.items));
  // Flags already pinned to a row by an exact rule elsewhere (e.g. confirmed in the mapping file).
  const pinned = new Set<string>();
  for (const e of Object.values(entries)) if (e.detect && 'b64' in e.detect) pinned.add(norm((e.detect as { b64: string }).b64));

  for (const g of learned) {
    const flags = g.flags.map(norm);
    const items = g.items.filter(i => entries[i]);
    items.forEach((id, i) => {
      out[id] = items.length === 1
        ? { label: entries[id].label, detect: { b64: flags[0] }, confidence: 'confirmed', evidence: `Identified by you in the tracker${g.at ? ` (${g.at.slice(0, 10)})` : ''}: flag ${flags[0]}` }
        : { label: entries[id].label, detect: { count: flags.map(f => ({ b64: f })), gte: i + 1 }, confidence: 'likely', evidence: `You identified these ${items.length} together; which flag is which is unknown, but all are collected` };
    });
  }

  const remaining: Pool[] = [];
  for (const p of pools) {
    const rows = p.rows.filter(r => !learnedItems.has(r));
    const flags = p.flags.filter(f => !learnedFlags.has(f) && !pinned.has(f));
    if (!rows.length) continue;
    if (rows.length === 1 && flags.length === 1) {
      out[rows[0]] = { ...entries[rows[0]], detect: { b64: flags[0] }, confidence: 'likely', evidence: `The last unidentified one in its group, so identified by elimination (flag ${flags[0]})` };
      continue;
    }
    rows.forEach((id, i) => {
      out[id] = { ...entries[id], detect: { count: flags.map(f => ({ b64: f })), gte: i + 1 } as Rule };
    });
    remaining.push({ key: p.key, flags, rows });
  }
  return { entries: out, pools: remaining };
}

export type { IdentifyRequest };

/** New flags that belong to a pool -> questions to ask (auto-answers when there's no choice). */
export function findIdentifications(
  pools: Pool[], newFlags: Set<string>,
  describe: (itemId: string) => { number: number; name: string; category: string; chapter?: string },
): { ask: IdentifyRequest[]; auto: LearnedGroup[] } {
  const ask: IdentifyRequest[] = [];
  const auto: LearnedGroup[] = [];
  for (const p of pools) {
    const fresh = p.flags.filter(f => newFlags.has(f));
    if (!fresh.length) continue;
    if (fresh.length >= p.rows.length) { auto.push({ flags: fresh.slice(0, p.rows.length), items: [...p.rows] }); continue; }
    const cands = p.rows.map(id => ({ id, ...describe(id) }));
    const areas = [...new Set(cands.map(c => c.chapter).filter(Boolean))];
    ask.push({
      id: [...fresh].sort().join(','),
      categoryLabel: cands[0].category,
      area: areas.join(' / '),
      flags: fresh,
      pick: fresh.length,
      candidates: cands.map(({ id, number, name }) => ({ id, number, name })),
    });
  }
  return { ask, auto };
}
