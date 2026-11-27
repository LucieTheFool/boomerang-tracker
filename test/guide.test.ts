import { describe, expect, it } from 'vitest';
import { guideSteps, updatesStepFor, type GuideStep } from '../src/renderer/guide';

const ids = (s: GuideStep[]) => s.map(x => x.id);

describe('guideSteps', () => {
  it('shows all four steps in order by default', () => {
    expect(ids(guideSteps({ hasCards: true, showCanGetNow: true }))).toEqual(['sidebar', 'card', 'canget', 'overlay']);
  });

  it('skips the card step when no cards are visible', () => {
    expect(ids(guideSteps({ hasCards: false, showCanGetNow: true }))).toEqual(['sidebar', 'canget', 'overlay']);
  });

  it('skips the canget step when the panel is hidden', () => {
    expect(ids(guideSteps({ hasCards: true, showCanGetNow: false }))).toEqual(['sidebar', 'card', 'overlay']);
  });

  it('always starts on the sidebar and ends on the overlay', () => {
    const s = guideSteps({ hasCards: false, showCanGetNow: false });
    expect(s[0].id).toBe('sidebar');
    expect(s[s.length - 1].id).toBe('overlay');
  });

  it('only the overlay step has no element to point at', () => {
    const s = guideSteps({ hasCards: true, showCanGetNow: true });
    for (const step of s) expect(step.target === null).toBe(step.id === 'overlay');
  });
});

describe('guideSteps updates step', () => {
  const base = { hasCards: true, showCanGetNow: true };

  it('comes first and is centered (no element to point at)', () => {
    const s = guideSteps({ ...base, updates: true });
    expect(ids(s)).toEqual(['updates', 'sidebar', 'card', 'canget', 'overlay']);
    expect(s[0].target).toBeNull();
  });

  it('is skipped when not offered (check-only and off builds pass updates: false)', () => {
    expect(ids(guideSteps(base))).not.toContain('updates');
    expect(ids(guideSteps({ ...base, updates: false }))).not.toContain('updates');
  });

  it('keeps the rest of the walkthrough in order when shown', () => {
    expect(ids(guideSteps({ ...base, updates: true })).slice(1)).toEqual(ids(guideSteps(base)));
  });
});

describe('updatesStepFor', () => {
  it('offers the opt-in step only on a build that can install (full)', () => {
    expect(updatesStepFor('full')).toBe(true);
    expect(updatesStepFor('check-only')).toBe(false);
    expect(updatesStepFor('off')).toBe(false);
  });
});
