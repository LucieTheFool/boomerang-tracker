// The Updater's install() path: full mode must quit and run the installer
// silently (no setup wizard). 'electron' and 'electron-updater' are mocked so
// the real updater never touches the app. Assumes a Windows test host (the
// updater's full-mode branch).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { SettingsStore } from '../src/main/settings.js';
import { Updater } from '../src/main/updater.js';

vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: () => '0.0.1-test' },
  net: { fetch: vi.fn() },
}));

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

function fakeSettings(): SettingsStore {
  return {
    data: { updates: { check: false, autoDownload: false } },
    update: () => {},
  } as unknown as SettingsStore;
}

/** Construct an Updater and wait until its auto-updater is wired (full mode). */
async function makeUpdater(): Promise<Updater> {
  const updater = new Updater(fakeSettings(), () => {});
  await updater.ready;
  return updater;
}

// Full mode is the Windows installer path; the Linux CI runner would detect check-only (no APPIMAGE).
describe.skipIf(process.platform !== 'win32')('Updater.install', () => {
  let savedPortable: string | undefined;

  beforeEach(() => {
    savedPortable = process.env.PORTABLE_EXECUTABLE_DIR;
    delete process.env.PORTABLE_EXECUTABLE_DIR;
    (app as { isPackaged: boolean }).isPackaged = true;
    vi.mocked(autoUpdater.quitAndInstall).mockClear();
  });

  afterEach(() => {
    if (savedPortable === undefined) delete process.env.PORTABLE_EXECUTABLE_DIR;
    else process.env.PORTABLE_EXECUTABLE_DIR = savedPortable;
  });

  it('detects full mode for a packaged Windows build', async () => {
    expect((await makeUpdater()).mode).toBe('full');
  });

  it('quits and installs silently with force-run: quitAndInstall(true, true)', async () => {
    await (await makeUpdater()).install();
    expect(vi.mocked(autoUpdater.quitAndInstall)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(autoUpdater.quitAndInstall)).toHaveBeenCalledWith(true, true);
  });

  it('does not quit when the mode is not full', async () => {
    process.env.PORTABLE_EXECUTABLE_DIR = 'C:\\Temp\\portable';
    const updater = await makeUpdater();
    expect(updater.mode).toBe('check-only');
    await updater.install();
    expect(vi.mocked(autoUpdater.quitAndInstall)).not.toHaveBeenCalled();
  });
});
