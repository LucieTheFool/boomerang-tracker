// Every checklist row must have its own item icon: data/checklist.json iconId -> src/renderer/assets/items/<iconId>.svg.
// A new row without a drawn icon fails here instead of shipping with a generic symbol.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const checklist = JSON.parse(fs.readFileSync(path.join(root, 'data/checklist.json'), 'utf8'));
const iconDir = path.join(root, 'src/renderer/assets/items');
const icons = new Set(fs.readdirSync(iconDir).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)));

/** Rows allowed to go without their own icon (none today). Add "<categoryId>/<rowId>" with a reason. */
const ALLOW: ReadonlySet<string> = new Set([]);

type Row = { id: string; name: string; iconId?: string };
const categories: { id: string; items?: Row[] }[] = checklist.categories ?? checklist;

describe('item icons', () => {
  const rows = categories.flatMap(c => (c.items ?? []).map(r => ({ cat: c.id, ...r })));

  it('the checklist has rows', () => {
    expect(rows.length).toBeGreaterThan(300);
  });

  it('every row names an icon that exists', () => {
    const missing = rows
      .filter(r => !ALLOW.has(`${r.cat}/${r.id}`))
      .filter(r => !r.iconId || !icons.has(r.iconId))
      .map(r => `${r.cat}/${r.id} (${r.name}) -> ${r.iconId ?? 'no iconId'}`);
    expect(missing).toEqual([]);
  });

  it('every icon file is a 32x32 SVG', () => {
    const bad = [...icons].filter(id => {
      const svg = fs.readFileSync(path.join(iconDir, `${id}.svg`), 'utf8');
      return !/^<svg[^>]*viewBox="0 0 32 32"/.test(svg.trimStart());
    });
    expect(bad).toEqual([]);
  });
});
