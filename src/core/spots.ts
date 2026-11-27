import type { TrackedCategory, TrackedItem } from '../shared/types.js';

/**
 * Counter spots (e.g. Magic Bean planting spots) that are reminders right now: not done yet
 * and reachable now. Only counter categories that count toward 100%, regardless of part.
 * Unreachable spots are left out on purpose: "needs a bean" before you own one is noise.
 */
export function reachableSpots(categories: TrackedCategory[]): { c: TrackedCategory; i: TrackedItem }[] {
  return categories
    .filter(c => c.kind === 'counter' && c.countsToward100 && c.spots?.length)
    .flatMap(c => c.spots!.filter(i => !i.done && !!i.logic?.ages.length).map(i => ({ c, i })));
}

/** The reachable spots whose area is one of `regions` (the overlay's "Remaining here"). */
export function reachableSpotsHere(categories: TrackedCategory[], regions: Set<string>): { c: TrackedCategory; i: TrackedItem }[] {
  return reachableSpots(categories).filter(({ i }) => !!i.chapter && regions.has(i.chapter));
}
