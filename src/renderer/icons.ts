// Icon providers. Tiles use the original line symbols in symbols.tsx, drawn for this
// project (generic shapes, no game art), in a colour per category. The older
// "placeholder" provider (symbol character or initials) is kept as a fallback.
import { symbolFor } from './symbols';

export interface IconSpec {
  color: string;
  /** Short text fallback */
  glyph: string;
  /** Key into SYMBOLS (symbols.tsx) */
  symbol?: string;
}

export interface IconProvider {
  readonly name: 'placeholder' | 'symbols';
  get(iconId: string, categoryId: string, itemName: string): IconSpec;
}

const CATEGORY_STYLE: Record<string, { color: string; glyph?: string }> = {
  heart_pieces: { color: '#e5566f', glyph: '♥' },
  heart_containers: { color: '#ff3d5a', glyph: '♥' },
  gold_skulltulas: { color: '#e8b931', glyph: '✦' },
  songs: { color: '#5aa9ff', glyph: '♪' },
  equipment: { color: '#9a8cff' },
  items: { color: '#4fc39b' },
  key_items: { color: '#d68a3a' },
  masks: { color: '#e07ad8' },
  bottles: { color: '#7fd3e8', glyph: '◫' },
  great_fairies: { color: '#ff8fd2', glyph: '✿' },
  capacity: { color: '#b0c060' },
  stones_medallions: { color: '#55d0c0', glyph: '◆' },
  dungeons: { color: '#8f9bb3', glyph: '▣' },
  bosses: { color: '#ff7043', glyph: '☠' },
  mini_bosses: { color: '#d9824b', glyph: '⚔' },
  side_quests: { color: '#c3a6ff', glyph: '❖' },
  skulltula_rewards: { color: '#e8b931', glyph: '✦' },
  child_trade: { color: '#9fd36b', glyph: '⇄' },
  adult_trade: { color: '#6bbf59', glyph: '⇄' },
  dungeon_items: { color: '#8f9bb3' },
  amiibo_masks: { color: '#888', glyph: '◐' },
};

/** Two-letter label from a name: "Megaton Hammer" -> "MH", "Hookshot" -> "Ho". */
export function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').replace(/['’]/g, '').split(/[\s:/-]+/).filter(w => /^[A-Za-z]/.test(w) && !/^(of|the|a|and)$/i.test(w));
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2);
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const placeholderIcons: IconProvider = {
  name: 'placeholder',
  get(iconId, categoryId, itemName) {
    const s = CATEGORY_STYLE[categoryId] ?? { color: '#888' };
    let glyph = s.glyph ?? initials(itemName);
    if (categoryId === 'dungeon_items') glyph = iconId === 'dungeon_map' ? 'Mp' : iconId === 'compass' ? 'Cp' : 'BK';
    return { color: s.color, glyph };
  },
};

export const symbolIcons: IconProvider = {
  name: 'symbols',
  get(iconId, categoryId, itemName) {
    return { ...placeholderIcons.get(iconId, categoryId, itemName), symbol: symbolFor(categoryId, iconId, itemName) };
  },
};

export const categoryColor = (id: string) => CATEGORY_STYLE[id]?.color ?? '#888';
