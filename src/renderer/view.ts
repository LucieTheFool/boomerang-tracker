// Display grouping: how checklist categories are merged into cards on screen.
// Purely visual. Every checklist row still exists and counts toward 100%.
import type { TrackedCategory, TrackedItem } from '../shared/types';
import { categorySymbol } from './symbols';

/** One tile: a single checklist row, or a stack of rows shown as one tile with a level. */
export type TileModel =
  | { kind: 'single'; key: string; categoryId: string; item: TrackedItem }
  | { kind: 'stack'; key: string; categoryId: string; label: string; iconName: string; members: { categoryLabel: string; item: TrackedItem }[] };

export interface Section { title?: string; style?: 'major' | 'numbered'; tiles: TileModel[] }

export interface Card {
  id: string;
  label: string;
  colorCat: string; // category id used for colour
  part: 'A' | 'B' | 'C';
  kind: 'list' | 'counter';
  sections: Section[];
  done: number;
  total: number;
  hint?: string;
  value?: number | null;
  max?: number;
  counterConfidence?: string;
  wide?: boolean;
  symbol?: string; // category symbol in the head (counter cards, which have no item tiles of their own)
}

const single = (c: TrackedCategory, item: TrackedItem): TileModel => ({ kind: 'single', key: item.id, categoryId: c.id, item });

export function buildCards(cats: TrackedCategory[]): Card[] {
  const byId = new Map(cats.map(c => [c.id, c]));
  const get = (id: string) => byId.get(id);
  const used = new Set<string>();
  const cards: Card[] = [];
  const row = (cat: string, n: number) => get(cat)?.items.find(i => i.number === n);
  const member = (cat: string, n: number) => { const it = row(cat, n); return it ? [{ categoryLabel: get(cat)!.label, item: it }] : []; };
  const stack = (key: string, label: string, iconName: string, colorCat: string, members: { categoryLabel: string; item: TrackedItem }[]): TileModel | null =>
    members.length ? { kind: 'stack', key, categoryId: colorCat, label, iconName, members } : null;
  const count = (sections: Section[]) => {
    let done = 0, total = 0;
    for (const s of sections) for (const t of s.tiles) {
      const items = t.kind === 'single' ? [t.item] : t.members.map(m => m.item);
      total += items.length;
      done += items.filter(i => i.done).length;
    }
    return { done, total };
  };
  const push = (id: string, label: string, colorCat: string, part: Card['part'], sections: Section[], extra: Partial<Card> = {}, sources: string[] = []) => {
    sources.forEach(s => used.add(s));
    const live = sections.filter(s => s.tiles.length);
    if (!live.length) return;
    cards.push({ id, label, colorCat, part, kind: 'list', sections: live, ...count(live), ...extra });
  };
  const all = (id: string, style?: Section['style'], title?: string): Section => {
    const c = get(id);
    return { title, style, tiles: c ? c.items.map(i => single(c, i)) : [] };
  };

  // Hearts: containers and pieces as separate cards — they pack better and read cleaner.
  push('hearts', 'Hearts', 'heart_containers', 'A', [all('heart_containers', 'major')],
    { hint: get('heart_containers')?.hint }, ['heart_containers']);
  push('heart_pieces', 'Pieces of Heart', 'heart_pieces', 'A', [all('heart_pieces', 'numbered')],
    { hint: get('heart_pieces')?.hint }, ['heart_pieces']);

  push('gold_skulltulas', 'Gold Skulltulas', 'gold_skulltulas', 'A', [all('gold_skulltulas', 'numbered')],
    { hint: get('gold_skulltulas')?.hint }, ['gold_skulltulas']);

  push('songs', 'Songs', 'songs', 'A', [all('songs')], {}, ['songs']);

  // Equipment (with its key item) plus separate cards for masks and stones & medallions.
  push('equipment', 'Equipment', 'equipment', 'A', [all('equipment'), all('key_items', undefined, 'Key item')],
    {}, ['equipment', 'key_items']);
  push('masks', 'Masks', 'masks', 'A', [all('masks')], {}, ['masks']);
  push('stones_medallions', 'Stones & Medallions', 'stones_medallions', 'A', [all('stones_medallions')], {}, ['stones_medallions']);

  // Items, with capacity upgrades folded into their item, plus Wallet and Bottles stacks.
  const items = get('items');
  if (items) {
    const UPGRADES: Record<number, { label: string; caps: number[] }> = {
      1: { label: 'Fairy Slingshot', caps: [7, 8] },
      2: { label: 'Fairy Bow', caps: [9, 10] },
      13: { label: 'Bomb Bag', caps: [4, 5, 6] },
      15: { label: 'Deku Sticks', caps: [11, 12] },
      16: { label: 'Deku Nuts', caps: [13, 14] },
    };
    const tiles: TileModel[] = [];
    for (const it of items.items) {
      const up = UPGRADES[it.number];
      if (!up) { tiles.push(single(items, it)); continue; }
      const t = stack(`stack:${it.id}`, up.label, it.name, 'items', [{ categoryLabel: 'Items', item: it }, ...up.caps.flatMap(n => member('capacity', n))]);
      if (t) tiles.push(t);
    }
    const wallet = stack('stack:wallet', 'Wallet', 'Wallet', 'capacity', [1, 2, 3].flatMap(n => member('capacity', n)));
    const bottles = stack('stack:bottles', 'Bottles', 'Bottle', 'bottles', [1, 2, 3, 4, 5].flatMap(n => member('bottles', n)));
    if (wallet) tiles.push(wallet);
    if (bottles) tiles.push(bottles);
    push('items', 'Items', 'items', 'A', [{ tiles }], {}, ['items', 'capacity', 'bottles']);
  }

  push('great_fairies', 'Great Fairies', 'great_fairies', 'A', [all('great_fairies')], {}, ['great_fairies']);
  push('dungeons', 'Dungeons Cleared', 'dungeons', 'A', [all('dungeons')], {}, ['dungeons']);
  push('bosses', 'Bosses', 'bosses', 'A', [all('bosses')], {}, ['bosses']);
  push('mini_bosses', 'Mini-bosses', 'mini_bosses', 'A', [all('mini_bosses')], {}, ['mini_bosses']);

  // Everything not merged above keeps its own card, in checklist order.
  for (const c of cats) {
    if (used.has(c.id)) continue;
    if (c.kind === 'counter') {
      // Counter cards: the save count in the head, plus one tile per known location (spots).
      const sections: Section[] = c.spots?.length ? [{ title: 'Locations', tiles: c.spots.map(i => single(c, i)) }] : [];
      cards.push({ id: c.id, label: c.label, colorCat: c.id, part: c.part, kind: 'counter', symbol: categorySymbol(c.id), sections, done: c.done, total: c.total, value: c.value, max: c.max, counterConfidence: c.counterConfidence });
    } else {
      push(c.id, c.label, c.id, c.part, [all(c.id)], { hint: c.hint });
    }
  }
  // Keep Part A cards in the order above, then B and C.
  const order = { A: 0, B: 1, C: 2 };
  return cards.sort((a, b) => order[a.part] - order[b.part]);
}

/** Every item in a card (for hide-collected and selection lookups). */
export const tileItems = (t: TileModel) => (t.kind === 'single' ? [t.item] : t.members.map(m => m.item));

/* Fit layout: the width a card gets on screen, in px. The tile geometry below
   must stay in sync with the .tile widths in styles.css (normal 62, major 74,
   numbered/small 38, gap 6). */
const TILE_GAP = 6;
const TILE_W = { normal: 62, major: 74, small: 38 } as const;
const CARD_PAD_X = 14; // .card horizontal padding, per side
const FIT_MIN_W = 160; // always wide enough for the header + counter
export const FIT_MAX_COLS = 10;

/**
 * Fit layout: a card is as wide as its widest section needs at about
 * sqrt(tiles) columns (capped at 10), so tiles fill the card instead of
 * floating with dead space.
 */
export function fitCardWidth(card: Pick<Card, 'sections'>): number {
  const maxN = card.sections.reduce((m, s) => Math.max(m, s.tiles.length), 0);
  const cols = Math.min(FIT_MAX_COLS, Math.max(1, Math.ceil(Math.sqrt(maxN))));
  let w = 0;
  for (const s of card.sections) {
    if (!s.tiles.length) continue;
    const unit = s.style === 'major' ? TILE_W.major : s.style === 'numbered' ? TILE_W.small : TILE_W.normal;
    const perRow = Math.min(s.tiles.length, cols);
    w = Math.max(w, perRow * unit + (perRow - 1) * TILE_GAP);
  }
  return Math.max(FIT_MIN_W, w + CARD_PAD_X * 2);
}
