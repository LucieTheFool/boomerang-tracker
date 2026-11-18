import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { DEFAULTS, SettingsStore, cleanFilters, cleanHotkeys, cleanLive, cleanOverlay, cleanUi } from '../src/main/settings';
import { NO_FILTERS } from '../src/shared/types';
import { NO_FILTERS as RENDERER_NO_FILTERS } from '../src/renderer/filter';

const GARBAGE: [string, unknown][] = [['null', null], ['undefined', undefined], ['a number', 7], ['a string', 'abc'], ['an array', [1, 'x']], ['true', true]];

describe('cleanLive', () => {
  it('keeps only hex hints', () => {
    expect(cleanLive({ enabled: true, hint: '10108bdaf418', hints: ['10108BDAF418', 'nope', '0x12', '', 5, null, '12345678901234567'] }))
      .toEqual({ enabled: true, hint: '10108bdaf418', hints: ['10108BDAF418'] });
  });
  it('drops a bad hint and an empty list', () => {
    expect(cleanLive({ hint: 'zz', hints: ['zz'] })).toEqual({ enabled: true });
    expect(cleanLive({ hints: 'abc' })).toEqual({ enabled: true });
  });
  it('stays off only when turned off', () => {
    expect(cleanLive({ enabled: false }).enabled).toBe(false);
    expect(cleanLive({}).enabled).toBe(true);
  });
  it('keeps unknown fields', () => expect(cleanLive({ later: 1 })).toEqual({ enabled: true, later: 1 }));
});

describe('cleanUi', () => {
  it('keeps good values and unknown fields', () => {
    const ui = {
      hideCollected: true, hiddenCategories: ['a'], collapsed: ['b'], showParts: { B: false, C: true, D: 'kept' }, availableHeight: 240.5,
      availableFilters: { search: 'x', area: 'Kokiri Forest', category: 'Heart Pieces', age: 'adult', nightOnly: true, hereOnly: true, later: 1 },
      later: { nested: true },
    };
    expect(cleanUi(ui)).toEqual(ui);
  });

  it.each([
    ['hideCollected', 'yes', false],
    ['hiddenCategories', 'a', []],
    ['collapsed', { 0: 'a' }, []],
    ['showParts', 'B', { B: true, C: false }],
  ])('repairs %s', (field, bad, good) => {
    expect(cleanUi({ [field]: bad })).toEqual({ ...DEFAULTS.ui, [field]: good });
  });

  it('keeps the strings of a mixed list', () => {
    const ui = cleanUi({ hiddenCategories: ['a', 1, null, 'b'], collapsed: [{}, 'c'] });
    expect(ui.hiddenCategories).toEqual(['a', 'b']);
    expect(ui.collapsed).toEqual(['c']);
  });

  it('repairs each part on its own', () => {
    expect(cleanUi({ showParts: { B: false, C: 'yes' } }).showParts).toEqual({ B: false, C: false });
    expect(cleanUi({ showParts: { B: 1, C: true } }).showParts).toEqual({ B: true, C: true });
  });

  it.each([['a string', '200'], ['zero', 0], ['negative', -5], ['NaN', NaN], ['infinite', Infinity], ['null', null]])('drops an availableHeight that is %s', (_n, bad) => {
    expect('availableHeight' in cleanUi({ availableHeight: bad })).toBe(false);
  });

  it.each([['a string', 'x'], ['a number', 1], ['an array', []], ['null', null]])('drops availableFilters that are %s', (_n, bad) => {
    expect('availableFilters' in cleanUi({ availableFilters: bad })).toBe(false);
  });

  it('leaves absent optional fields absent', () => expect(cleanUi({})).toEqual(DEFAULTS.ui));

  it('does not share lists with the defaults', () => {
    cleanUi({}).hiddenCategories.push('x');
    cleanUi({}).showParts.B = false;
    expect(DEFAULTS.ui).toEqual({ hideCollected: false, hiddenCategories: [], collapsed: [], showParts: { B: true, C: false } });
  });
});

describe('cleanFilters', () => {
  const good = { search: 'kokiri', area: 'Kokiri Forest', category: 'Heart Pieces', age: 'child', nightOnly: true, hereOnly: true };

  it.each([
    ['search', null], ['search', 5],
    ['area', 5], ['area', false],
    ['category', 5], ['category', []],
    ['age', 'elder'], ['age', 1],
    ['nightOnly', 'yes'], ['nightOnly', null],
    ['hereOnly', 1], ['hereOnly', null],
  ])('resets a bad %s (%s) and keeps the rest', (field, bad) => {
    expect(cleanUi({ availableFilters: { ...good, [field]: bad } }).availableFilters)
      .toEqual({ ...good, [field]: NO_FILTERS[field as keyof typeof NO_FILTERS] });
  });

  it('accepts null where it means "no restriction"', () => {
    const f = { ...good, area: null, category: null, age: null };
    expect(cleanFilters(f)).toEqual(f);
  });

  it('fills in missing fields', () => expect(cleanFilters({ search: 'x' })).toEqual({ ...NO_FILTERS, search: 'x' }));

  it('is the same default the renderer uses', () => expect(RENDERER_NO_FILTERS).toBe(NO_FILTERS));
});

describe('cleanOverlay', () => {
  it('keeps good values, bounds and unknown fields', () => {
    const o = { opacity: 0.5, locked: false, mode: 'available', bounds: { x: 1, y: 2, width: 300, height: 200 }, later: 1 };
    expect(cleanOverlay(o)).toEqual(o);
  });
  it.each([0, 1])('accepts opacity %s', opacity => expect(cleanOverlay({ opacity }).opacity).toBe(opacity));
  it.each([['opacity', '0.5'], ['opacity', -0.1], ['opacity', 1.1], ['opacity', NaN], ['locked', 'no'], ['mode', 'huge'], ['mode', 1]])('repairs %s = %s', (field, bad) => {
    expect(cleanOverlay({ [field]: bad })).toEqual(DEFAULTS.overlay);
  });
});

describe('cleanHotkeys', () => {
  it('keeps strings and unknown fields', () => {
    const h = { toggleOverlay: 'F8', lockOverlay: '', later: 1 };
    expect(cleanHotkeys(h)).toEqual(h);
  });
  it('repairs non-strings', () => {
    expect(cleanHotkeys({ toggleOverlay: 8, lockOverlay: null })).toEqual(DEFAULTS.hotkeys);
  });
});

describe.each(GARBAGE)('given %s', (_name, raw) => {
  it('every cleaner answers the defaults', () => {
    expect(cleanLive(raw)).toEqual(DEFAULTS.live);
    expect(cleanUi(raw)).toEqual(DEFAULTS.ui);
    expect(cleanFilters(raw)).toEqual(NO_FILTERS);
    expect(cleanOverlay(raw)).toEqual(DEFAULTS.overlay);
    expect(cleanHotkeys(raw)).toEqual(DEFAULTS.hotkeys);
  });
});

describe('SettingsStore load', () => {
  const load = (content: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-clean-'));
    try {
      const file = path.join(dir, 'settings.json');
      fs.writeFileSync(file, content);
      return new SettingsStore(file).data;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  it('repairs a hand-edited file and keeps the rest of it', () => {
    const s = load(JSON.stringify({
      saveDir: 'D:\\saves', devPanel: true,
      ui: { hideCollected: 'no', collapsed: ['a'], availableFilters: { age: 'elder', search: 'x' } },
      overlay: { opacity: 9, mode: 'available' },
      hotkeys: { toggleOverlay: 1 },
      live: { hint: 'nope', hints: ['abc', 'nope'] },
    }));
    expect(s.saveDir).toBe('D:\\saves');
    expect(s.devPanel).toBe(true);
    expect(s.ui).toEqual({ ...DEFAULTS.ui, collapsed: ['a'], availableFilters: { ...NO_FILTERS, search: 'x' } });
    expect(s.overlay).toEqual({ ...DEFAULTS.overlay, mode: 'available' });
    expect(s.hotkeys).toEqual(DEFAULTS.hotkeys);
    expect(s.live).toEqual({ enabled: true, hints: ['abc'] });
  });

  it.each(['null', '7', '"abc"', '[1,2]', '{broken'])('uses the defaults for %s', content => {
    expect(load(content)).toEqual(DEFAULTS);
  });
});
