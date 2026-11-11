// Matches the save's area name (caption.sav, e.g. "Market/Market_Child") to the
// checklist's region names, for the overlay's "remaining in this area" list.

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');

/** Save area base name (without _Adult/_Child) -> checklist regions it covers. */
const ALIASES: Record<string, string[]> = {
  market: ['Hyrule Castle Town'],
  timetemple: ['Hyrule Castle Town'], // Temple of Time sits in the town; no checklist region of its own
  hyrulecastle: ['Hyrule Castle', 'Hyrule Castle (outside Ganon\'s Castle)'],
  hrlcastle: ['Hyrule Castle'],
  hyrulefield: ['Hyrule Field', 'Hyrule Field (near Gerudo Valley)'],
  hrlfield: ['Hyrule Field', 'Hyrule Field (near Gerudo Valley)'],
  lostwood: ['Lost Woods'],
  graveyard: ['Graveyard'],
  deathmountain: ['Death Mountain Trail'],
  mountaintrail: ['Death Mountain Trail'],
  deathmountaincrater: ['Death Mountain Crater'],
  deathmtcrater: ['Death Mountain Crater'],
  lakehrl: ['Lake Hylia', 'Lake Hylia (Lakeside Laboratory)'],
  lakehylia: ['Lake Hylia', 'Lake Hylia (Lakeside Laboratory)'],
  zorariver: ['Zora\'s River'],
  zoradomain: ['Zora\'s Domain'],
  zorafountain: ['Zora\'s Fountain'],
  hountedwasteland: ['Haunted Wasteland (Mirage Desert)'],
  hauntedwasteland: ['Haunted Wasteland (Mirage Desert)'],
  insidethedekutree: ['Great Deku Tree'],
  insidejabujabubelly: ['Lord Jabu-Jabu\'s Belly'],
  insideganoncastle: ['Ganon\'s Castle'],
  ganoncastle: ['Ganon\'s Castle'],
  dodongocavern: ['Dodongo\'s Cavern'],
};

/** Area string from the save -> list of checklist regions (may be empty). */
export function regionsForArea(area: string | undefined, allRegions: string[]): string[] {
  if (!area) return [];
  const base = area.split('/').pop()!.replace(/_(Adult|Child)$/i, '');
  const key = norm(base);
  if (ALIASES[key]) return ALIASES[key];
  // Otherwise: a checklist region whose normalized name equals or starts with the area's.
  return allRegions.filter(r => { const n = norm(r.replace(/\(.*\)/, '')); return n === key || n.startsWith(key) || key.startsWith(n); });
}
