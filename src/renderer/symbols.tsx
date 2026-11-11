// Original line icons for the tracker (24×24, stroke-based, drawn for this project).
// Generic shapes only: a sword, a bottle, a note, etc. Picked by keywords in the
// checklist entry's name, with a per-category fallback.

import type { ReactNode } from 'react';

const P = (d: string) => <path d={d} />;

export const SYMBOLS: Record<string, ReactNode> = {
  heart: P('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'),
  heartPiece: <>{P('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6V20z')}{P('M12 7.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10')}</>,
  token: <>{<circle cx="12" cy="12" r="8" />}{P('M12 7.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z')}</>,
  note: <>{P('M9 18V6l10-2v12')}{<circle cx="6.5" cy="18" r="2.5" />}{<circle cx="16.5" cy="16" r="2.5" />}</>,
  sword: <>{P('M14 4l6 0 0 6-9 9')}{P('M7 13l4 4')}{P('M5 15l4 4')}{P('M4 20l2-2')}</>,
  bigSword: <>{P('M13 3h8v8L10 22')}{P('M6 14l4 4')}{P('M3 19l2 2')}</>,
  shield: P('M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z'),
  shieldRound: <>{<circle cx="12" cy="12" r="8" />}{<circle cx="12" cy="12" r="3" />}</>,
  tunic: P('M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3c-1 1.5-2.2 2-4 2s-3-.5-4-2z'),
  boot: P('M8 3h5v10l6 3v4H6l2-3z'),
  glove: <>{P('M7 21v-8l-2-3 2-1 2 2V5h2v6V4h2v7V5h2v7l2-2 1 2-3 7v2')}</>,
  bow: <>{P('M6 3c8 3 8 15 0 18')}{P('M6 3v18')}{P('M3 12h17')}{P('M17 9l3 3-3 3')}</>,
  arrow: <>{P('M4 20L19 5')}{P('M13 5h6v6')}{P('M4 20l1-4M4 20l4-1')}</>,
  slingshot: <>{P('M12 21v-8')}{P('M12 13L7 5M12 13l5-8')}{P('M7 5c2 3 8 3 10 0')}</>,
  boomerang: P('M4 6c5 0 9 2 12 6l4 6-4 1-3-5c-2-2-5-3-9-3z'),
  hook: <>{P('M4 20l9-9')}{P('M13 11l3-3 4 0-1 4-3 3')}{P('M6 14l4 4')}</>,
  hammer: <>{P('M10 21l4-10')}{P('M7 5l9 4-2 4-9-4z')}</>,
  bomb: <>{<circle cx="10" cy="14" r="6" />}{P('M14 9l2-2')}{P('M16 7c1-2 3-2 4-1')}</>,
  chu: <>{<circle cx="12" cy="14" r="5" />}{P('M7 14H4M20 14h-3')}{P('M12 9V6l2-2')}</>,
  stick: <>{P('M5 19L19 5')}{P('M16 5l3 3')}</>,
  nut: <>{P('M12 4c4 0 7 3 7 8s-3 8-7 8-7-3-7-8 3-8 7-8z')}{P('M5 11h14')}</>,
  seeds: <>{<circle cx="8" cy="9" r="2.5" />}{<circle cx="15" cy="8" r="2.5" />}{<circle cx="11" cy="15" r="2.5" />}</>,
  fire: P('M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-3 2 2 2 5 2 7 0 3-2 6-6 6z'),
  wind: <>{P('M3 9h11a3 3 0 1 0-3-3')}{P('M3 15h15a3 3 0 1 1-3 3')}{P('M3 12h8')}</>,
  crystal: P('M12 3l6 7-6 11-6-11z'),
  magic: <>{P('M9 4h6')}{P('M10 4v3l-4 6v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5l-4-6V4')}{P('M7 14h10')}</>,
  lens: <>{<circle cx="10" cy="10" r="6" />}{P('M14.5 14.5L20 20')}</>,
  scale: P('M12 3c4 4 6 8 6 11a6 6 0 0 1-12 0c0-3 2-7 6-11z'),
  bean: P('M8 16c-3-3-2-9 3-10s7 3 5 6-5 2-6 5-1 1-2-1z'),
  ocarina: <>{P('M4 13c0-4 5-6 9-6s7 2 7 5-3 5-8 5-8-1-8-4z')}{<circle cx="10" cy="12" r=".8" />}{<circle cx="13" cy="11" r=".8" />}{<circle cx="16" cy="12" r=".8" />}</>,
  gem: <>{P('M7 4h10l4 5-9 12L3 9z')}{P('M3 9h18M9 4l3 17 3-17')}</>,
  medallion: <>{<circle cx="12" cy="13" r="7" />}{<circle cx="12" cy="13" r="3" />}{P('M12 3v3')}</>,
  card: <>{<rect x="3" y="6" width="18" height="12" rx="2" />}{P('M7 10h6M7 14h4')}</>,
  mask: <>{P('M4 8c3-3 13-3 16 0v4c0 5-4 8-8 8s-8-3-8-8z')}{P('M8 11h2M14 11h2')}{P('M10 16c1 .8 3 .8 4 0')}</>,
  bottle: <>{P('M10 3h4v4l3 4v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8l3-4z')}{P('M7 14h10')}</>,
  fairy: <>{P('M12 3v18M3 12h18')}{P('M6 6l12 12M18 6L6 18')}</>,
  wallet: <>{P('M4 8h16v11H4z')}{P('M7 8V6a5 3 0 0 1 10 0v2')}{<circle cx="16" cy="13.5" r="1.2" />}</>,
  bag: <>{P('M6 9h12l-1 11H7z')}{P('M9 9a3 3 0 0 1 6 0')}</>,
  quiver: <>{P('M8 9h8v12H8z')}{P('M10 9V3M12 9V4M14 9V3')}</>,
  door: <>{P('M6 21V8a6 6 0 0 1 12 0v13')}{P('M4 21h16')}{<circle cx="12" cy="13" r="1.5" />}{P('M12 14.5V17')}</>,
  skull: <>{P('M5 11a7 7 0 0 1 14 0v3l-2 1v3H7v-3l-2-1z')}{<circle cx="9" cy="11" r="1.5" />}{<circle cx="15" cy="11" r="1.5" />}</>,
  crossedSwords: <>{P('M4 4l12 12M20 4L8 16')}{P('M14 18l4-4M6 14l4 4')}</>,
  quest: <>{P('M6 3h9l3 3v15H6z')}{P('M9 9h6M9 13h6M9 17h3')}</>,
  map: <>{P('M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z')}{P('M9 4v14M15 6v14')}</>,
  compass: <>{<circle cx="12" cy="12" r="8" />}{P('M10 14l1.5-5L14 10l-1.5 5z')}</>,
  key: <>{<circle cx="8" cy="8" r="4" />}{P('M11 11l9 9M16 16l2-2M18 18l2-2')}</>,
  letter: <>{<rect x="3" y="6" width="18" height="12" rx="1" />}{P('M3 7l9 6 9-6')}</>,
  egg: P('M12 3c3.5 0 6 5.5 6 10a6 6 0 0 1-12 0c0-4.5 2.5-10 6-10z'),
  bird: <>{P('M5 14c0-4 3-7 7-7h2l3-2v4c1 1 2 3 2 5a6 6 0 0 1-6 6H9a4 4 0 0 1-4-4z')}{<circle cx="15" cy="10" r=".8" />}{P('M19 9l2 1-2 1')}</>,
  mushroom: <>{P('M4 12c0-5 4-8 8-8s8 3 8 8z')}{P('M10 12v7h4v-7')}</>,
  potion: <>{P('M10 3h4M11 3v5L6 18a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-5-10V3')}{P('M8 15h8')}</>,
  saw: <>{P('M3 15l15-8 3 3-15 8z')}{P('M6 16l1 2M9 14l1 2M12 13l1 2M15 11l1 2')}</>,
  brokenSword: <>{P('M4 20l7-7')}{P('M7 13l4 4')}{P('M13 11l2-2M17 7l3-3')}</>,
  paper: <>{P('M6 3h12v18H6z')}{P('M9 7h6M9 11h6M9 15h4')}</>,
  frog: <>{P('M4 15c0-4 3-6 8-6s8 2 8 6-3 5-8 5-8-1-8-5z')}{<circle cx="8.5" cy="8" r="2" />}{<circle cx="15.5" cy="8" r="2" />}</>,
  eye: <>{P('M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z')}{<circle cx="12" cy="12" r="2.5" />}</>,
  ticket: <>{P('M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z')}{P('M14 7v10')}</>,
  poe: <>{P('M6 20V10a6 6 0 0 1 12 0v10l-2-2-2 2-2-2-2 2-2-2z')}{<circle cx="10" cy="11" r="1" />}{<circle cx="14" cy="11" r="1" />}</>,
  sprout: <>{P('M12 21v-9')}{P('M12 12c0-4-3-6-7-6 0 4 3 6 7 6z')}{P('M12 14c0-3 2-5 6-5 0 3-2 5-6 5z')}</>,
};

/** Keyword -> symbol, checked in order against the entry's name. */
const RULES: [RegExp, string][] = [
  [/heart container/i, 'heart'], [/piece of heart|heart piece/i, 'heartPiece'],
  [/biggoron|giant'?s knife/i, 'bigSword'], [/broken.*sword/i, 'brokenSword'], [/sword/i, 'sword'],
  [/mirror shield/i, 'shieldRound'], [/shield/i, 'shield'],
  [/tunic|clothes/i, 'tunic'], [/boots?/i, 'boot'], [/gauntlet|bracelet/i, 'glove'],
  [/arrow/i, 'arrow'], [/quiver/i, 'quiver'], [/bow\b/i, 'bow'], [/slingshot/i, 'slingshot'],
  [/seed bag/i, 'seeds'], [/boomerang/i, 'boomerang'], [/hookshot|longshot/i, 'hook'], [/hammer/i, 'hammer'],
  [/bomb bag/i, 'bag'], [/bombchu/i, 'chu'], [/bomb/i, 'bomb'], [/stick/i, 'stick'], [/nut/i, 'nut'],
  [/din'?s fire/i, 'fire'], [/farore/i, 'wind'], [/nayru/i, 'crystal'],
  [/double defense/i, 'shieldRound'], [/magic bean/i, 'bean'], [/magic/i, 'magic'], [/lens/i, 'lens'], [/scale/i, 'scale'],
  [/magic bean|bean/i, 'bean'], [/ocarina/i, 'ocarina'], [/echo gem|emerald|ruby|sapphire/i, 'gem'],
  [/medallion/i, 'medallion'], [/membership|card/i, 'card'], [/mask|hood/i, 'mask'],
  [/wallet/i, 'wallet'], [/bomb bag/i, 'bag'], [/letter/i, 'letter'],
  [/egg/i, 'egg'], [/cucco|cojiro/i, 'bird'], [/mushroom/i, 'mushroom'], [/potion|eye drops/i, 'potion'],
  [/saw/i, 'saw'], [/prescription/i, 'paper'], [/frog/i, 'frog'], [/claim check/i, 'ticket'],
  [/spin attack/i, 'crossedSwords'], [/poe/i, 'poe'],
];

const CATEGORY_FALLBACK: Record<string, string> = {
  heart_pieces: 'heartPiece', heart_containers: 'heart', gold_skulltulas: 'token', songs: 'note',
  bottles: 'bottle', great_fairies: 'fairy', capacity: 'bag', stones_medallions: 'medallion',
  dungeons: 'door', bosses: 'skull', mini_bosses: 'crossedSwords', side_quests: 'quest',
  skulltula_rewards: 'token', child_trade: 'quest', adult_trade: 'quest', amiibo_masks: 'mask',
  key_items: 'card', masks: 'mask', equipment: 'shield', items: 'bag', magic_beans_planted: 'sprout', big_poes: 'poe',
};

export function symbolFor(categoryId: string, iconId: string, name: string): string {
  if (categoryId === 'dungeon_items') return iconId === 'dungeon_map' ? 'map' : iconId === 'compass' ? 'compass' : 'key';
  // Categories whose rows all share one symbol (the name would mislead the keyword match).
  if (['heart_pieces', 'heart_containers', 'gold_skulltulas', 'songs', 'dungeons', 'bosses', 'mini_bosses', 'side_quests', 'skulltula_rewards'].includes(categoryId)) {
    return CATEGORY_FALLBACK[categoryId];
  }
  if (categoryId === 'bottles') return 'bottle';
  if (categoryId === 'great_fairies') return name.match(/spin attack/i) ? 'crossedSwords' : 'fairy';
  for (const [re, key] of RULES) if (re.test(name)) return key;
  return CATEGORY_FALLBACK[categoryId] ?? 'quest';
}

export function Symbol({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg className="sym" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {SYMBOLS[name] ?? SYMBOLS.quest}
    </svg>
  );
}
