// Search and filters for the "Can get now" list. Purely visual, and never reorders the list.
import type { AvailableEntry, AvailableFilters } from '../shared/types';

export { NO_FILTERS } from '../shared/types';

/** Lower case without accents or punctuation: "Kokiri's" -> "kokiris", "Déjà-vu" -> "dejavu". */
export function normalize(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

/** An entry as its chip shows it: "Lake Hylia: Tunnel" -> "Tunnel", Skulltulas with their number. */
export function entryLabel(a: AvailableEntry): string {
  return `${a.categoryId === 'gold_skulltulas' ? `GS ${a.number}: ` : ''}${a.name.replace(/^[^:]+: /, '')}`;
}

/** A search of only spaces or punctuation counts as no search. */
export function hasActiveFilters(f: Partial<AvailableFilters>): boolean {
  return normalize(f.search ?? '') !== '' || f.area != null || f.category != null || f.age != null || !!f.nightOnly || !!f.hereOnly;
}

/**
 * The rows passing every filter, in their original order. Each search word must appear in the
 * label or the area; spaces are ignored inside a field, so "south west" finds "Southwest".
 */
export function filterCanGetNow(rows: AvailableEntry[], filters: Partial<AvailableFilters>): AvailableEntry[] {
  if (!hasActiveFilters(filters)) return rows;
  const { area, category, age, nightOnly, hereOnly } = filters;
  const words = normalize(filters.search ?? '').split(' ').filter(Boolean);
  return rows.filter(r => {
    if (area != null && r.region !== area) return false;
    if (category != null && r.categoryLabel !== category) return false;
    if (age != null && !r.ages.includes(age)) return false;
    if (nightOnly && r.night !== true) return false;
    if (hereOnly && r.here !== true) return false;
    if (!words.length) return true;
    const fields = [entryLabel(r), r.name, r.region].map(f => normalize(f).replace(/ /g, ''));
    return words.every(w => fields.some(f => f.includes(w)));
  });
}

/** Sorted dropdown values. Keeps a saved choice that is no longer in the list, so it stays visible. */
export function filterChoices(values: string[], current: string | null): string[] {
  const set = new Set(values);
  if (current != null) set.add(current);
  return [...set].sort((a, b) => a.localeCompare(b));
}
