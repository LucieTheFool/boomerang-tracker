import { describe, expect, it } from 'vitest';
import { updateStatusLine, updateSwitches } from '../src/renderer/update-text';
import type { UpdateState } from '../src/shared/types';

const base: UpdateState = { mode: 'full', status: 'idle' };

describe('updateStatusLine', () => {
  it('is empty when idle', () => {
    expect(updateStatusLine(base)).toBe('');
  });

  it('shows checking', () => {
    expect(updateStatusLine({ ...base, status: 'checking' })).toBe('Checking…');
  });

  it('shows up to date with the version', () => {
    expect(updateStatusLine({ ...base, status: 'up-to-date', version: '0.5.2' })).toBe('Up to date (0.5.2).');
  });

  it('distinguishes available by mode (download vs out)', () => {
    expect(updateStatusLine({ ...base, status: 'available', version: '0.6.0' })).toBe('Version 0.6.0 is ready to download.');
    expect(updateStatusLine({ ...base, status: 'available', version: '0.6.0', mode: 'check-only' })).toBe('Version 0.6.0 is out.');
  });

  it('shows downloading with the progress', () => {
    expect(updateStatusLine({ ...base, status: 'downloading', progress: 42 })).toBe('Downloading 42%…');
    expect(updateStatusLine({ ...base, status: 'downloading' })).toBe('Downloading…');
  });

  it('shows downloaded with the version', () => {
    expect(updateStatusLine({ ...base, status: 'downloaded', version: '0.6.0' })).toBe('Version 0.6.0 is downloaded.');
  });

  it('shows the error message when the check fails', () => {
    expect(updateStatusLine({ ...base, status: 'error', error: 'GitHub said no' })).toBe('GitHub said no');
    expect(updateStatusLine({ ...base, status: 'error' })).toBe('The update check failed.');
  });
});

describe('updateSwitches (Settings switches read back from the state)', () => {
  it('defaults to off when the state carries no switch settings', () => {
    expect(updateSwitches(base)).toEqual({ check: false, autoDownload: false });
    expect(updateSwitches({})).toEqual({ check: false, autoDownload: false });
  });

  it('derives the switches from a state with check:true (after a restart)', () => {
    expect(updateSwitches({ ...base, check: true })).toEqual({ check: true, autoDownload: false });
    expect(updateSwitches({ ...base, check: true, autoDownload: true })).toEqual({ check: true, autoDownload: true });
  });

  it('honours an explicit false from the state', () => {
    expect(updateSwitches({ ...base, check: false, autoDownload: false })).toEqual({ check: false, autoDownload: false });
  });
});
