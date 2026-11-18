import { describe, it, expect } from 'vitest';
import { formatSavedAt, heartsText, recentLabel, slotLabel, slotTitle, timeAgo } from '../src/renderer/slot-label.js';
import type { SlotSummary } from '../src/shared/types.js';

const NOW = 1_800_000_000_000;
const opts = { formatTime: () => 'Nov 17, 4:33 PM', now: NOW };

const full: SlotSummary = {
  name: 'slot_03', mtimeMs: NOW - 5 * 60_000, area: 'Hyrule Field (child)', age: 'child',
  hearts: 5, maxHearts: 5, savedAt: NOW - 60_000, autoSave: true,
  rupees: 999, tokens: 16, songs: 12, medals: 6, stones: 3,
};
const FULL_LABEL = 'Slot 3 · Hyrule Field (child) · 5/5 hearts · Nov 17, 4:33 PM · auto';
const FULL_TITLE = '999 rupees · 16 Gold Skulltula tokens · 12 songs · 6 medals · 3 stones';

const without = (...keys: (keyof SlotSummary)[]) => {
  const s = { ...full };
  for (const k of keys) delete s[k];
  return s;
};

describe('heartsText', () => {
  it.each([[0, '0'], [0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1, '1'], [4, '4'], [4.25, '4¼'], [4.5, '4½'], [4.75, '4¾'], [20, '20']])('%d -> %s', (h, text) => {
    expect(heartsText(h)).toBe(text);
  });

  it.each([[undefined], [NaN], [Infinity], [-1]])('%s gives nothing', h => {
    expect(heartsText(h)).toBe('');
  });
});

describe('slotLabel', () => {
  it('shows everything it knows', () => {
    expect(slotLabel(full, opts)).toBe(FULL_LABEL);
  });

  it('does not repeat an age the area name already has', () => {
    expect(slotLabel(full, opts).match(/\(child\)/g)).toHaveLength(1);
  });

  it('adds the age to an area name without one', () => {
    expect(slotLabel({ ...full, area: 'Market', age: 'adult' }, opts)).toContain('· Market (adult) ·');
  });

  it('shows the age alone when the area is unknown', () => {
    expect(slotLabel(without('area'), opts)).toBe('Slot 3 · child · 5/5 hearts · Nov 17, 4:33 PM · auto');
  });

  it('keeps slot numbers readable', () => {
    expect(slotLabel({ name: 'slot_10', mtimeMs: 0 })).toBe('Slot 10');
    expect(slotLabel({ name: 'slot_00', mtimeMs: 0 })).toBe('Slot 0');
    expect(slotLabel({ name: 'other', mtimeMs: 0 })).toBe('other');
  });

  it.each([
    ['area and age', ['area', 'age'], 'Slot 3 · 5/5 hearts · Nov 17, 4:33 PM · auto'],
    ['age', ['age'], FULL_LABEL],
    ['hearts', ['hearts'], 'Slot 3 · Hyrule Field (child) · Nov 17, 4:33 PM · auto'],
    ['max hearts', ['maxHearts'], 'Slot 3 · Hyrule Field (child) · 5 hearts · Nov 17, 4:33 PM · auto'],
    ['save time', ['savedAt'], 'Slot 3 · Hyrule Field (child) · 5/5 hearts · 5 min ago · auto'],
    ['auto flag', ['autoSave'], 'Slot 3 · Hyrule Field (child) · 5/5 hearts · Nov 17, 4:33 PM'],
  ] as [string, (keyof SlotSummary)[], string][])('leaves out %s when missing', (_what, keys, text) => {
    expect(slotLabel(without(...keys), opts)).toBe(text);
  });

  it('never prints a placeholder, with nothing or with bad numbers', () => {
    const bad: SlotSummary = { name: 'slot_01', mtimeMs: NaN, hearts: NaN, maxHearts: NaN, savedAt: NaN, rupees: NaN, tokens: NaN, songs: NaN, medals: NaN, stones: NaN };
    expect(slotLabel(bad, opts)).toBe('Slot 1');
    expect(slotLabel({ name: 'slot_01', mtimeMs: 0 }, opts)).toBe('Slot 1');
    expect(slotTitle(bad)).toBeUndefined();
  });

  it('shows zero hearts and quarter hearts', () => {
    expect(slotLabel({ name: 'slot_01', mtimeMs: 0, hearts: 0, maxHearts: 3 })).toBe('Slot 1 · 0/3 hearts');
    expect(slotLabel({ name: 'slot_01', mtimeMs: 0, hearts: 4.75, maxHearts: 5 })).toBe('Slot 1 · 4¾/5 hearts');
    expect(slotLabel({ name: 'slot_01', mtimeMs: 0, hearts: 1 })).toBe('Slot 1 · 1 heart');
  });

  it('marks only auto saves', () => {
    expect(slotLabel({ ...full, autoSave: false }, opts)).not.toContain('auto');
  });

  it('prefers the save time and falls back to the file time', () => {
    const seen: number[] = [];
    slotLabel(full, { now: NOW, formatTime: ms => { seen.push(ms); return 'x'; } });
    expect(seen).toEqual([full.savedAt]);
    expect(slotLabel(without('savedAt'), opts)).toContain(timeAgo(full.mtimeMs, NOW));
  });

  it('formats the save time as short month, day, hour and minute', () => {
    const text = formatSavedAt(Date.UTC(2026, 10, 17, 16, 33, 42), 'en-US', 'UTC');
    expect(text.replace(/\s/g, ' ')).toBe('Nov 17, 4:33 PM');
  });
});

describe('recentLabel', () => {
  it('names only the slot', () => {
    expect(recentLabel(full)).toBe('Most recent (Slot 3)');
  });

  it('keeps an unusual slot name', () => {
    expect(recentLabel({ name: 'other', mtimeMs: 0 })).toBe('Most recent (other)');
  });

  it('copes with no slots', () => {
    expect(recentLabel(undefined)).toBe('Most recent');
  });
});

describe('slotTitle', () => {
  it('lists the counts', () => {
    expect(slotTitle(full)).toBe(FULL_TITLE);
  });

  it('counts zero and one properly', () => {
    expect(slotTitle({ name: 'slot_01', mtimeMs: 0, rupees: 0, tokens: 1, songs: 1, medals: 0, stones: 1 }))
      .toBe('0 rupees · 1 Gold Skulltula token · 1 song · 0 medals · 1 stone');
  });

  it.each([
    ['rupees', 'rupees'], ['tokens', 'Gold Skulltula'], ['songs', 'songs'], ['medals', 'medals'], ['stones', 'stones'],
  ] as [keyof SlotSummary, string][])('leaves out %s when missing', (key, word) => {
    const title = slotTitle(without(key))!;
    expect(title).not.toContain(word);
    expect(title).not.toMatch(/undefined|NaN|\?/);
  });

  it('is absent when nothing is known', () => {
    expect(slotTitle({ name: 'slot_01', mtimeMs: 1 })).toBeUndefined();
  });
});
