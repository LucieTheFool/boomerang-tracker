import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { NO_FILTERS, entryLabel, filterCanGetNow, filterChoices, hasActiveFilters, normalize } from '../src/renderer/filter.js';
import { SettingsStore } from '../src/main/settings.js';
import type { AvailableEntry } from '../src/shared/types.js';

const row = (id: string, name: string, region: string, extra: Partial<AvailableEntry> = {}): AvailableEntry => ({
  id, name, region, categoryId: 'heart_pieces', categoryLabel: 'Heart Pieces', number: 1, ages: ['child', 'adult'], here: false, ...extra,
});

// Current area first, as the controller sends them.
const rows: AvailableEntry[] = [
  row('a', "Kokiri Forest: Behind Mido's House", 'Kokiri Forest', { here: true, ages: ['child'] }),
  row('b', 'Kokiri Forest: Soft soil', 'Kokiri Forest', { here: true, categoryId: 'gold_skulltulas', categoryLabel: 'Gold Skulltulas', number: 12, night: true, ages: ['child'] }),
  row('c', 'Lake Hylia: South-west tunnel', 'Lake Hylia', { ages: ['adult'] }),
  row('d', "Zora's Fountain", "Zora's Domain", { categoryId: 'songs', categoryLabel: 'Songs', night: true }),
  row('e', 'Crème Brûlée Stand', 'Market', { categoryId: 'masks', categoryLabel: 'Masks', ages: ['adult'] }),
];
const ids = (list: AvailableEntry[]) => list.map(r => r.id);

describe('normalize', () => {
  it('drops case, accents and punctuation', () => {
    expect(normalize("Kokiri's")).toBe('kokiris');
    expect(normalize('Kokiri’s')).toBe('kokiris');
    expect(normalize('CRÈME  Brûlée')).toBe('creme brulee');
    expect(normalize('South-West!')).toBe('southwest');
  });
  it('leaves nothing of a punctuation-only text', () => expect(normalize(" '-! ")).toBe(''));
});

describe('entryLabel', () => {
  it('matches what the chip shows', () => {
    expect(entryLabel(rows[0])).toBe("Behind Mido's House");
    expect(entryLabel(rows[1])).toBe('GS 12: Soft soil');
  });
});

describe('filterCanGetNow: search', () => {
  const search = (s: string) => ids(filterCanGetNow(rows, { search: s }));

  it('matches the label', () => expect(search('soft soil')).toEqual(['b']));
  it('matches the area', () => expect(search('lake hylia')).toEqual(['c']));
  it('is case-insensitive', () => expect(search('MARKET')).toEqual(['e']));
  it('ignores accents both ways', () => {
    expect(search('creme brulee')).toEqual(['e']);
    expect(search('crème')).toEqual(['e']);
  });
  it('ignores punctuation both ways', () => {
    expect(search('midos')).toEqual(['a']);
    expect(search("Mido's")).toEqual(['a']);
    expect(search('zoras')).toEqual(['d']);
  });
  it('treats hyphens and spaces alike', () => {
    expect(search('south west')).toEqual(['c']);
    expect(search('southwest')).toEqual(['c']);
    expect(search('kokiriforest')).toEqual(['a', 'b']);
  });
  it('finds a Skulltula by the number on its chip', () => expect(search('GS 12')).toEqual(['b']));
  it('lets words match across label and area', () => expect(search('tunnel hylia')).toEqual(['c']));
  it('needs every word', () => expect(search('tunnel market')).toEqual([]));
  it('returns nothing without a match', () => expect(search('ganon')).toEqual([]));
  it('treats a blank or punctuation-only search as no search', () => {
    expect(filterCanGetNow(rows, { search: '   ' })).toBe(rows);
    expect(filterCanGetNow(rows, { search: "'" })).toBe(rows);
  });
});

describe('filterCanGetNow: single filters', () => {
  it('area', () => expect(ids(filterCanGetNow(rows, { area: 'Kokiri Forest' }))).toEqual(['a', 'b']));
  it('category', () => expect(ids(filterCanGetNow(rows, { category: 'Songs' }))).toEqual(['d']));
  it('age child includes entries for both ages', () => expect(ids(filterCanGetNow(rows, { age: 'child' }))).toEqual(['a', 'b', 'd']));
  it('age adult includes entries for both ages', () => expect(ids(filterCanGetNow(rows, { age: 'adult' }))).toEqual(['c', 'd', 'e']));
  it('night only', () => expect(ids(filterCanGetNow(rows, { nightOnly: true }))).toEqual(['b', 'd']));
  it('here', () => expect(ids(filterCanGetNow(rows, { hereOnly: true }))).toEqual(['a', 'b']));
  it('an unknown area returns nothing, not everything', () => expect(filterCanGetNow(rows, { area: 'Termina' })).toEqual([]));
  it('an unknown category returns nothing', () => expect(filterCanGetNow(rows, { category: 'Rupees' })).toEqual([]));
});

describe('filterCanGetNow: together', () => {
  it('applies every filter at once', () => {
    expect(ids(filterCanGetNow(rows, { age: 'child', nightOnly: true }))).toEqual(['b', 'd']);
    expect(ids(filterCanGetNow(rows, { age: 'child', nightOnly: true, hereOnly: true }))).toEqual(['b']);
    expect(ids(filterCanGetNow(rows, { search: 'kokiri', category: 'Heart Pieces', area: 'Kokiri Forest' }))).toEqual(['a']);
  });
  it('returns nothing when the filters exclude each other', () => {
    expect(filterCanGetNow(rows, { area: 'Market', hereOnly: true })).toEqual([]);
  });
  it('keeps the incoming order and leaves the input alone', () => {
    const reversed = [...rows].reverse();
    const copy = [...reversed];
    expect(ids(filterCanGetNow(reversed, { nightOnly: true }))).toEqual(['d', 'b']);
    expect(reversed).toEqual(copy);
  });
  it('returns the input unchanged with empty filters', () => {
    expect(filterCanGetNow(rows, {})).toBe(rows);
    expect(filterCanGetNow(rows, NO_FILTERS)).toBe(rows);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults and a blank search', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, search: ' - ' })).toBe(false);
  });
  it('is true for each kind of filter', () => {
    for (const p of [{ search: 'x' }, { area: 'Market' }, { category: 'Songs' }, { age: 'adult' as const }, { nightOnly: true }, { hereOnly: true }]) {
      expect(hasActiveFilters({ ...NO_FILTERS, ...p })).toBe(true);
    }
  });
});

describe('filterChoices', () => {
  it('gives each value once, sorted', () => expect(filterChoices(['b', 'a', 'b'], null)).toEqual(['a', 'b']));
  it('keeps a saved choice that left the list', () => expect(filterChoices(['b'], 'a')).toEqual(['a', 'b']));
});

describe('saved filters', () => {
  it('survive a restart with the other UI preferences', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cangetnow-'));
    try {
      const file = path.join(dir, 'settings.json');
      const saved = { ...NO_FILTERS, search: 'kokiri', area: 'Kokiri Forest', age: 'child' as const, hereOnly: true };
      new SettingsStore(file).update(s => { s.ui = { ...s.ui, availableFilters: saved }; });
      const ui = new SettingsStore(file).data.ui;
      expect(ui.availableFilters).toEqual(saved);
      expect(ui.showParts).toEqual({ B: true, C: false });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
