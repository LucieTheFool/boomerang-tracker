// Electron entry point.
import { app, BrowserWindow, ipcMain, dialog, shell, Menu, globalShortcut, screen } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { Controller } from './controller.js';
import type { OverlayMode } from '../shared/types.js';
import { SettingsStore } from './settings.js';

const isDev = !app.isPackaged;
const appDir = app.getAppPath();

// Development/testing only: run against a scratch settings folder and save folder.
if (isDev && process.env.OOT_USER_DATA) app.setPath('userData', process.env.OOT_USER_DATA);

let main: BrowserWindow | null = null;
let controller: Controller;
let settings: SettingsStore;

function rendererUrl(page: string) {
  const dev = process.env.VITE_DEV_SERVER_URL;
  return dev ? `${dev}${page}` : `file://${path.join(appDir, 'dist', page)}`;
}

function createMain() {
  const b = settings.data.mainBounds;
  main = new BrowserWindow({
    width: b?.width ?? 1280, height: b?.height ?? 900, x: b?.x, y: b?.y,
    minWidth: 640, minHeight: 480,
    backgroundColor: '#11131a',
    title: 'Boomerang Tracker',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(appDir, 'dist-electron', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  void main.loadURL(rendererUrl('index.html'));
  const saveBounds = () => { if (main && !main.isMinimized() && !main.isMaximized()) settings.update(s => (s.mainBounds = main!.getBounds())); };
  main.on('resize', debounce(saveBounds, 500));
  main.on('move', debounce(saveBounds, 500));
  // Closing the main window quits the app, overlay included (a hidden overlay window
  // would otherwise keep it running in the background).
  main.on('closed', () => { main = null; overlay?.destroy(); app.quit(); });
  // Links open in the browser, never inside the app.
  main.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: 'deny' }; });
  if (isDev && process.env.OOT_DEVTOOLS) main.webContents.openDevTools({ mode: 'detach' });
}

// ---------------- Overlay ----------------
let overlay: BrowserWindow | null = null;

function createOverlay() {
  const o = settings.data.overlay;
  const wa = screen.getPrimaryDisplay().workArea;
  const b = o.bounds ?? { width: 360, height: 420, x: wa.x + wa.width - 380, y: wa.y + 40 };
  overlay = new BrowserWindow({
    ...b,
    minWidth: 220, minHeight: 90,
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, resizable: true, focusable: !o.locked, show: false,
    title: 'Boomerang Tracker overlay',
    webPreferences: { preload: path.join(appDir, 'dist-electron', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver'); // stays above borderless-fullscreen games
  overlay.setVisibleOnAllWorkspaces(true);
  void overlay.loadURL(rendererUrl('index.html') + '?overlay=1');
  const save = () => { if (overlay) settings.update(s => (s.overlay.bounds = overlay!.getBounds())); };
  overlay.on('move', debounce(save, 400));
  overlay.on('resize', debounce(save, 400));
  overlay.on('closed', () => { overlay = null; publishOverlay(false); });
  overlay.once('ready-to-show', () => { applyOverlaySettings(); overlay?.showInactive(); });
}

function applyOverlaySettings() {
  if (!overlay) return;
  const o = settings.data.overlay;
  overlay.setOpacity(o.opacity);
  // Locked: clicks pass through to the game. Unlocked: drag/resize it.
  overlay.setIgnoreMouseEvents(o.locked, { forward: true });
  overlay.setFocusable(!o.locked);
  overlay.setResizable(!o.locked);
}

function publishOverlay(visible = !!overlay?.isVisible()) {
  const o = settings.data.overlay;
  controller.patch({ overlay: { visible, locked: o.locked, opacity: o.opacity, mode: o.mode } });
}

function toggleOverlay() {
  if (overlay?.isVisible()) overlay.hide();
  else if (overlay) { applyOverlaySettings(); overlay.showInactive(); }
  else createOverlay();
  setTimeout(() => publishOverlay(), 50);
}

function toggleOverlayLock() {
  settings.update(s => (s.overlay.locked = !s.overlay.locked));
  applyOverlaySettings();
  if (overlay && !settings.data.overlay.locked && !overlay.isVisible()) overlay.showInactive();
  publishOverlay();
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const errors: string[] = [];
  const hk = settings.data.hotkeys;
  for (const [accel, fn, what] of [[hk.toggleOverlay, toggleOverlay, 'show/hide overlay'], [hk.lockOverlay, toggleOverlayLock, 'lock/unlock overlay']] as const) {
    if (!accel) continue;
    try {
      if (!globalShortcut.register(accel, fn)) errors.push(`${accel} (${what}) is already used by another program`);
    } catch {
      errors.push(`"${accel}" isn't a valid shortcut`);
    }
  }
  controller.patch({ hotkeys: { ...hk, errors } });
}

function debounce<T extends (...a: never[]) => void>(fn: T, ms: number) {
  let t: NodeJS.Timeout | undefined;
  return (...a: Parameters<T>) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Never crash on an unexpected error: log it and keep running.
const logFile = () => path.join(app.getPath('userData'), 'error.log');
function logError(where: string, e: unknown) {
  const line = `[${new Date().toISOString()}] ${where}: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`;
  try { fs.appendFileSync(logFile(), line); } catch { /* ignore */ }
  console.error(line);
}
process.on('uncaughtException', e => logError('uncaughtException', e));
process.on('unhandledRejection', e => logError('unhandledRejection', e));

// Only one tracker at a time; a second launch focuses the first.
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (main) { if (main.isMinimized()) main.restore(); main.focus(); } });

/** The app was renamed (formerly "OoT 100 Tracker"): carry settings, names and snapshots over once. */
function migrateOldUserData() {
  const now = app.getPath('userData');
  const old = path.join(app.getPath('appData'), 'OoT 100 Tracker');
  if (fs.existsSync(path.join(now, 'settings.json')) || !fs.existsSync(path.join(old, 'settings.json'))) return;
  try {
    fs.mkdirSync(now, { recursive: true });
    for (const f of ['settings.json', 'names.json']) if (fs.existsSync(path.join(old, f))) fs.copyFileSync(path.join(old, f), path.join(now, f));
    if (fs.existsSync(path.join(old, 'snapshots'))) fs.cpSync(path.join(old, 'snapshots'), path.join(now, 'snapshots'), { recursive: true });
  } catch (e) { logError('migrate old settings', e); }
}

app.whenReady().then(async () => {
  if (!process.env.OOT_USER_DATA) migrateOldUserData();
  settings = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  try {
    controller = new Controller({
      appDir,
      userData: app.getPath('userData'),
      snapshots: isDev ? path.join(appDir, 'fixtures', 'snapshots') : path.join(app.getPath('userData'), 'snapshots'),
      version: app.getVersion(),
    }, settings);
  } catch (e) {
    logError('startup', e);
    dialog.showErrorBox('Boomerang Tracker could not start',
      `The tracker's data files (data/checklist.json, data/save-mapping.json) are missing or broken.\n\n${(e as Error).message}`);
    app.quit();
    return;
  }

  // Development: share the locally built key-name table with the packaged app (stays on this PC).
  if (isDev) {
    const src = path.join(appDir, 'local', 'names.json');
    const dst = path.join(app.getPath('userData'), 'names.json');
    try {
      if (fs.existsSync(src) && (!fs.existsSync(dst) || fs.statSync(src).mtimeMs > fs.statSync(dst).mtimeMs)) fs.copyFileSync(src, dst);
    } catch (e) { logError('copy names', e); }
  }
  controller.onState(s => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('state', s);
  });

  ipcMain.handle('state:get', () => controller.state);
  ipcMain.handle('prefs:get', () => settings.data.ui);
  ipcMain.handle('prefs:set', (_e, ui) => { settings.update(s => (s.ui = ui)); return settings.data.ui; });
  ipcMain.handle('slot:pin', (_e, name: string | null) => controller.pinSlot(name));
  ipcMain.handle('manual:toggle', (_e, id: string) => controller.toggleManual(id));
  ipcMain.handle('dev:set', (_e, on: boolean) => controller.setDevPanel(on));
  ipcMain.handle('snapshot:take', (_e, label: string) => controller.takeSnapshot(label));
  ipcMain.handle('snapshot:open-folder', () => shell.openPath(controller.paths.snapshots));
  ipcMain.handle('identify:answer', (_e, reqId: string, itemIds: string[]) => controller.answerIdentify(reqId, itemIds));
  ipcMain.handle('identify:skip', (_e, reqId: string) => controller.skipIdentify(reqId));
  ipcMain.handle('identify:forget', (_e, itemId: string) => controller.forgetIdentification(itemId));
  ipcMain.handle('identify:export', () => (isDev ? controller.exportLearned() : 'Only available when running from source'));
  ipcMain.handle('overlay:toggle', () => toggleOverlay());
  ipcMain.handle('overlay:lock', () => toggleOverlayLock());
  ipcMain.handle('overlay:set', (_e, p: { opacity?: number; mode?: OverlayMode }) => {
    settings.update(s => {
      if (p.opacity !== undefined) s.overlay.opacity = Math.min(1, Math.max(0.2, p.opacity));
      if (p.mode) s.overlay.mode = p.mode;
    });
    applyOverlaySettings();
    publishOverlay();
  });
  ipcMain.handle('hotkeys:set', (_e, hk: { toggleOverlay: string; lockOverlay: string }) => {
    settings.update(s => (s.hotkeys = { toggleOverlay: hk.toggleOverlay.trim(), lockOverlay: hk.lockOverlay.trim() }));
    registerHotkeys();
  });
  ipcMain.handle('folder:browse', async () => {
    const r = await dialog.showOpenDialog(main!, {
      title: 'Choose your Hookshot folder (or its user\\save\\<id> folder)',
      properties: ['openDirectory'],
      defaultPath: settings.data.saveDir,
    });
    if (!r.canceled && r.filePaths[0]) await controller.useFolder(r.filePaths[0]);
    return controller.state;
  });

  createMain();
  if (isDev && process.env.OOT_SAVE_DIR) settings.data.saveDir = process.env.OOT_SAVE_DIR;
  if (isDev && process.env.OOT_DEV_PANEL) settings.data.devPanel = true;
  registerHotkeys();
  await controller.start();
  if (isDev && process.env.OOT_OVERLAY) {
    if (process.env.OOT_OVERLAY_MODE) settings.data.overlay.mode = process.env.OOT_OVERLAY_MODE as OverlayMode;
    if (process.env.OOT_OVERLAY_UNLOCKED) settings.data.overlay.locked = false;
    toggleOverlay();
  }

  // Development aid: OOT_SCREENSHOT=<file.png> captures the window once loaded, then quits.
  const shot = process.env.OOT_SCREENSHOT;
  if (isDev && shot && main) {
    main.webContents.once('did-finish-load', () => setTimeout(async () => {
      if (process.env.OOT_SCREENSHOT_SCROLL) await main!.webContents.executeJavaScript(`document.querySelector('.grid-wrap').scrollTop = ${Number(process.env.OOT_SCREENSHOT_SCROLL)}`);
      if (process.env.OOT_SCREENSHOT_CLICK) await main!.webContents.executeJavaScript(`[...document.querySelectorAll('.tile')].find(t => t.title.includes(${JSON.stringify(process.env.OOT_SCREENSHOT_CLICK)}))?.click()`);
      await new Promise(r => setTimeout(r, 300));
      const img = await main!.webContents.capturePage();
      const fsMod = await import('node:fs');
      fsMod.writeFileSync(shot, img.toPNG());
      if (overlay) fsMod.writeFileSync(shot.replace(/\.png$/, '-overlay.png'), (await overlay.webContents.capturePage()).toPNG());
      app.quit();
    }, Number(process.env.OOT_SCREENSHOT_DELAY ?? 2500)));
  }
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { controller?.stop(); app.quit(); });
