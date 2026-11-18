import type { TrackerApi } from '../preload/preload';

declare global {
  interface Window { tracker: TrackerApi }
}
export const api = window.tracker;
