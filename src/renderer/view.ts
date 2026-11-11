// Display grouping: how checklist categories are merged into cards on screen.
// Purely visual. Every checklist row still exists and counts toward 100%.
import type { TrackedCategory, TrackedItem } from '../shared/types';

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

  // Hearts: containers first, then pieces.
  push('hearts', 'Hearts', 'heart_containers', 'A', [all('heart_containers', 'major'), all('heart_pieces', 'numbered', 'Pieces of Heart')],
    { hint: get('heart_pieces')?.hint }, ['heart_containers', 'heart_pieces']);

  push('gold_skulltulas', 'Gold Skulltulas', 'gold_skulltulas', 'A', [all('gold_skulltulas', 'numbered')],
    { hint: get('gold_skulltulas')?.hint }, ['gold_skulltulas']);

  push('songs', 'Songs', 'songs', 'A', [all('songs')], {}, ['songs']);

  // Equipment + key item + masks + stones/medallions.
  push('equipment', 'Equipment', 'equipment', 'A', [
    all('equipment'),
    all('masks', undefined, 'Masks'),
    all('stones_medallions', undefined, 'Stones & Medallions'),
    all('key_items', undefined, 'Key item'),
  ], {}, ['equipment', 'masks', 'stones_medallions', 'key_items']);

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
  push('bosses', 'Bosses', 'bosses', 'A', [all('bosses'), all('mini_bosses', undefined, 'Mini-bosses')], {}, ['bosses', 'mini_bosses']);

  // Everything not merged above keeps its own card, in checklist order.
  for (const c of cats) {
    if (used.has(c.id)) continue;
    if (c.kind === 'counter') {
      cards.push({ id: c.id, label: c.label, colorCat: c.id, part: c.part, kind: 'counter', sections: [], done: c.done, total: c.total, value: c.value, max: c.max, counterConfidence: c.counterConfidence });
    } else {
      push(c.id, c.label, c.id, c.part, [all(c.id, c.id === 'heart_pieces' ? 'numbered' : undefined)], { hint: c.hint });
    }
  }
  // Keep Part A cards in the order above, then B and C.
  const order = { A: 0, B: 1, C: 2 };
  return cards.sort((a, b) => order[a.part] - order[b.part]);
}

/** Every item in a card (for hide-collected and selection lookups). */
export const tileItems = (t: TileModel) => (t.kind === 'single' ? [t.item] : t.members.map(m => m.item));
