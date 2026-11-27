// The thin Electron-facing layer of in-app updates: it wires the pure
// update-logic (mode, version compare, release parse) to either electron-updater
// (full mode) or the GitHub releases API (check-only mode). It owns the periodic
// timer and pushes `updates:state` events to the UI. The read-only rule holds here
// too: this only ever reads app version and settings, and talks to the update
// server — it never touches saves or the game process.
import { app, net } from 'electron';
import type { AppUpdater } from 'electron-updater';
import type { UpdateState, UpdateMode } from '../shared/types.js';
import { detectMode, autoCheckArms, compareVersions, parseLatestRelease } from './update-logic.js';
import type { SettingsStore } from './settings.js';

/** The public GitHub API for the newest release of the public repo (check-only). */
const LATEST_URL = 'https://api.github.com/repos/LucieTheFool/boomerang-tracker/releases/latest';
/** The public release page — the one source for it (set on every "available" state). */
const RELEASES_URL = 'https://github.com/LucieTheFool/boomerang-tracker/releases/latest';
const USER_AGENT = 'boomerang-tracker (in-app update check)';
/** First automatic check, 10 s after startup. */
const CHECK_START_DELAY_MS = 10_000;
/** Then every 6 h. */
const CHECK_INTERVAL_MS = 6 * 60 * 60_000;

export class Updater {
  private state: UpdateState;
  private initial: NodeJS.Timeout | null = null;
  private periodic: NodeJS.Timeout | null = null;
  private autoUpdater: AppUpdater | null = null;
  private started = false;
  /** Set once the updater is ready: in full mode, the auto-updater is wired. */
  ready: Promise<void> = Promise.resolve();

  constructor(
    private settings: SettingsStore,
    private send: (s: UpdateState) => void,
  ) {
    this.state = {
      mode: detectMode(process.env, process.platform, app.isPackaged),
      status: 'idle',
      check: this.settings.data.updates.check,
      autoDownload: this.settings.data.updates.autoDownload,
    };
    if (this.state.mode === 'full') this.ready = this.initFull();
  }

  get mode(): UpdateMode { return this.state.mode; }
  get currentState(): UpdateState { return this.state; }

  /** Begin scheduling the automatic checks (10 s, then every 6 h). A no-op in mode off. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.arm();
  }

  /** (Re)arm the automatic timer from the current settings. */
  private arm(): void {
    this.clearTimers();
    // No automatic request at all when off or when the user's check toggle is off.
    if (!autoCheckArms(this.state.mode, this.settings.data.updates.check)) return;
    this.initial = setTimeout(() => {
      this.initial = null;
      void this.doCheck();
      this.periodic = setInterval(() => void this.doCheck(), CHECK_INTERVAL_MS);
    }, CHECK_START_DELAY_MS);
  }

  private clearTimers(): void {
    if (this.initial) { clearTimeout(this.initial); this.initial = null; }
    if (this.periodic) { clearInterval(this.periodic); this.periodic = null; }
  }

  /** Apply a check / autoDownload change and re-arm the automatic timer. */
  set(check: boolean, autoDownload: boolean): UpdateState {
    this.settings.update(s => { s.updates.check = check; s.updates.autoDownload = autoDownload; });
    if (this.autoUpdater) this.autoUpdater.autoDownload = autoDownload;
    // Push the read-back so the switches in the Settings window show the new values at once.
    this.publish({});
    this.arm();
    return this.state;
  }

  /** Manual "Check now": always runs, even when the automatic check is off. */
  async checkNow(): Promise<UpdateState> {
    if (this.state.mode === 'off') return this.state;
    await this.doCheck();
    return this.state;
  }

  /** Full mode: start downloading the found update. */
  async download(): Promise<UpdateState> {
    if (this.state.mode !== 'full' || !this.autoUpdater) return this.state;
    this.publish({ status: 'downloading', progress: 0 });
    await this.autoUpdater.downloadUpdate();
    return this.state;
  }

  /** Full mode: install now (relaunches into the new version). */
  async install(): Promise<UpdateState> {
    if (this.state.mode !== 'full' || !this.autoUpdater) return this.state;
    // Silent + force-run: our NSIS installer is assisted (oneClick: false), so
    // without the flags the setup wizard would open and wait for clicks.
    this.autoUpdater.quitAndInstall(true, true);
    return this.state;
  }

  /** Remember this version so the check won't nag about it again. */
  skip(version: string): UpdateState {
    this.settings.update(s => { s.updates.skipVersion = version; });
    // A skip settles the "available" nag back to up-to-date.
    if (this.state.status === 'available') this.publish({ status: 'up-to-date' });
    return this.state;
  }

  /** Stop all timers (app quit). */
  dispose(): void { this.clearTimers(); }

  private publish(patch: Partial<UpdateState>): void {
    // Every push carries the current switch settings, so the Settings window
    // reads them back (the switches never default to off on a fresh open).
    const { check, autoDownload } = this.settings.data.updates;
    this.state = { ...this.state, check, autoDownload, ...patch };
    this.send(this.state);
  }

  /** True when the newest release is the one the user chose to ignore. */
  private isSkipped(latest: string): boolean {
    const skip = this.settings.data.updates.skipVersion;
    return !!skip && compareVersions(latest, skip) === 0;
  }

  /** Wire electron-updater's events into our state (full mode only). */
  private async initFull(): Promise<void> {
    const { autoUpdater } = await import('electron-updater');
    this.autoUpdater = autoUpdater;
    autoUpdater.autoDownload = this.settings.data.updates.autoDownload;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', () => this.publish({ status: 'checking' }));
    autoUpdater.on('update-available', info => {
      if (this.isSkipped(info.version)) { this.publish({ status: 'up-to-date', version: info.version, notes: this.notesOf(info) }); return; }
      this.publish({ status: 'available', version: info.version, notes: this.notesOf(info), url: RELEASES_URL });
    });
    autoUpdater.on('update-not-available', info => this.publish({ status: 'up-to-date', version: info.version }));
    autoUpdater.on('download-progress', p => this.publish({ status: 'downloading', progress: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', info => this.publish({ status: 'downloaded', version: info.version }));
    autoUpdater.on('error', err => this.publish({ status: 'error', error: this.plain(err) }));
  }

  private notesOf(info: { releaseNotes?: unknown }): string {
    return info.releaseNotes?.toString() ?? '';
  }

  /** One plain sentence instead of a raw stack trace. */
  private plain(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    return /fetch|network|ECONN|ENOTFOUND|getaddrinfo|timeout|ETIMEDOUT/i.test(msg)
      ? 'The connection to the update server failed.'
      : 'The update check failed.';
  }

  private async doCheck(): Promise<void> {
    if (this.state.mode === 'off') return;
    if (this.state.mode === 'full' && this.autoUpdater) {
      try { await this.autoUpdater.checkForUpdates(); } catch (e) { this.publish({ status: 'error', error: this.plain(e) }); }
      return;
    }
    // check-only: ask GitHub for the newest release and compare.
    this.publish({ status: 'checking' });
    try {
      const res = await net.fetch(LATEST_URL, { headers: { accept: 'application/vnd.github+json', 'user-agent': USER_AGENT } });
      if (!res.ok) throw new Error(`GitHub replied ${res.status}`);
      const rel = parseLatestRelease(await res.json());
      if (!rel) { this.publish({ status: 'up-to-date' }); return; }
      const current = app.getVersion();
      if (compareVersions(rel.version, current) > 0 && !this.isSkipped(rel.version)) {
        this.publish({ status: 'available', version: rel.version, notes: rel.notes, url: rel.url });
      } else {
        this.publish({ status: 'up-to-date', version: rel.version, url: rel.url });
      }
    } catch (e) {
      this.publish({ status: 'error', error: this.plain(e) });
    }
  }
}
