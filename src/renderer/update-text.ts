// Wording and state read-back for the in-app updates UI. Pure (no DOM, no api) so it is testable.
import type { UpdateState } from '../shared/types';

/**
 * The Settings switches read their position from the state the main process
 * pushes (check / autoDownload ride on every push), never from local defaults —
 * so after a restart they show what the app actually does.
 */
export function updateSwitches(u: Pick<UpdateState, 'check' | 'autoDownload'>): { check: boolean; autoDownload: boolean } {
  return { check: u.check ?? false, autoDownload: u.autoDownload ?? false };
}

/** The one line under "Check now" in Settings, for each state. */
export function updateStatusLine(u: UpdateState): string {
  switch (u.status) {
    case 'checking':
      return 'Checking…';
    case 'up-to-date':
      return `Up to date${u.version ? ` (${u.version})` : ''}.`;
    case 'available':
      return u.mode === 'check-only'
        ? `Version ${u.version ?? ''} is out.`
        : `Version ${u.version ?? ''} is ready to download.`;
    case 'downloading':
      return `Downloading${u.progress != null ? ` ${u.progress}%` : ''}…`;
    case 'downloaded':
      return `Version ${u.version ?? ''} is downloaded.`;
    case 'error':
      return u.error ?? 'The update check failed.';
    case 'idle':
      return '';
  }
}
