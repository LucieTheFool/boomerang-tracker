// First-run guide: which steps to show, in what order, with what copy.
// Pure (no DOM) so the step selection is testable.
import type { UpdateMode } from '../shared/types';

export type GuideStepId = 'updates' | 'sidebar' | 'card' | 'canget' | 'overlay';

export interface GuideStep {
  id: GuideStepId;
  /** The data-guide value of the element to point at, or null for a step with no element (centered). */
  target: GuideStepId | null;
  title: string;
  body: string;
}

/** The opt-in step is only offered on a build that can install an update itself (full). */
export function updatesStepFor(mode: UpdateMode): boolean {
  return mode === 'full';
}

/**
 * The walkthrough, in order. A step is skipped when the element it points at
 * is absent, so a step never points at nothing. The updates opt-in step comes
 * first when the build can install (full mode).
 */
export function guideSteps(opts: { hasCards: boolean; showCanGetNow: boolean; updates?: boolean }): GuideStep[] {
  const steps: GuideStep[] = [];
  if (opts.updates) {
    steps.push({
      id: 'updates',
      target: null,
      title: 'Update the tracker automatically?',
      body: 'When a new version comes out the tracker can check for it and download it for you. You can always check by hand in Settings → Updates.',
    });
  }
  steps.push({
    id: 'sidebar',
    target: 'sidebar',
    title: 'The checklist, by area',
    body: 'The left bar lists every area with its progress. Click an area to show or hide it; up top is where the 100% total lives.',
  });
  if (opts.hasCards) {
    steps.push({
      id: 'card',
      target: 'card',
      title: 'One card per area',
      body: 'A card is an area of the game. Filled tiles are collected, dim ones are not — click any tile for what it is and where it is.',
    });
  }
  if (opts.showCanGetNow) {
    steps.push({
      id: 'canget',
      target: 'canget',
      title: 'What you can get now',
      body: 'The tracker reads your save and lists everything you can collect with what you already hold, your current area first.',
    });
  }
  steps.push({
    id: 'overlay',
    target: null,
    title: 'The overlay',
    body: 'A small HUD that floats over the game: counters for the area you are in, or the “can get now” list. The button at the top of this window shows and hides it.',
  });
  return steps;
}
