// The only bridge between the UI and the main process.
import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, UiPrefs, OverlayMode, PadState, UpdateState } from '../shared/types.js';

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('state:get'),
  onState: (fn: (s: AppState) => void) => {
    const h = (_e: unknown, s: AppState) => fn(s);
    ipcRenderer.on('state', h);
    return () => { ipcRenderer.removeListener('state', h); };
  },
  getPrefs: (): Promise<UiPrefs> => ipcRenderer.invoke('prefs:get'),
  setPrefs: (p: UiPrefs): Promise<UiPrefs> => ipcRenderer.invoke('prefs:set', p),
  pinSlot: (name: string | null) => ipcRenderer.invoke('slot:pin', name),
  toggleManual: (id: string) => ipcRenderer.invoke('manual:toggle', id),
  setDevPanel: (on: boolean) => ipcRenderer.invoke('dev:set', on),
  setWipFeatures: (on: boolean) => ipcRenderer.invoke('wip:set', on),
  setLive: (on: boolean) => ipcRenderer.invoke('live:set', on),
  setChangeLog: (on: boolean) => ipcRenderer.invoke('log:set', on),
  openLogFolder: () => ipcRenderer.invoke('log:open'),
  takeSnapshot: (label: string) => ipcRenderer.invoke('snapshot:take', label),
  openSnapshotFolder: () => ipcRenderer.invoke('snapshot:open-folder'),
  browseFolder: (): Promise<AppState> => ipcRenderer.invoke('folder:browse'),
  answerIdentify: (reqId: string, itemIds: string[]) => ipcRenderer.invoke('identify:answer', reqId, itemIds),
  skipIdentify: (reqId: string) => ipcRenderer.invoke('identify:skip', reqId),
  forgetIdentification: (itemId: string) => ipcRenderer.invoke('identify:forget', itemId),
  exportLearned: (): Promise<string> => ipcRenderer.invoke('identify:export'),
  toggleOverlay: () => ipcRenderer.invoke('overlay:toggle'),
  openSettings: () => ipcRenderer.invoke('settings:open'),
  toggleOverlayLock: () => ipcRenderer.invoke('overlay:lock'),
  setOverlay: (p: { opacity?: number; mode?: OverlayMode }) => ipcRenderer.invoke('overlay:set', p),
  setHotkeys: (hk: { toggleOverlay: string; lockOverlay: string }) => ipcRenderer.invoke('hotkeys:set', hk),
  setPad: (p: { enabled?: boolean; mode?: PadState['mode']; holdMs?: number; resetButton?: boolean }) => ipcRenderer.invoke('pad:set', p),
  learnPadButton: () => ipcRenderer.invoke('pad:learn'),
  cancelPadLearn: () => ipcRenderer.invoke('pad:cancel-learn'),
  getUpdatesState: (): Promise<UpdateState> => ipcRenderer.invoke('updates:get-state'),
  onUpdatesState: (fn: (s: UpdateState) => void) => {
    const h = (_e: unknown, s: UpdateState) => fn(s);
    ipcRenderer.on('updates:state', h);
    return () => { ipcRenderer.removeListener('updates:state', h); };
  },
  setUpdates: (p: { check?: boolean; autoDownload?: boolean }): Promise<UpdateState> => ipcRenderer.invoke('updates:set', p),
  checkForUpdates: (): Promise<UpdateState> => ipcRenderer.invoke('updates:check'),
  downloadUpdate: (): Promise<UpdateState> => ipcRenderer.invoke('updates:download'),
  installUpdate: (): Promise<UpdateState> => ipcRenderer.invoke('updates:install'),
  skipUpdate: (version: string): Promise<UpdateState> => ipcRenderer.invoke('updates:skip', version),
};
export type TrackerApi = typeof api;
contextBridge.exposeInMainWorld('tracker', api);
