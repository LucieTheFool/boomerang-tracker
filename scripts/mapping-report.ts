// Evaluates data/save-mapping.json against each fixture slot, walking data/checklist.json.
//   npx tsx scripts/mapping-report.ts [fixtures/save] [--all]
// Per category: mapped vs unmapped and confidence. With --all, every entry's result per
// slot (■ yes, · no, ? key missing from the save, blank = unmapped).
import fs from 'node:fs';
import path from 'node:path';
import { parseGameData, GameDataFile } from '../src/gamedata/parser.js';
import { evaluate, evaluateCounter, Rule, CounterRule, readValue } from '../src/gamedata/detect.js';

interface MapEntry { label: string; detect: Rule | null; confidence: string; evidence: string }
const mapping = JSON.parse(fs.readFileSync('data/save-mapping.json', 'utf8')) as {
  entries: Record<string, MapEntry>;
  counters: Record<string, CounterRule & { confidence: string }>;
  derived: Record<string, { name?: string; scale?: number }>;
};
const checklist = JSON.parse(fs.readFileSync('data/checklist.json', 'utf8')) as {
  categories: { id: string; label: string; part: string; kind: string; max?: number; items: { id: string; number: number; name: string }[] }[];
};

const args = process.argv.slice(2);
const all = args.includes('--all');
const root = args.find(a => !a.startsWith('--')) ?? 'fixtures/save';
const slots = fs.readdirSync(root).filter(d => /^slot_\d+$/.test(d)).sort();
const saves: GameDataFile[] = slots.map(s => parseGameData(fs.readFileSync(path.join(root, s, 'progress.sav'))));

const sym = { yes: '■', no: '·', unknown: '?' } as const;
let missingKeys = 0;
const known = new Set(checklist.categories.flatMap(c => c.items.map(i => i.id)));
const orphans = Object.keys(mapping.entries).filter(id => !known.has(id));

const rows: string[] = [];
console.log(`slots: ${slots.map(s => s.slice(-2)).join(' ')}\n`);
for (const c of checklist.categories) {
  if (c.kind === 'counter') {
    const ctr = mapping.counters[c.id];
    const vals = ctr ? saves.map(g => evaluateCounter(ctr, g) ?? '?') : [];
    rows.push(`| ${c.label} | ${c.part} | counter 0–${c.max} | ${ctr ? 'mapped' : '—'} | ${ctr?.confidence ?? ''} |`);
    console.log(`## ${c.label} [counter]  ${ctr ? `${ctr.confidence}; values ${vals.join(' ')}` : 'UNMAPPED'}\n`);
    continue;
  }
  const conf: Record<string, number> = {};
  let mapped = 0;
  for (const it of c.items) {
    const e = mapping.entries[it.id];
    const k = e?.detect ? e.confidence : 'unmapped';
    conf[k] = (conf[k] ?? 0) + 1;
    if (e?.detect) mapped++;
  }
  const confStr = ['confirmed', 'likely', 'guess', 'unmapped'].filter(k => conf[k]).map(k => `${conf[k]} ${k}`).join(', ');
  rows.push(`| ${c.label} | ${c.part} | ${mapped}/${c.items.length} | ${confStr} |`);
  console.log(`## ${c.label} (part ${c.part}): ${mapped}/${c.items.length} mapped — ${confStr}`);
  for (const it of c.items) {
    const e = mapping.entries[it.id];
    const states = saves.map(g => (e?.detect ? evaluate(e.detect, g) : null));
    if (states.includes('unknown')) missingKeys++;
    if (all || states.includes('unknown')) {
      console.log(`  ${states.map(s => (s ? sym[s] : ' ')).join('  ')}   ${String(it.number).padStart(3)} ${it.name.slice(0, 60).padEnd(60)} ${e?.detect ? e.confidence : ''}`);
    }
  }
  if (all) console.log();
}
console.log('\n## derived');
for (const [k, d] of Object.entries(mapping.derived)) {
  if (!d.name) continue;
  const vals = saves.map(g => { const v = readValue(g, { name: d.name }); return typeof v === 'number' ? v * (d.scale ?? 1) : '?'; });
  console.log(`  ${k.padEnd(22)} ${vals.join('  ')}`);
}
if (orphans.length) console.log(`\nMapping ids not in the checklist: ${orphans.join(', ')}`);
console.log(missingKeys ? `\n${missingKeys} entries read keys missing from the save (shown as ?)` : '\nAll mapped rules read keys that exist in the save.');
if (args.includes('--markdown')) console.log('\n' + rows.join('\n'));
