// "What can I get right now?" logic. Data-driven: data/logic.json describes
//   items    : logic item name -> how to read it from the save (a detect Rule)
//   numbers  : numeric values (e.g. Tokens) usable as "Tokens>=50"
//   macros   : named expressions ("Explosives": "Bombs or Bombchus")
//   regions  : area graph; each exit has a requirement expression
//   warps    : exits usable from anywhere (warp songs)
//   locations: per checklist row ("category#number"): region, age, needs, night, unsure
// Expressions: identifiers joined with "and" / "or" and parentheses, plus "child",
// "adult", "true", and "Name>=N" for numbers. No Electron imports.
import { GameDataFile } from '../gamedata/parser.js';
import { evaluate, readValue, Rule } from '../gamedata/detect.js';

export type Age = 'child' | 'adult';

export interface LogicFile {
  start: Record<Age, string>;
  canBeAdult: string;
  items: Record<string, Rule>;
  numbers: Record<string, { name: string; scale?: number }>;
  macros: Record<string, string>;
  regionAliases: Record<string, string>;
  regions: Record<string, { exits: Record<string, string> }>;
  warps: { to: string; needs: string }[];
  locations: Record<string, LogicLocation>;
  /** Requirement added to every location of a category, e.g. something to kill Skulltulas with. */
  categoryNeeds?: Record<string, string>;
  /**
   * Upgrades that come in tiers from several places: whichever place you do first gives
   * the next tier (e.g. either seed-bag game gives the bigger bag, the other the biggest).
   * Their rows' own location entries are replaced by this.
   */
  progressive?: Record<string, ProgressiveFamily>;
  /** Readable names for items, numbers ("{n}" = the amount) and macros, used in "still needed" lists. */
  labels?: Record<string, string>;
}

/** A missing requirement as players read it: "Bombs or Bombchus", "50 Gold Skulltula tokens". */
export function missingLabel(data: LogicFile, m: string): string {
  const labels = data.labels ?? {};
  if (labels[m]) return labels[m];
  const num = m.match(/^(\w+) (\d+)$/);
  if (num && labels[num[1]]?.includes('{n}')) return labels[num[1]].replace('{n}', num[2]);
  return m;
}
const labelled = (data: LogicFile, missing: Set<string>) => [...new Set([...missing].map(m => missingLabel(data, m)))];

export interface ProgressiveFamily {
  /** Checklist rows, lowest tier first ("capacity#7"). */
  rows: string[];
  /** For each row, the logic name saying that tier is owned. */
  have: string[];
  sources: ProgressiveSource[];
}
export interface ProgressiveSource {
  name: string;
  region: string;
  age?: Age;
  needs?: string;
  night?: boolean;
  unsure?: boolean;
  /** Logic name saying this place has been used, when the game keeps one. */
  done?: string;
}

/** A location's full requirement: its category's (if any) and its own. */
export function locationNeeds(data: LogicFile, key: string): string | undefined {
  const cat = data.categoryNeeds?.[key.split('#')[0]];
  const own = data.locations[key]?.needs;
  if (cat && own) return `(${cat}) and (${own})`;
  return cat ?? own;
}

export interface LogicLocation {
  region?: string; // defaults to the checklist row's chapter (through regionAliases)
  age?: Age; // only this age can get it
  needs?: string;
  night?: boolean;
  unsure?: boolean; // the remake may differ; check in game
  note?: string;
}

export interface LocationStatus {
  ages: Age[]; // ages that can get it now (empty = not yet)
  region: string;
  needs?: string;
  night?: boolean;
  unsure?: boolean;
  note?: string;
  /** Why not (when ages is empty): unmet atoms and/or unreachable area. */
  missing: string[];
}

// ---------------- expression parsing ----------------
type Expr = { op: 'and' | 'or'; args: Expr[] } | { op: 'atom'; name: string } | { op: 'num'; name: string; min: number } | { op: 'const'; value: boolean };

const cache = new Map<string, Expr>();
export function parseExpr(src: string): Expr {
  const hit = cache.get(src);
  if (hit) return hit;
  const tokens = src.match(/\(|\)|[A-Za-z0-9_'.]+(?:>=\d+)?/g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  function parseOr(): Expr {
    const args = [parseAnd()];
    while (peek()?.toLowerCase() === 'or') { i++; args.push(parseAnd()); }
    return args.length === 1 ? args[0] : { op: 'or', args };
  }
  function parseAnd(): Expr {
    const args = [parseAtom()];
    while (peek()?.toLowerCase() === 'and') { i++; args.push(parseAtom()); }
    return args.length === 1 ? args[0] : { op: 'and', args };
  }
  function parseAtom(): Expr {
    const t = tokens[i++];
    if (t === undefined) throw new Error(`Unexpected end of "${src}"`);
    if (t === '(') { const e = parseOr(); if (tokens[i++] !== ')') throw new Error(`Missing ) in "${src}"`); return e; }
    if (t === 'true') return { op: 'const', value: true };
    if (t === 'false') return { op: 'const', value: false };
    const m = t.match(/^(.+)>=(\d+)$/);
    if (m) return { op: 'num', name: m[1], min: Number(m[2]) };
    return { op: 'atom', name: t };
  }
  const e = parseOr();
  if (i !== tokens.length) throw new Error(`Unexpected "${tokens[i]}" in "${src}"`);
  cache.set(src, e);
  return e;
}

// ---------------- evaluation ----------------
export class Logic {
  private haveCache = new Map<string, boolean>();
  private numCache = new Map<string, number>();
  private macroStack = new Set<string>();

  constructor(readonly data: LogicFile, private save: GameDataFile) {}

  private have(name: string): boolean {
    let v = this.haveCache.get(name);
    if (v === undefined) {
      const rule = this.data.items[name];
      if (!rule) throw new Error(`Unknown logic name "${name}"`);
      v = evaluate(rule, this.save) === 'yes';
      this.haveCache.set(name, v);
    }
    return v;
  }
  private num(name: string): number {
    let v = this.numCache.get(name);
    if (v === undefined) {
      const n = this.data.numbers[name];
      if (!n) throw new Error(`Unknown number "${name}"`);
      const raw = readValue(this.save, { name: n.name });
      v = typeof raw === 'number' ? raw * (n.scale ?? 1) : 0;
      this.numCache.set(name, v);
    }
    return v;
  }

  /** Evaluate an expression for one age. Collects unmet atoms into `missing` if given. */
  test(src: string | undefined, age: Age, missing?: Set<string>): boolean {
    if (!src) return true;
    return this.run(parseExpr(src), age, missing);
  }

  private run(e: Expr, age: Age, missing?: Set<string>): boolean {
    switch (e.op) {
      case 'const': return e.value;
      case 'num': { const ok = this.num(e.name) >= e.min; if (!ok) missing?.add(`${e.name} ${e.min}`); return ok; }
      case 'and': { let ok = true; for (const a of e.args) if (!this.run(a, age, missing)) ok = false; return ok; }
      case 'or': {
        const sub = new Set<string>();
        for (const a of e.args) if (this.run(a, age, sub)) return true;
        // report the shortest alternative as what's missing
        if (missing) { const alts = e.args.map(a => { const s = new Set<string>(); this.run(a, age, s); return s; }).sort((x, y) => x.size - y.size); alts[0]?.forEach(x => missing.add(x)); }
        return false;
      }
      case 'atom': {
        if (e.name === 'child' || e.name === 'adult') { const ok = age === e.name; if (!ok) missing?.add(e.name); return ok; }
        const macro = this.data.macros[e.name];
        if (macro !== undefined) {
          if (this.macroStack.has(e.name)) throw new Error(`Macro loop at "${e.name}"`);
          this.macroStack.add(e.name);
          try {
            const sub = new Set<string>();
            const ok = this.run(parseExpr(macro), age, sub);
            if (!ok) missing?.add(e.name);
            return ok;
          } finally { this.macroStack.delete(e.name); }
        }
        const ok = this.have(e.name);
        if (!ok) missing?.add(e.name);
        return ok;
      }
    }
  }

  canBeAdult(): boolean { return this.test(this.data.canBeAdult, 'adult'); }

  /** Regions reachable for an age (fixed point over exits + warps). */
  reachable(age: Age): Set<string> {
    const seen = new Set<string>();
    if (age === 'adult' && !this.canBeAdult()) return seen;
    const queue = [this.data.start[age]];
    for (const w of this.data.warps) if (this.test(w.needs, age)) queue.push(w.to);
    while (queue.length) {
      const r = queue.shift()!;
      if (seen.has(r)) continue;
      seen.add(r);
      for (const [to, needs] of Object.entries(this.data.regions[r]?.exits ?? {})) if (!seen.has(to) && this.test(needs, age)) queue.push(to);
    }
    return seen;
  }

  resolveRegion(name: string | undefined): string | undefined {
    if (!name) return undefined;
    return this.data.regions[name] ? name : this.data.regionAliases[name];
  }

  /** BFS distance in hops from one region to all others for an age. Held warp songs add edges from anywhere. */
  distances(age: Age, from: string | undefined): Map<string, number> {
    const result = new Map<string, number>();
    const resolved = this.resolveRegion(from);
    if (!resolved || !this.data.regions[resolved]) return result;
    if (age === 'adult' && !this.canBeAdult()) return result;

    const availableWarps = this.data.warps.filter(w => this.test(w.needs, age));
    const queue: [string, number][] = [[resolved, 0]];
    result.set(resolved, 0);

    while (queue.length) {
      const [region, dist] = queue.shift()!;
      for (const [to, needs] of Object.entries(this.data.regions[region]?.exits ?? {})) {
        if (!result.has(to) && this.test(needs, age)) {
          result.set(to, dist + 1);
          queue.push([to, dist + 1]);
        }
      }
      for (const w of availableWarps) {
        if (!result.has(w.to)) {
          result.set(w.to, dist + 1);
          queue.push([w.to, dist + 1]);
        }
      }
    }
    return result;
  }

  /** Nearest distance to each region as either child or adult (whichever is closer). */
  nearestDistances(from: string | undefined): Map<string, number> {
    const child = this.distances('child', from);
    const adult = this.distances('adult', from);
    const result = new Map<string, number>();
    for (const [r, d] of child) result.set(r, d);
    for (const [r, d] of adult) {
      const existing = result.get(r);
      if (existing === undefined || d < existing) result.set(r, d);
    }
    return result;
  }
}

export interface RowRef { id: string; key: string; chapter?: string }

/** Status for every checklist row that has a logic entry. */
export function evaluateLogic(data: LogicFile, save: GameDataFile, rows: RowRef[]): Map<string, LocationStatus> {
  const L = new Logic(data, save);
  const reach: Record<Age, Set<string>> = { child: L.reachable('child'), adult: L.reachable('adult') };
  const adultOk = L.canBeAdult();
  const out = new Map<string, LocationStatus>();
  const families = progressiveStatus(data, L, reach, adultOk);
  for (const r of rows) {
    const fam = families.get(r.key);
    if (fam) { out.set(r.id, fam); continue; }
    const loc = data.locations[r.key];
    if (!loc) continue;
    const region = L.resolveRegion(loc.region ?? r.chapter) ?? loc.region ?? r.chapter ?? '?';
    const ages: Age[] = [];
    const missing = new Set<string>();
    const needs = locationNeeds(data, r.key);
    for (const age of ['child', 'adult'] as Age[]) {
      if (loc.age && loc.age !== age) continue;
      if (age === 'adult' && !adultOk) { missing.add('Master Sword (to travel to adult)'); continue; }
      if (!reach[age].has(region)) { missing.add(`reach ${region} as ${age}`); continue; }
      const m = new Set<string>();
      if (L.test(needs, age, m)) ages.push(age);
      else m.forEach(x => missing.add(x));
    }
    out.set(r.id, { ages, region, needs, night: loc.night, unsure: loc.unsure, note: loc.note, missing: ages.length ? [] : labelled(data, missing) });
  }
  return out;
}

/**
 * Status of tiered upgrades. A tier can be got when the tier below it is owned and some
 * place you haven't used yet is open. Places with a `done` flag are known; for the rest
 * only the count is known (tiers owned beyond the known places), so a tier is only offered
 * when more of them are open than can have been used.
 */
function progressiveStatus(data: LogicFile, L: Logic, reach: Record<Age, Set<string>>, adultOk: boolean): Map<string, LocationStatus> {
  const out = new Map<string, LocationStatus>();
  for (const fam of Object.values(data.progressive ?? {})) {
    const owned = fam.have.filter(h => L.test(h, 'child')).length;
    const unknownSources = fam.sources.filter(s => !(s.done && L.test(s.done, 'child')));
    const usedUnknown = Math.max(0, owned - (fam.sources.length - unknownSources.length));
    const places = fam.sources.map(s => s.name).join(' or ');
    fam.rows.forEach((key, tier) => {
      const ages: Age[] = [];
      const missing = new Set<string>();
      const open: ProgressiveSource[] = [];
      if (tier > owned) missing.add(`the ${ordinal(tier)} upgrade`);
      else if (tier === owned) {
        for (const age of ['child', 'adult'] as Age[]) {
          if (age === 'adult' && !adultOk) { missing.add('Master Sword (to travel to adult)'); continue; }
          const here = unknownSources.filter(s => {
            if (s.age && s.age !== age) return false;
            const region = L.resolveRegion(s.region) ?? s.region;
            if (!reach[age].has(region)) { missing.add(`reach ${region} as ${age}`); return false; }
            const m = new Set<string>();
            if (L.test(locationNeedsOf(data, key, s.needs), age, m)) return true;
            m.forEach(x => missing.add(x));
            return false;
          });
          // Places without a flag may be the ones already used.
          if (here.filter(s => !s.done).length > usedUnknown || here.some(s => s.done)) { ages.push(age); open.push(...here); }
        }
      }
      const first = open[0] ?? fam.sources[0];
      out.set(key, {
        ages, region: L.resolveRegion(first.region) ?? first.region, needs: first.needs, night: first.night,
        unsure: fam.sources.some(s => s.unsure) || undefined,
        note: `Comes from ${places}, whichever you do first; the other gives the next one.`,
        missing: ages.length ? [] : labelled(data, missing),
      });
    });
  }
  return out;
}
const ordinal = (n: number) => ['first', 'second', 'third', 'fourth'][n - 1] ?? `#${n}`;
function locationNeedsOf(data: LogicFile, key: string, own?: string): string | undefined {
  const cat = data.categoryNeeds?.[key.split('#')[0]];
  if (cat && own) return `(${cat}) and (${own})`;
  return cat ?? own;
}

/** Problems in a logic file: unknown names, unknown regions, bad expressions. */
export function lintLogic(data: LogicFile, rowKeys: Set<string>): string[] {
  const errs: string[] = [];
  const known = new Set([...Object.keys(data.items), ...Object.keys(data.macros), 'child', 'adult', 'true', 'false']);
  const check = (src: string | undefined, where: string) => {
    if (!src) return;
    try {
      const walk = (e: Expr): void => {
        if (e.op === 'and' || e.op === 'or') e.args.forEach(walk);
        else if (e.op === 'atom' && !known.has(e.name)) errs.push(`${where}: unknown name "${e.name}"`);
        else if (e.op === 'num' && !data.numbers[e.name]) errs.push(`${where}: unknown number "${e.name}"`);
      };
      walk(parseExpr(src));
    } catch (err) { errs.push(`${where}: ${(err as Error).message}`); }
  };
  for (const [k, v] of Object.entries(data.macros)) check(v, `macro ${k}`);
  check(data.canBeAdult, 'canBeAdult');
  for (const [r, def] of Object.entries(data.regions)) for (const [to, n] of Object.entries(def.exits)) {
    if (!data.regions[to]) errs.push(`region ${r}: exit to unknown region "${to}"`);
    check(n, `${r} -> ${to}`);
  }
  for (const w of data.warps) { if (!data.regions[w.to]) errs.push(`warp to unknown region "${w.to}"`); check(w.needs, `warp ${w.to}`); }
  for (const a of Object.values(data.start)) if (!data.regions[a]) errs.push(`start region "${a}" unknown`);
  for (const [k, l] of Object.entries(data.locations)) {
    if (!rowKeys.has(k)) errs.push(`location ${k}: no such checklist row`);
    if (l.region && !data.regions[l.region] && !data.regionAliases[l.region]) errs.push(`location ${k}: unknown region "${l.region}"`);
    check(l.needs, `location ${k}`);
  }
  for (const [c, n] of Object.entries(data.categoryNeeds ?? {})) check(n, `categoryNeeds ${c}`);
  for (const [f, fam] of Object.entries(data.progressive ?? {})) {
    if (fam.rows.length !== fam.have.length) errs.push(`progressive ${f}: rows and have differ in length`);
    for (const k of fam.rows) if (!rowKeys.has(k)) errs.push(`progressive ${f}: no such checklist row ${k}`);
    fam.have.forEach(h => check(h, `progressive ${f} have`));
    for (const s of fam.sources) {
      if (!data.regions[s.region] && !data.regionAliases[s.region]) errs.push(`progressive ${f}: unknown region "${s.region}"`);
      check(s.needs, `progressive ${f} ${s.name}`); check(s.done, `progressive ${f} ${s.name} done`);
    }
  }
  for (const [a, r] of Object.entries(data.regionAliases)) if (!data.regions[r]) errs.push(`alias ${a} -> unknown region "${r}"`);
  if (data.labels) for (const n of [...Object.keys(data.items), ...Object.keys(data.numbers), ...Object.keys(data.macros)]) {
    if (!data.labels[n]) errs.push(`no label for "${n}"`);
  }
  return errs;
}
