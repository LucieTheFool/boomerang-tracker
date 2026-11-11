// The only bridge between the UI and the main process.
import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, UiPrefs, OverlayMode } from '../shared/types.js';

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
  takeSnapshot: (label: string) => ipcRenderer.invoke('snapshot:take', label),
  openSnapshotFolder: () => ipcRenderer.invoke('snapshot:open-folder'),
  browseFolder: (): Promise<AppState> => ipcRenderer.invoke('folder:browse'),
  answerIdentify: (reqId: string, itemIds: string[]) => ipcRenderer.invoke('identify:answer', reqId, itemIds),
  skipIdentify: (reqId: string) => ipcRenderer.invoke('identify:skip', reqId),
  forgetIdentification: (itemId: string) => ipcRenderer.invoke('identify:forget', itemId),
  exportLearned: (): Promise<string> => ipcRenderer.invoke('identify:export'),
  toggleOverlay: () => ipcRenderer.invoke('overlay:toggle'),
  toggleOverlayLock: () => ipcRenderer.invoke('overlay:lock'),
  setOverlay: (p: { opacity?: number; mode?: OverlayMode }) => ipcRenderer.invoke('overlay:set', p),
  setHotkeys: (hk: { toggleOverlay: string; lockOverlay: string }) => ipcRenderer.invoke('hotkeys:set', hk),
};
export type TrackerApi = typeof api;
contextBridge.exposeInMainWorld('tracker', api);
