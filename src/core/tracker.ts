// Turns a parsed save + checklist + mapping into what the UI shows.
// No Electron imports, so it can be tested and run from scripts.
import { GameDataFile } from '../gamedata/parser.js';
import { evaluate, evaluateCounter, readValue, ruleKeys, Rule, CounterRule, keyOf } from '../gamedata/detect.js';
import { diffGameData, Change } from '../gamedata/diff.js';
import { hex32 } from '../gamedata/murmur3.js';
import type { TrackedCategory, TrackedItem, Summary, ChangeReport, ChangeRow } from '../shared/types.js';
import { applyLearned, findIdentifications, LearnedGroup, Pool } from './pools.js';

export interface ChecklistFile {
  categories: {
    id: string; label: string; part: 'A' | 'B' | 'C'; countsToward100: boolean; kind: 'list' | 'counter'; max?: number; note?: string;
    items: { id: string; number: number; name: string; chapter?: string; region?: string; requirement?: string; details?: Record<string, string>; newInRemake?: boolean; iconId: string }[];
  }[];
}
export interface MappingFile {
  entries: Record<string, { label: string; detect: Rule | null; confidence: 'confirmed' | 'likely' | 'guess'; evidence: string }>;
  counters: Record<string, CounterRule & { confidence: string; evidence: string }>;
  derived: {
    maxHearts: { name: string; scale: number };
    heartPiecesHeld: { name: string };
    goldSkulltulaTokens: { name: string };
    skulltulaRewards: { list: [number, string][] };
  };
}

/** Manual ticks for one slot: item id -> true. */
export type ManualTicks = Record<string, boolean>;

export class Tracker {
  /** key (hash or "b64:...") -> checklist entry labels that read it */
  keyToEntries = new Map<number | string, string[]>();
  /** The mapping in use: the file plus the user's identifications. */
  mapping: MappingFile;
  /** Groups of rows still sharing flags (see pools.ts). */
  pools: Pool[] = [];
  private order: string[];

  constructor(readonly checklist: ChecklistFile, readonly baseMapping: MappingFile, learned: LearnedGroup[] = []) {
    this.order = checklist.categories.flatMap(c => c.items.map(i => i.id));
    this.mapping = baseMapping;
    this.setLearned(learned);
  }

  /** Apply the user's "which one was this?" answers. */
  setLearned(learned: LearnedGroup[]) {
    const { entries, pools } = applyLearned(this.baseMapping.entries, this.order, learned);
    this.mapping = { ...this.baseMapping, entries };
    this.pools = pools;
    this.rebuildKeys();
  }

  /** Checklist info for a row id. */
  describe(itemId: string) {
    for (const c of this.checklist.categories) {
      const it = c.items.find(i => i.id === itemId);
      if (it) return { number: it.number, name: it.name, category: c.label, chapter: it.chapter };
    }
    return { number: 0, name: itemId, category: '?' };
  }

  /** Questions to ask about flags that became set between two saves. */
  identifications(before: GameDataFile, after: GameDataFile) {
    const fresh = new Set([...after.bool64].filter(k => !before.bool64.has(k)).map(k => '0x' + k.toString(16).toUpperCase().padStart(16, '0')));
    return findIdentifications(this.pools, fresh, id => this.describe(id));
  }

  private rebuildKeys() {
    const { checklist, mapping } = this;
    this.keyToEntries = new Map();
    for (const c of checklist.categories) for (const it of c.items) {
      const rule = mapping.entries[it.id]?.detect;
      if (!rule) continue;
      for (const k of ruleKeys(rule)) {
        const list = this.keyToEntries.get(k) ?? [];
        list.push(`${c.label}: ${it.name}`);
        this.keyToEntries.set(k, list);
      }
    }
    for (const [id, ctr] of Object.entries(mapping.counters)) {
      const label = checklist.categories.find(c => c.id === id)?.label ?? id;
      const rules: Rule[] = 'countOf' in ctr ? ctr.countOf : [ctr.value as Rule];
      for (const r of rules) for (const k of ruleKeys(r)) this.keyToEntries.set(k, [...(this.keyToEntries.get(k) ?? []), label]);
    }
    for (const d of [mapping.derived.maxHearts, mapping.derived.heartPiecesHeld, mapping.derived.goldSkulltulaTokens]) {
      const k = keyOf({ name: d.name });
      this.keyToEntries.set(k, [...(this.keyToEntries.get(k) ?? []), 'Summary']);
    }
  }

  evaluate(save: GameDataFile, manual: ManualTicks = {}, previous?: GameDataFile): { categories: TrackedCategory[]; summary: Summary } {
    const categories: TrackedCategory[] = [];
    let doneA = 0;
    let totalA = 0;
    for (const c of this.checklist.categories) {
      if (c.kind === 'counter') {
        const ctr = this.mapping.counters[c.id];
        const value = ctr ? evaluateCounter(ctr, save) : null;
        const max = c.max ?? 0;
        if (c.countsToward100) { doneA += Math.min(value ?? 0, max); totalA += max; }
        categories.push({ id: c.id, label: c.label, part: c.part, countsToward100: c.countsToward100, kind: 'counter', note: c.note,
          items: [], done: Math.min(value ?? 0, max), total: max, value, max, counterConfidence: ctr?.confidence });
        continue;
      }
      const pooled = new Set(this.pools.flatMap(p => p.rows));
      const items: TrackedItem[] = c.items.map(it => {
        const m = this.mapping.entries[it.id];
        const state = m?.detect ? evaluate(m.detect, save) : 'unmapped';
        const wasYes = previous && m?.detect ? evaluate(m.detect, previous) === 'yes' : true;
        const isManual = !!manual[it.id];
        return {
          ...it,
          state,
          manual: isManual && state !== 'yes',
          done: state === 'yes' || isManual,
          confidence: m?.detect ? m.confidence : undefined,
          evidence: m?.evidence,
          // Pooled tiles fill in order, so a new one isn't "this specific spot": the
          // "which one was it?" question covers it instead.
          justCollected: state === 'yes' && !wasYes && !pooled.has(it.id),
        };
      });
      const done = items.filter(i => i.done).length;
      if (c.countsToward100) { doneA += done; totalA += items.length; }
      categories.push({ id: c.id, label: c.label, part: c.part, countsToward100: c.countsToward100, kind: 'list', note: c.note, items, done, total: items.length });
    }

    const d = this.mapping.derived;
    const numOrNull = (v: unknown) => (typeof v === 'number' ? v : null);
    const maxLife = numOrNull(readValue(save, { name: d.maxHearts.name }));
    const tokens = numOrNull(readValue(save, { name: d.goldSkulltulaTokens.name }));
    const next = tokens === null ? null : d.skulltulaRewards.list.find(([t]) => t > tokens);
    // Reached-but-unclaimed rewards, from the House of Skulltula reward rows (in order).
    const rewardCat = categories.find(c => c.id === 'skulltula_rewards');
    const claimable = tokens === null || !rewardCat ? [] : d.skulltulaRewards.list
      .map(([t, r], i) => ({ tokens: t, reward: r, item: rewardCat.items[i] }))
      .filter(x => x.tokens <= tokens && x.item && !x.item.done && x.item.state !== 'unmapped')
      .map(({ tokens: t, reward }) => ({ tokens: t, reward }));
    const hearts = maxLife === null ? null : maxLife * d.maxHearts.scale;
    const held = numOrNull(readValue(save, { name: d.heartPiecesHeld.name }));
    const summary: Summary = {
      hearts,
      maxHeartsPossible: 20,
      heartPiecesHeld: held,
      tokens,
      nextReward: next ? { tokens: next[0], reward: next[1] } : null,
      claimable,
      percent: totalA ? Math.floor((doneA / totalA) * 1000) / 10 : 0,
      doneA, totalA,
    };

    // Hints where the save knows a total but not (yet) which locations.
    const hp = categories.find(c => c.id === 'heart_pieces');
    const hc = categories.find(c => c.id === 'heart_containers');
    if (hp && hc && hearts !== null && held !== null) {
      const total = Math.max(0, (hearts - 3 - hc.done) * 4 + held);
      if (total !== hp.done) hp.hint = `Your save has ${total} piece${total === 1 ? '' : 's'} in total; ${hp.done} matched to a location so far.`;
    }
    const gs = categories.find(c => c.id === 'gold_skulltulas');
    if (gs && tokens !== null && tokens !== gs.done) gs.hint = `Your save has ${tokens} token${tokens === 1 ? '' : 's'}; ${gs.done} matched to a location so far.`;
    return { categories, summary };
  }

  /** Split a diff into keys the mapping uses and everything else. */
  describeChanges(a: GameDataFile, b: GameDataFile, slot: string, names?: Map<number, string>, enumNames?: Map<number, string>): ChangeReport {
    const NOISE_TYPES = new Set(['Float', 'FloatArray', 'Vector3', 'Binary', 'Int64', 'UInt64', 'UInt', 'UInt64Array', 'UIntArray']);
    const NOISE_NAME = /Position|Rotation|Camera|PlayTime|Time$|Timer|Elapsed|Random/;
    const known: ChangeRow[] = [];
    const unknown: ChangeRow[] = [];
    let hiddenNoise = 0;
    for (const c of diffGameData(a, b)) {
      const key = typeof c.key === 'number' ? c.key : c.key;
      const entries = this.keyToEntries.get(key);
      const name = typeof c.key === 'number' ? names?.get(c.key) : undefined;
      const en = (s: string) => (c.type === 'Enum' && enumNames?.get(Number(s) >>> 0)) || s;
      const row: ChangeRow = { key: typeof c.key === 'number' ? hex32(c.key) : c.key, name, type: c.type, old: en(show(c, 'old')), new: en(show(c, 'new')), entries };
      if (entries) known.push(row);
      else if (NOISE_TYPES.has(c.type) || (name && NOISE_NAME.test(name))) hiddenNoise++;
      else unknown.push(row);
    }
    return { atMs: Date.now(), slot, known, unknown, hiddenNoise };
  }
}

function show(c: Change, which: 'old' | 'new'): string {
  const v = c[which];
  if (v === undefined) return '—';
  if (Array.isArray(v)) {
    const idx = c.indices ?? [];
    return `[${idx.slice(0, 6).map(i => `${i}=${fmt(v[i])}`).join(' ')}${idx.length > 6 ? ' …' : ''}]`;
  }
  return fmt(v);
}
const fmt = (v: unknown) => (typeof v === 'bigint' ? v.toString() : typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(3) : typeof v === 'object' ? JSON.stringify(v) : String(v));
