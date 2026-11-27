import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardDone, hallCard, playDataCard, sectionDone, thresholdText, threadsCard, unmappedCount, wipCards, wipStatus, withLinks, type WipEntry, type WipLinks, type WipSection } from '../src/renderer/wip';
import linksFile from '../data/wip-links.json';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WipCardView } from '../src/renderer/WipSections';
import { SYMBOLS } from '../src/renderer/symbols';
import type { TrackedCategory } from '../src/shared/types';

const links: WipLinks = linksFile; // stats is empty today, which JSON typing would read as {}

const titles = (sections: { title: string }[]) => sections.map(s => s.title);
const byTitle = <T extends { title: string }>(list: T[], title: string) => list.find(s => s.title === title)!;

describe('WIP 100% sections (wip.ts)', () => {
  it('builds the three cards in order', () => {
    expect(wipCards.map(c => c.title)).toEqual(['My Play Data', 'Hall of Fallen Foes', 'Threads of Time']);
    expect(new Set(wipCards.map(c => c.id)).size).toBe(3);
  });

  it('My Play Data: one bar per medal with a known Master threshold', () => {
    const c = wipCards[0];
    expect(c.stats).toHaveLength(11);
    expect(c.total).toBe(11);
    expect(c.stats!.find(s => s.id === 'citizen_of_hyrule')).toEqual({ id: 'citizen_of_hyrule', name: 'Citizen of Hyrule', master: 60, unit: 'hours' });
    expect(c.unthresholded).toBe(10);
  });

  it('My Play Data skips medals without tiers or with a null Master threshold', () => {
    const c = playDataCard({ medals: [
      { id: 'a', name: 'A', tiers: { master: { threshold: 5, unit: 'x' } } },
      { id: 'b', name: 'B', tiers: { master: { threshold: null, unit: 'x' } } },
      { id: 'c', name: 'C' },
    ] });
    expect(c.stats!.map(s => s.id)).toEqual(['a']);
    expect(c.unthresholded).toBe(2);
  });

  it('My Play Data leaves out a medal marked display: false, from the bars and the unthresholded count', () => {
    const c = playDataCard({ medals: [
      { id: 'a', name: 'A', tiers: { master: { threshold: 5, unit: 'x' } } },
      { id: 'hidden', name: 'H', display: false, tiers: { master: { threshold: 100, unit: 'x' } } },
      { id: 'gone', name: 'G', display: false },
    ] });
    expect(c.stats!.map(s => s.id)).toEqual(['a']);
    expect(c.total).toBe(1);
    expect(c.unthresholded).toBe(0);
  });

  it('Hall of Fallen Foes: six statue areas, three trials, rematches from rectangular pedestals', () => {
    const c = wipCards[1];
    expect(titles(c.sections)).toEqual(['Monster Statues', 'Gauntlet Trials', 'Boss Rematches']);
    const statues = byTitle(c.sections, 'Monster Statues');
    expect(statues.total).toBe(84); // the file's declared total_statues; it lists fewer so far (the card says so)
    expect(statues.folds!.map(f => f.title)).toEqual(['Forest', 'Mountain', 'Water', 'Desert', 'Darkness', 'Field and Castle']);
    const trials = byTitle(c.sections, 'Gauntlet Trials');
    expect(trials.entries.map(t => t.detail)).toEqual(['3 bosses', '5 bosses', '10 bosses']);
    const rematches = byTitle(c.sections, 'Boss Rematches');
    expect(rematches.entries.map(e => e.name)).toContain('Phantom Ganon');
    expect(rematches.entries.map(e => e.name)).not.toContain('Deku Baba');
  });

  it('a statue list longer than the declared total raises the total instead of overflowing it', () => {
    const c = hallCard({ total_statues: 1, gauntlet_trials: [], categories: [{ id: 'f', name: 'F', enemies: [
      { id: 'a', name: 'A', pedestal: 'round' }, { id: 'b', name: 'B', pedestal: 'rectangular' },
    ] }] });
    expect(c.sections[0].total).toBe(2);
    expect(c.sections[2].entries.map(e => e.id)).toEqual(['b']);
  });

  it('Threads of Time: quests in game order, sub-quests nested', () => {
    const c = wipCards[2];
    const main = byTitle(c.sections, 'Main Quests');
    expect(main.total).toBe(8);
    expect(main.entries[0].id).toBe('link_wakes_up');
    expect(main.entries.find(q => q.id === 'awakening_five_sages')!.sub).toHaveLength(5);
    expect(byTitle(c.sections, 'Side Quests').total).toBe(7);
    const sorted = threadsCard({ main_story_quests: { total: 2, quests: [
      { id: 'b', name: 'B', order: 9 }, { id: 'a', name: 'A', order: 1, sub_quests: [{ id: 's', name: 'S' }] },
    ] }, side_quests: { total: 0, quests: [] } });
    expect(sorted.sections[0].entries).toEqual([{ id: 'a', name: 'A', sub: [{ id: 's', name: 'S' }] }, { id: 'b', name: 'B' }]);
  });

  it('Threads of Time: a side quest’s reward goes in the tooltip, not beside the row', () => {
    const side = byTitle(wipCards[2].sections, 'Side Quests');
    const mask = side.entries.find(q => q.id === 'happy_mask_shopkeeper')!;
    expect(mask.tip).toBe('Reward: Mask of Truth (read Gossip Stones)');
    expect(mask.detail).toBeUndefined();
    expect(side.entries.find(q => q.id === 'malons_friend')!.tip).toBeUndefined();
  });

  it('matches the brief: the 11 Master medals, 6 statue areas, 5 sages', () => {
    expect(new Set(wipCards[0].stats!.map(s => s.id))).toEqual(new Set(['citizen_of_hyrule', 'monsters_bane', 'wealthy', 'distance_tracker', 'lover_of_luxury',
      'crusher', 'social_butterfly', 'angler', 'musician', 'explorer', 'amiibo_enthusiast']));
    expect(wipCards[0].stats!.map(s => s.id)).not.toContain('quiz_enthusiast');
    expect(wipCards[0].stats!.filter(s => ['monsters_bane', 'citizen_of_hyrule'].includes(s.id)).map(s => thresholdText(s.master, s.unit)))
      .toEqual(['60 hours', '1,000 enemies']);
    expect(byTitle(wipCards[1].sections, 'Monster Statues').folds).toHaveLength(6);
    expect(byTitle(wipCards[1].sections, 'Gauntlet Trials').entries.map(t => t.name))
      .toEqual(['Trial of the Spiritual Stones', 'Trial of the Five Sages', 'Trial of the Hero of Time']);
    const sages = byTitle(wipCards[2].sections, 'Main Quests').entries.find(q => q.name === 'Awakening the Five Sages')!;
    expect(sages.sub).toHaveLength(5);
  });

  it('with an empty checklist every entry and stat bar reads as not mapped (no false ticks)', () => {
    const st = wipStatus([]);
    for (const c of wipCards) {
      const { unmapped, of } = unmappedCount(c, st);
      expect(of, c.id).toBeGreaterThan(0);
      expect(unmapped, c.id).toBe(of);
      expect(cardDone(c, st), c.id).toBeNull();
    }
  });

  // ---- links to checklist rows (data/wip-links.json)

  const allEntries = (sections: WipSection[]): WipEntry[] =>
    sections.flatMap(s => [...s.entries.flatMap(e => [e, ...(e.sub ?? [])]), ...allEntries(s.folds ?? [])]);
  const checklistIds = (file: string) => new Set<string>(JSON.parse(fs.readFileSync(file, 'utf8')).categories.flatMap((c: { items: { id: string }[] }) => c.items.map(i => i.id)));
  const checklistCats = (file: string) => new Set<string>(JSON.parse(fs.readFileSync(file, 'utf8')).categories.map((c: { id: string }) => c.id));

  it('every link points at a real checklist row or category (public checklist, and the local one when present)', () => {
    for (const file of ['data/checklist.json', 'data/checklist.local.json'].filter(f => fs.existsSync(f))) {
      const ids = checklistIds(file), cats = checklistCats(file);
      expect(Object.values(links.entries).filter(id => !ids.has(id)), file).toEqual([]);
      expect(Object.values(links.stats).filter(id => !cats.has(id)), file).toEqual([]);
    }
  });

  it('every link key is an entry or medal of the reference files, and lands on that entry', () => {
    const ids = new Set(wipCards.flatMap(c => [...allEntries(c.sections).map(e => e.id), ...(c.stats ?? []).map(s => s.id)]));
    expect(Object.keys(links.entries).filter(k => !ids.has(k))).toEqual([]);
    expect(Object.keys(links.stats).filter(k => !ids.has(k))).toEqual([]);
    const linked = wipCards.flatMap(c => allEntries(c.sections)).filter(e => e.link);
    expect(linked).toHaveLength(Object.keys(links.entries).length);
  });

  const cat = (id: string, rows: [string, boolean][]) => ({ id, label: id, done: rows.filter(r => r[1]).length, items: rows.map(([rid, done]) => ({ id: rid, done })) });
  const card = withLinks({ id: 'c', title: 'C', symbol: 'quest', about: 'test', total: 3, sections: [
    { id: 's1', title: 'S1', total: 2, layout: 'chips', entries: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] },
    { id: 's2', title: 'S2', total: 1, layout: 'rows', entries: [{ id: 'q', name: 'Q', sub: [{ id: 'x', name: 'X' }] }] },
  ] }, { entries: { a: 'k.a', b: 'k.b', q: 'k.q' }, stats: {} });

  it('a fully linked, complete section counts collected rows; one unmapped entry makes the card unknown', () => {
    const st = wipStatus([cat('k', [['k.a', true], ['k.b', false], ['k.q', true]])]);
    expect(sectionDone(card.sections[0], st)).toBe(1);
    expect(sectionDone(card.sections[1], st)).toBe(1);
    expect(cardDone(card, st)).toBe(2);
    expect(unmappedCount(card, st)).toEqual({ unmapped: 1, of: 4 }); // the sub-quest x has no link
  });

  it('a link whose row is missing from the current checklist reads as unmapped, not as not collected', () => {
    const st = wipStatus([cat('k', [['k.a', true]])]);
    expect(sectionDone(card.sections[0], st)).toBeNull();
    expect(cardDone(card, st)).toBeNull();
    expect(unmappedCount(card, st).unmapped).toBe(3);
  });

  it('a section listing fewer entries than the game has stays unknown even when all listed are linked', () => {
    const short = { ...card.sections[0], total: 5 };
    expect(sectionDone(short, wipStatus([cat('k', [['k.a', true], ['k.b', true]])]))).toBeNull();
  });

  it('no shipped section repeats the checklist: none is fully known from it, and no medal bar is a checklist count', () => {
    const rows = [...checklistIds('data/checklist.json')];
    const st = wipStatus([...checklistCats('data/checklist.json')].map(id => cat(id, rows.filter(r => r.startsWith(`${id}.`)).map(r => [r, false] as [string, boolean]))));
    const sections = (list: WipSection[]): WipSection[] => list.flatMap(s => [s, ...sections(s.folds ?? [])]);
    const known = wipCards.flatMap(c => sections(c.sections)).filter(s => sectionDone(s, st) !== null).map(s => s.id);
    expect(known).toEqual([]);
    expect(wipCards[0].stats!.filter(s => s.link)).toEqual([]);
  });

  // ---- rendered card (WipSections.tsx)

  const render = (c: typeof wipCards[number], tokens: number) => renderToStaticMarkup(createElement(WipCardView, {
    card: c, fit: false,
    categories: [{ id: 'gold_skulltulas', label: 'Gold Skulltulas', done: tokens, items: [] }] as unknown as TrackedCategory[],
  }));

  it('marks a linked medal stat with ✓ once it reaches the Master threshold, not before', () => {
    const tokens = withLinks(playDataCard({ medals: [{ id: 't', name: 'T', tiers: { master: { threshold: 100, unit: 'tokens' } } }] }),
      { entries: {}, stats: { t: 'gold_skulltulas' } });
    expect(render(tokens, 100)).toContain('Master medal reached');
    expect(render(tokens, 99)).not.toContain('Master medal reached');
    expect(render(tokens, 99)).toContain('99 / 100 tokens');
  });

  it('the heading tooltip says what the card covers and how much is not mapped', () => {
    expect(render(wipCards[0], 0)).toContain('title="Zelda Notes medals: your play stats toward each Master medal\nWIP: not yet mapped"');
    expect(render(wipCards[1], 0)).toContain('WIP: not yet mapped"');
    const empty = { ...wipCards[1], sections: [] };
    expect(render(empty, 0)).toContain('WIP: nothing listed yet"');
    const partly = withLinks(playDataCard({ medals: [
      { id: 't', name: 'T', tiers: { master: { threshold: 100, unit: 'tokens' } } }, { id: 'u', name: 'U', tiers: { master: { threshold: 5, unit: 'x' } } },
    ] }), { entries: {}, stats: { t: 'gold_skulltulas' } });
    expect(render(partly, 0)).toContain('WIP: 1 of 2 not yet mapped"');
  });

  it('each card head draws its own symbol before the title, hidden from screen readers', () => {
    expect(wipCards.map(c => c.symbol)).toEqual(['medal', 'statue', 'questThread']);
    for (const c of wipCards) {
      expect(SYMBOLS[c.symbol]).toBeDefined();
      expect(render(c, 0)).toMatch(new RegExp(`<span class="card-title"[^>]*><svg class="sym" width="18" height="18" viewBox="0 0 24 24"[^>]*aria-hidden="true">.*?</svg>${c.title.replace('&', '&amp;')}<span class="wip-tag">`));
    }
  });

  it('a side quest row shows its reward on hover, before the row’s state', () => {
    expect(render(wipCards[2], 0)).toContain('title="Reward: Mask of Truth (read Gossip Stones)\nData not yet mapped"');
  });

  it('a quest that folds open keeps its tooltip on the fold button', () => {
    const c = threadsCard({ main_story_quests: { total: 1, quests: [
      { id: 'q', name: 'Q', order: 1, reward: 'R', sub_quests: [{ id: 's', name: 'S' }] },
    ] }, side_quests: { total: 0, quests: [] } });
    expect(render(c, 0)).toMatch(/<button class="wip-fold-head" aria-expanded="false" title="Reward: R\nData not yet mapped"/);
  });

  it('formats thresholds', () => {
    expect(thresholdText(3000, 'rupees')).toBe('3,000 rupees');
    expect(thresholdText(100, 'percent')).toBe('100%');
  });
});
