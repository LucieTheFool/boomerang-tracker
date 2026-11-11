// Evaluates the small "detect" rules from data/save-mapping.json against a parsed save.
//
//   { "name": "IsGet.Item_Hookshot" }               true if the value is truthy (true / > 0)
//   { "key": "0x9DC9D979", "gte": 2 }               numeric comparison (gte, lte, eq)
//   { "name": "X", "index": 17 }                    one element of an array value
//   { "b64": "0x3F93661D8E17C1D0" }                 a 64-bit flag is set
//   { "any": [ ... ] } / { "all": [ ... ] }         combinations
//   { "count": [ ... ], "gte": 3 }                  at least N of the sub-rules are true
//   { "sum": [ "NameA", "NameB" ], "gte": 2 }       sum of numeric values
//   { "always": true }                              owned from the start
import { GameDataFile, Value } from './parser.js';
import { murmur3 } from './murmur3.js';

export type Rule =
  | { name?: string; key?: string; index?: number; gte?: number; lte?: number; eq?: number | boolean | string; in?: string[] }
  | { b64: string }
  | { any: Rule[] }
  | { all: Rule[] }
  | { count: Rule[]; gte: number }
  | { sum: string[]; gte: number }
  | { always: boolean };

export type State = 'yes' | 'no' | 'unknown';

export interface Lookup {
  /** enum value names: hash -> name, so rules can say eq: "Empty" */
  enumNames?: Map<number, string>;
}

const hashCache = new Map<string, number>();
export function keyOf(r: { name?: string; key?: string }): number {
  if (r.key) return parseInt(r.key, 16) >>> 0;
  if (!r.name) throw new Error('rule needs name or key');
  let h = hashCache.get(r.name);
  if (h === undefined) { h = murmur3(r.name); hashCache.set(r.name, h); }
  return h;
}

export function readValue(g: GameDataFile, r: { name?: string; key?: string; index?: number }): Value | undefined {
  const e = g.entries.get(keyOf(r));
  if (!e) return undefined;
  if (r.index !== undefined) return Array.isArray(e.value) ? e.value[r.index] : undefined;
  return e.value;
}

const truthy = (v: Value) => v === true || (typeof v === 'number' && v > 0) || (typeof v === 'bigint' && v > 0n);
const num = (v: Value) => (typeof v === 'boolean' ? +v : typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : NaN);

export function evaluate(rule: Rule, g: GameDataFile, lk: Lookup = {}): State {
  if ('always' in rule) return rule.always ? 'yes' : 'no';
  if ('b64' in rule) return g.bool64.has(BigInt(rule.b64)) ? 'yes' : 'no';
  if ('any' in rule) {
    const s = rule.any.map(r => evaluate(r, g, lk));
    return s.includes('yes') ? 'yes' : s.includes('unknown') ? 'unknown' : 'no';
  }
  if ('all' in rule) {
    const s = rule.all.map(r => evaluate(r, g, lk));
    return s.includes('no') ? 'no' : s.includes('unknown') ? 'unknown' : 'yes';
  }
  if ('count' in rule) {
    const s = rule.count.map(r => evaluate(r, g, lk));
    const yes = s.filter(x => x === 'yes').length;
    if (yes >= rule.gte) return 'yes';
    return yes + s.filter(x => x === 'unknown').length >= rule.gte ? 'unknown' : 'no';
  }
  if ('sum' in rule) {
    let total = 0;
    for (const n of rule.sum) {
      const v = readValue(g, { name: n });
      if (v === undefined) return 'unknown';
      total += num(v);
    }
    return total >= rule.gte ? 'yes' : 'no';
  }
  const v = readValue(g, rule);
  if (v === undefined) return 'unknown';
  if (rule.eq !== undefined) {
    // Enum values are murmur3(value name), so { eq: "Complete" } needs no lookup table.
    if (typeof rule.eq === 'string' && typeof v === 'number') return v >>> 0 === murmur3(rule.eq) ? 'yes' : 'no';
    return v === rule.eq ? 'yes' : 'no';
  }
  if (rule.in !== undefined) {
    // { in: ["StepA", "Complete"] } for "at or past a step", listed explicitly
    return typeof v === 'number' && rule.in.some(s => murmur3(s) === v >>> 0) ? 'yes' : 'no';
  }
  if (rule.gte !== undefined || rule.lte !== undefined) {
    const n = num(v);
    if (rule.gte !== undefined && !(n >= rule.gte)) return 'no';
    if (rule.lte !== undefined && !(n <= rule.lte)) return 'no';
    return 'yes';
  }
  return truthy(v) ? 'yes' : 'no';
}

/** Counter categories (Big Poes, bean spots): a number, or null if a key is missing. */
export type CounterRule =
  | { value: { name?: string; key?: string }; cap?: number }
  | { countOf: Rule[]; cap?: number };

export function evaluateCounter(c: CounterRule, g: GameDataFile, lk: Lookup = {}): number | null {
  let n: number;
  if ('value' in c) {
    const v = readValue(g, c.value);
    if (v === undefined) return null;
    n = num(v);
  } else {
    const s = c.countOf.map(r => evaluate(r, g, lk));
    if (s.includes('unknown')) return null;
    n = s.filter(x => x === 'yes').length;
  }
  return c.cap !== undefined ? Math.min(n, c.cap) : n;
}

/** All key hashes a rule reads (for "which entries changed in this save"). */
export function ruleKeys(rule: Rule, out = new Set<number | string>()): Set<number | string> {
  if ('always' in rule) return out;
  if ('b64' in rule) { out.add('b64:' + rule.b64.toUpperCase().replace('0X', '0x')); return out; }
  if ('any' in rule) { rule.any.forEach(r => ruleKeys(r, out)); return out; }
  if ('all' in rule) { rule.all.forEach(r => ruleKeys(r, out)); return out; }
  if ('count' in rule) { rule.count.forEach(r => ruleKeys(r, out)); return out; }
  if ('sum' in rule) { rule.sum.forEach(n => out.add(keyOf({ name: n }))); return out; }
  out.add(keyOf(rule));
  return out;
}
