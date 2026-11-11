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
}

export interface RowRef { id: string; key: string; chapter?: string }

/** Status for every checklist row that has a logic entry. */
export function evaluateLogic(data: LogicFile, save: GameDataFile, rows: RowRef[]): Map<string, LocationStatus> {
  const L = new Logic(data, save);
  const reach: Record<Age, Set<string>> = { child: L.reachable('child'), adult: L.reachable('adult') };
  const adultOk = L.canBeAdult();
  const out = new Map<string, LocationStatus>();
  for (const r of rows) {
    const loc = data.locations[r.key];
    if (!loc) continue;
    const region = L.resolveRegion(loc.region ?? r.chapter) ?? loc.region ?? r.chapter ?? '?';
    const ages: Age[] = [];
    const missing = new Set<string>();
    for (const age of ['child', 'adult'] as Age[]) {
      if (loc.age && loc.age !== age) continue;
      if (age === 'adult' && !adultOk) { missing.add('Master Sword (to travel to adult)'); continue; }
      if (!reach[age].has(region)) { missing.add(`reach ${region} as ${age}`); continue; }
      const m = new Set<string>();
      if (L.test(loc.needs, age, m)) ages.push(age);
      else m.forEach(x => missing.add(x));
    }
    out.set(r.id, { ages, region, needs: loc.needs, night: loc.night, unsure: loc.unsure, note: loc.note, missing: ages.length ? [] : [...missing] });
  }
  return out;
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
  for (const [a, r] of Object.entries(data.regionAliases)) if (!data.regions[r]) errs.push(`alias ${a} -> unknown region "${r}"`);
  return errs;
}
