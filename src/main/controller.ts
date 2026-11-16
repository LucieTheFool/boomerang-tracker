// App logic for the main process: which folder and slot, reading and evaluating
// saves, manual ticks, snapshots. Sends AppState to the windows.
import fs from 'node:fs';
import path from 'node:path';
import { parseGameData, GameDataFile, GameDataError } from '../gamedata/parser.js';
import { autoDetectUserFolder, resolveUserFolders, listSlots, mostRecentSlot, readSaveStable, userFolderForExe, SlotInfo } from '../gamedata/saves.js';
import { loadNames } from '../gamedata/names.js';
import { Tracker, ChecklistFile, MappingFile, DescriptionsFile, applyDescriptions } from '../core/tracker.js';
import { regionsForArea } from '../core/areas.js';
import { evaluateLogic, Logic, LogicFile } from '../core/logic.js';
import type { AvailableEntry } from '../shared/types.js';
import { SaveWatcher } from './watcher.js';
import { LiveSource } from './live.js';
import { ChangeLog } from './changelog.js';
import { STAGE_KEY, LOCATION_KEY, areaFrom } from '../gamedata/live.js';
import { keyOf } from '../gamedata/detect.js';
import { SettingsStore } from './settings.js';
import type { AppState, Toast, SlotSummary } from '../shared/types.js';

export interface ControllerPaths {
  appDir: string; // holds data/ (and local/ in development)
  userData: string;
  snapshots: string;
  version: string;
}

export class Controller {
  private tracker: Tracker;
  private names = new Map<number, string>();
  private enumNames = new Map<number, string>();
  private watcher?: SaveWatcher;
  private userDir?: string;
  /** last parsed save per slot, for "just collected" and the change list */
  private lastParsed = new Map<string, { mtimeMs: number; data: GameDataFile; buf: Buffer }>();
  /** the save shown last (any slot) */
  private lastShown?: { mtimeMs: number; data: GameDataFile; buf: Buffer };
  private log!: ChangeLog;
  private toastId = 1;
  private toasts: Toast[] = [];
  state: AppState;
  private listeners = new Set<(s: AppState) => void>();

  constructor(readonly paths: ControllerPaths, readonly settings: SettingsStore) {
    const read = (f: string) => JSON.parse(fs.readFileSync(path.join(paths.appDir, 'data', f), 'utf8'));
    // A detailed local checklist (built from your own guide text, never published) wins
    // over the public one; both use the same ids.
    const local = path.join(paths.appDir, 'data', 'checklist.local.json');
    let checklist = (fs.existsSync(local) ? JSON.parse(fs.readFileSync(local, 'utf8')) : read('checklist.json')) as ChecklistFile;
    try { checklist = applyDescriptions(checklist, read('descriptions.json') as DescriptionsFile); } catch (e) { console.error('descriptions', e); }
    this.tracker = new Tracker(checklist, read('save-mapping.json') as MappingFile, settings.data.learned);
    try { this.logic = read('logic.json') as LogicFile; } catch { this.logic = undefined; }
    this.logicRows = this.tracker.checklist.categories.flatMap(c => c.items.map(i => ({ id: i.id, key: `${c.id}#${i.number}`, chapter: i.chapter })));
    for (const f of [path.join(paths.appDir, 'local', 'names.json'), path.join(paths.userData, 'names.json')]) {
      if (fs.existsSync(f)) { const t = loadNames(f); this.names = t.keys; this.enumNames = t.enums; break; }
    }
    const o = settings.data.overlay;
    this.state = {
      status: 'loading', slots: [], slotMode: 'recent', categories: [], snapshots: [], toasts: [], devPanel: settings.data.devPanel, version: paths.version,
      areaRegions: [],
      available: [],
      canBeAdult: false,
      identify: settings.data.pendingIdentify,
      learnedCount: settings.data.learned.length,
      overlay: { visible: false, locked: o.locked, opacity: o.opacity, mode: o.mode },
      hotkeys: { ...settings.data.hotkeys, errors: [] },
      live: { status: 'off', enabled: settings.data.live.enabled, using: false },
      changeLog: { enabled: settings.data.changeLog, dir: path.join(paths.userData, 'logs') },
    };
    this.log = new ChangeLog(path.join(paths.userData, 'logs'));
    this.log.enabled = settings.data.changeLog;
    this.allRegions = [...new Set(this.tracker.checklist.categories.flatMap(c => c.items.map(i => i.chapter).filter((x): x is string => !!x)))];
  }
  private allRegions: string[];
  private logic?: LogicFile;
  private logicRows: { id: string; key: string; chapter?: string }[] = [];

  /** Attach "can get now" logic to items and build the list, current area first. */
  private applyLogic(categories: AppState['categories'], save: GameDataFile, areaRegions: string[]): { available: AvailableEntry[]; canBeAdult: boolean } {
    if (!this.logic) return { available: [], canBeAdult: false };
    let statuses;
    try { statuses = evaluateLogic(this.logic, save, this.logicRows); } catch (e) { console.error('logic', e); return { available: [], canBeAdult: false }; }
    const L = new Logic(this.logic, save);
    const here = new Set(areaRegions.map(r => L.resolveRegion(r) ?? r));
    const available: AvailableEntry[] = [];
    for (const c of categories) for (const it of c.items) {
      const s = statuses.get(it.id);
      if (!s) continue;
      it.logic = s;
      if (c.part === 'A' && !it.done && s.ages.length) {
        available.push({ id: it.id, categoryId: c.id, categoryLabel: c.label, number: it.number, name: it.name, region: s.region, ages: s.ages, night: s.night, unsure: s.unsure, here: here.has(s.region) });
      }
    }
    available.sort((a, b) => Number(b.here) - Number(a.here) || a.region.localeCompare(b.region));
    return { available, canBeAdult: L.canBeAdult() };
  }

  onState(fn: (s: AppState) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { for (const fn of this.listeners) fn(this.state); }
  /** Update parts of the state owned by main.ts (overlay, hotkeys). */
  patch(p: Partial<AppState>) { this.state = { ...this.state, ...p }; this.emit(); }

  async start() {
    let dir = this.settings.data.saveDir;
    if (!dir || !resolveUserFolders(dir).length) {
      const found = autoDetectUserFolder();
      if (found) { dir = found; this.settings.update(s => (s.saveDir = found)); }
    }
    await this.useFolder(dir);
    if (this.settings.data.live.enabled) await this.startLive();
  }

  // ---- live (read-only) progress from the running game
  private live?: LiveSource;

  private async startLive() {
    if (this.live) return;
    this.live = new LiveSource({
      // Where the tables were found before, newest first (one per game build, e.g. Hookshot and Longshot).
      hints: [...new Set([...(this.settings.data.live.hints ?? []), this.settings.data.live.hint].filter((h): h is string => !!h))],
      onHint: h => this.settings.update(s => {
        // Keep the older single hint too (settings from before there was a list).
        const prev = [...(s.live.hints ?? []), ...(s.live.hint ? [s.live.hint] : [])];
        s.live.hints = [...new Set([h, ...prev])].slice(0, 4);
        s.live.hint = h;
      }),
      onGame: exe => void this.followGame(exe),
      onChange: () => void this.refresh(true),
      onStatus: () => {
        const i = this.live?.info;
        if (i && (i.status === 'live') !== this.state.live.using) this.log.write({ kind: 'source', status: i.status, detail: i.detail });
        void this.refresh(false);
      },
    });
    this.live.watchInts = this.watchedInts();
    if (this.lastShownSave) this.live.setReference(this.lastShownSave);
    await this.live.start();
  }

  async setLiveEnabled(on: boolean) {
    this.settings.update(s => (s.live.enabled = on));
    if (on) await this.startLive();
    else { this.live?.stop(); this.live = undefined; }
    await this.refresh(false);
  }

  /** Ints the mapping or logic reads (other Ints, like play time, change all the time). */
  private watchedInts(): Set<number> {
    const out = new Set<number>();
    for (const k of this.tracker.keyToEntries.keys()) if (typeof k === 'number') out.add(k >>> 0);
    const walk = (x: unknown) => {
      if (Array.isArray(x)) return x.forEach(walk);
      if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        if (typeof o.name === 'string' || typeof o.key === 'string') { try { out.add(keyOf(o as { name?: string; key?: string }) >>> 0); } catch { /* not a rule */ } }
        Object.values(o).forEach(walk);
      }
    };
    walk(this.logic);
    return out;
  }
  /** Newest save read (the live source's reference). */
  private lastShownSave?: GameDataFile;

  async useFolder(dir: string | undefined) {
    this.watcher?.stop();
    this.watcher = undefined;
    this.lastParsed.clear();
    this.lastShownBySlot.clear();
    this.lastShown = undefined;
    this.userDir = undefined;
    if (!dir) return this.fail('no-folder', "No save folder found. Choose your game folder (Hookshot, Longshot, NX2navi's Triforce or ReLink) or its user\\save\\<id> folder, or Fritchii's data folder (%APPDATA%\\fritchii).");
    if (!fs.existsSync(dir)) return this.fail('no-folder', `The save folder no longer exists:\n${dir}`);
    const users = resolveUserFolders(dir);
    if (!users.length) return this.fail('no-slots', `No slot_* folders with a progress.sav were found in:\n${dir}`);
    // If a game folder holds several profiles, use the most recently played one.
    this.userDir = users.sort((a, b) => Math.max(0, ...listSlots(b).map(s => s.mtimeMs)) - Math.max(0, ...listSlots(a).map(s => s.mtimeMs)))[0];
    if (this.settings.data.saveDir !== this.userDir) this.settings.update(s => (s.saveDir = this.userDir));
    this.watcher = new SaveWatcher(this.userDir, () => void this.refresh(true));
    this.watcher.start();
    await this.refresh(false);
  }

  /**
   * When a game starts, follow its saves: Hookshot, Longshot, NX2navi, ReLink and Fritchii each keep their
   * own. Not while a slot is pinned (that's a choice of save), and only if it has saves.
   */
  private async followGame(exe: string | undefined) {
    if (!exe || this.settings.data.pinnedSlot) return;
    const dir = userFolderForExe(exe);
    if (!dir || path.resolve(dir).toLowerCase() === path.resolve(this.userDir ?? '').toLowerCase()) return;
    const game = path.dirname(exe).replace(/\\bin$/i, '');
    this.log.write({ kind: 'source', status: 'switched', detail: `Following the running game: ${game}` });
    this.toast(`Switched to the saves of the game that's running (${game}).`, 8000);
    await this.useFolder(dir);
  }

  private fail(status: AppState['status'], message: string) {
    this.state = { ...this.state, status, message, slots: [], categories: [], summary: undefined, saveDir: this.userDir };
    this.emit();
  }

  /** Re-read the active slot. `fromWatcher` = a new save was written (enables glow and toasts). */
  async refresh(fromWatcher: boolean) {
    if (!this.userDir) return;
    const slots = listSlots(this.userDir);
    if (!slots.length) return this.fail('no-slots', `No slot_* folders with a progress.sav in:\n${this.userDir}`);
    const pinned = this.settings.data.pinnedSlot;
    const slot: SlotInfo = (pinned && slots.find(s => s.name === pinned)) || mostRecentSlot(slots);

    let read: { mtimeMs: number; data: GameDataFile; buf: Buffer };
    try {
      // Live updates refresh often; don't re-read a save that hasn't changed.
      const cached = this.lastParsed.get(slot.name);
      read = cached && cached.mtimeMs === slot.mtimeMs ? cached : await readSaveStable(slot.progress);
    } catch (e) {
      // Keep showing the last good state; just report the problem.
      const msg = e instanceof GameDataError ? `This save doesn't look like an Ocarina of Time save: ${e.message}` : `Couldn't read ${slot.name}/progress.sav: ${(e as Error).message}`;
      this.state = { ...this.state, status: this.state.summary ? 'ok' : 'error', message: msg };
      this.emit();
      return;
    }
    const saved = { mtimeMs: read.mtimeMs, data: read.data, buf: read.buf };
    this.lastParsed.set(slot.name, saved);
    // Live data is used only when following the most recent save (it is the game's
    // current state, which a pinned older slot isn't), and only while it matches it.
    if (!pinned) { this.lastShownSave = read.data; this.live?.setReference(read.data); }
    const liveSnap = pinned ? undefined : this.live?.current();
    const cur = liveSnap ? { mtimeMs: liveSnap.atMs, data: liveSnap.data, buf: read.buf } : saved;

    // Compare with the previous state we showed. Autosaves rotate across slots, so when
    // following "most recent" the previous save is usually in a different slot.
    const prev = pinned ? this.lastShownBySlot.get(slot.name) : this.lastShown;
    const isNewSave = !!prev && cur.mtimeMs > prev.mtimeMs;
    // A save from another playthrough loses flags; don't toast, glow or ask about it.
    // (Respawning objects clear their flags again by design; they don't count.)
    const resettable = liveSnap?.resettable;
    const lost = prev ? [...prev.data.bool64].filter(k => !cur.data.bool64.has(k) && !resettable?.has(k)).length : 0;
    const samePlaythrough = isNewSave && lost <= 3;

    // Live: the current stage straight from the game; otherwise the save's caption.
    const liveStage = liveSnap?.data.entries.get(STAGE_KEY)?.value;
    const stageIsLive = typeof liveStage === 'string' && !!liveStage;
    const stage = stageIsLive ? liveStage : this.readRawArea(slot);
    // Lake Hylia and Lon Lon Ranch are inside the Hyrule Field stage; the location list says which.
    const rawArea = stage ? areaFrom(stage, cur.data.entries.get(LOCATION_KEY)?.value) : undefined;
    const areaRegions = regionsForArea(rawArea, this.allRegions);
    // For "which one was it?", also allow the surrounding stage: the place boundaries
    // needn't match the checklist's areas exactly.
    const nearRegions = rawArea !== stage ? [...new Set([...areaRegions, ...regionsForArea(stage, this.allRegions)])] : areaRegions;

    // Where you are only says which spot you just collected when it's read live.
    if (samePlaythrough && fromWatcher) this.collectIdentifications(prev!.data, cur.data, stageIsLive ? nearRegions : undefined);
    const manual = this.manualFor(slot.name);
    const { categories, summary } = this.tracker.evaluate(cur.data, manual, samePlaythrough ? prev!.data : undefined);
    // A place inside the stage has no age of its own: take the stage's (_Child/_Adult).
    const age = rawArea !== stage ? stage?.match(/_(Adult|Child)$/)?.[0] ?? '' : '';
    summary.area = rawArea ? prettyArea(rawArea.split('/').pop()! + age) : undefined;
    const { available, canBeAdult } = this.applyLogic(categories, cur.data, areaRegions);
    summary.lastSavedMs = read.mtimeMs;

    let lastChanges = this.state.lastChanges;
    if (isNewSave) {
      const rep = this.tracker.describeChanges(prev!.data, cur.data, slot.name, this.names, this.enumNames);
      // Live refreshes often; keep the last report that actually had changes.
      if (rep.known.length || rep.unknown.length || !liveSnap) lastChanges = rep;
      if (samePlaythrough && (rep.known.length || rep.unknown.length)) {
        this.log.write({ kind: 'change', source: liveSnap ? 'live' : 'save', slot: slot.name, area: rawArea, known: rep.known, unknown: rep.unknown, unknownTotal: rep.unknown.length });
      }
      if (fromWatcher && samePlaythrough) this.makeToasts(categories, prev!.data, cur.data);
    }
    this.lastShownBySlot.set(slot.name, cur);
    if (!prev || cur.mtimeMs >= prev.mtimeMs || !liveSnap) this.lastShown = cur;

    const warn = read.data.warnings.length ? `Save format warning: ${read.data.warnings[0]}` : undefined;
    this.state = {
      ...this.state,
      status: 'ok',
      message: warn,
      saveDir: this.userDir,
      slots: slots.map((s): SlotSummary => ({ name: s.name, mtimeMs: s.mtimeMs, area: this.readArea(s) })),
      slotMode: pinned ? 'manual' : 'recent',
      activeSlot: slot.name,
      summary, categories, lastChanges, areaRegions, available, canBeAdult,
      identify: this.settings.data.pendingIdentify,
      learnedCount: this.settings.data.learned.length,
      snapshots: this.listSnapshots(),
      toasts: this.toasts,
      devPanel: this.settings.data.devPanel,
      live: { ...(this.live?.info ?? { status: 'off' }), enabled: this.settings.data.live.enabled, using: !!liveSnap },
    };
    this.emit();
  }
  private lastShownBySlot = new Map<string, { mtimeMs: number; data: GameDataFile; buf: Buffer }>();

  private makeToasts(categories: AppState['categories'], before: GameDataFile, after: GameDataFile) {
    const add = (text: string) => {
      const t = { id: this.toastId++, text };
      this.toasts = [...this.toasts, t].slice(-5);
      setTimeout(() => { this.toasts = this.toasts.filter(x => x.id !== t.id); this.state = { ...this.state, toasts: this.toasts }; this.emit(); }, 6000);
    };
    for (const c of categories) {
      const n = c.items.filter(i => i.justCollected).length;
      if (n) add(n === 1 ? `+1 ${singular(c.label)}: ${c.items.find(i => i.justCollected)!.name}` : `+${n} ${c.label}`);
    }
    // Tokens have no per-Skulltula mapping yet, so toast on the counter too.
    const tok = (g: GameDataFile) => this.tracker.evaluate(g).summary.tokens ?? 0;
    const dt = tok(after) - tok(before);
    if (dt > 0) add(`+${dt} Gold Skulltula${dt > 1 ? 's' : ''} (${tok(after)} total)`);
  }

  /** Area string from caption.sav, e.g. "Market/Market_Child". */
  private readRawArea(slot: SlotInfo): string | undefined {
    try {
      const cap = parseGameData(fs.readFileSync(slot.caption));
      const strs = [...cap.entries.values()].filter(e => e.type === 'String64' && typeof e.value === 'string').map(e => e.value as string);
      return strs.find(s => s.includes('/')) ?? strs[0];
    } catch { return undefined; }
  }

  private readArea(slot: SlotInfo): string | undefined {
    const raw = this.readRawArea(slot);
    return raw ? prettyArea(raw.split('/').pop()!) : undefined;
  }

  // ---- "which one was this?"
  /** New pool flags in this save: learn the obvious ones, queue questions for the rest. */
  private collectIdentifications(before: GameDataFile, after: GameDataFile, here?: string[]) {
    const { ask, auto } = this.tracker.identifications(before, after, here);
    if (!ask.length && !auto.length) return;
    const at = new Date().toISOString();
    this.settings.update(s => {
      for (const g of auto) s.learned.push({ ...g, at });
      for (const q of ask) if (!s.pendingIdentify.some(p => p.id === q.id)) s.pendingIdentify.push({ ...q, at });
    });
    if (auto.length) this.tracker.setLearned(this.settings.data.learned);
    for (const g of auto) this.log.write({ kind: 'identify', how: g.area ? 'auto-area' : 'auto-group', items: g.items, flags: g.flags, area: g.area });
    for (const g of auto) {
      if (!g.area || g.items.length !== 1) continue;
      const d = this.tracker.describe(g.items[0]);
      this.toast(`Recognised ${singular(d.category)} #${d.number} from where you are (${g.area}). Wrong? Undo it in its details.`, 8000);
    }
    for (const q of ask) this.toast(`+${q.pick} ${singular(q.categoryLabel)} in ${q.area}: which one? Answer in the tracker.`, 10000);
  }

  async answerIdentify(reqId: string, itemIds: string[]) {
    const q = this.settings.data.pendingIdentify.find(p => p.id === reqId);
    if (!q || itemIds.length !== q.pick) return;
    this.settings.update(s => {
      s.learned.push({ flags: q.flags, items: itemIds, at: new Date().toISOString() });
      s.pendingIdentify = s.pendingIdentify.filter(p => p.id !== reqId);
      // Other open questions about the same group may now have fewer candidates.
      for (const p of s.pendingIdentify) {
        p.candidates = p.candidates.filter(c => !itemIds.includes(c.id));
        if (p.others) p.others = p.others.filter(c => !itemIds.includes(c.id));
      }
    });
    this.tracker.setLearned(this.settings.data.learned);
    this.log.write({ kind: 'identify', how: 'answer', items: itemIds, flags: q.flags, area: q.area });
    await this.refresh(false);
  }

  async skipIdentify(reqId: string) {
    const q = this.settings.data.pendingIdentify.find(p => p.id === reqId);
    if (q) this.log.write({ kind: 'identify', how: 'skip', items: [], flags: q.flags, area: q.area });
    this.settings.update(s => (s.pendingIdentify = s.pendingIdentify.filter(p => p.id !== reqId)));
    await this.refresh(false);
  }

  /** Undo an answer that included this row (its flags go back into the group). */
  async forgetIdentification(itemId: string) {
    for (const g of this.settings.data.learned) if (g.items.includes(itemId)) this.log.write({ kind: 'identify', how: 'undo', items: g.items, flags: g.flags, area: g.area });
    this.settings.update(s => (s.learned = s.learned.filter(g => !g.items.includes(itemId))));
    this.tracker.setLearned(this.settings.data.learned);
    await this.refresh(false);
  }

  /** Development: write answered spots into data/save-mapping.json as confirmed entries. */
  exportLearned(): string {
    const file = path.join(this.paths.appDir, 'data', 'save-mapping.json');
    const m = JSON.parse(fs.readFileSync(file, 'utf8')) as MappingFile;
    let n = 0;
    for (const g of this.settings.data.learned) {
      if (g.items.length !== 1) continue; // only exact answers
      const id = g.items[0];
      m.entries[id] = g.area
        ? { label: m.entries[id]?.label ?? id, detect: { b64: g.flags[0] }, confidence: 'likely', evidence: `Recognised in the tracker from the area (${g.area})${g.at ? ` on ${g.at.slice(0, 10)}` : ''}: collecting it set 64-bit flag ${g.flags[0]}` }
        : { label: m.entries[id]?.label ?? id, detect: { b64: g.flags[0] }, confidence: 'confirmed', evidence: `Identified in the tracker${g.at ? ` on ${g.at.slice(0, 10)}` : ''}: collecting it set 64-bit flag ${g.flags[0]}` };
      n++;
    }
    fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
    return `Wrote ${n} identified spot${n === 1 ? '' : 's'} into data/save-mapping.json`;
  }

  private toast(text: string, ms = 6000) {
    const t = { id: this.toastId++, text };
    this.toasts = [...this.toasts, t].slice(-5);
    setTimeout(() => { this.toasts = this.toasts.filter(x => x.id !== t.id); this.state = { ...this.state, toasts: this.toasts }; this.emit(); }, ms);
  }

  // ---- user actions
  async pinSlot(name: string | null) {
    this.settings.update(s => (s.pinnedSlot = name));
    await this.refresh(false);
  }

  private manualKey(slot: string) { return `${this.userDir}|${slot}`; }
  private manualFor(slot: string) { return this.settings.data.manual[this.manualKey(slot)] ?? {}; }

  async toggleManual(itemId: string) {
    const slot = this.state.activeSlot;
    if (!slot) return;
    this.settings.update(s => {
      const k = this.manualKey(slot);
      const m = (s.manual[k] ??= {});
      if (m[itemId]) delete m[itemId]; else m[itemId] = true;
    });
    this.log.write({ kind: 'manual', item: itemId, ticked: !!this.manualFor(slot)[itemId], slot });
    await this.refresh(false);
  }

  setChangeLog(on: boolean) {
    this.settings.update(s => (s.changeLog = on));
    this.log.enabled = on;
    this.state = { ...this.state, changeLog: { ...this.state.changeLog, enabled: on } };
    this.emit();
  }

  /** Folder holding the change logs (created if missing). */
  logDir() { fs.mkdirSync(this.log.dir, { recursive: true }); return this.log.dir; }

  setDevPanel(on: boolean) {
    this.settings.update(s => (s.devPanel = on));
    this.state = { ...this.state, devPanel: on };
    this.emit();
  }

  // ---- snapshots (development aid for mapping)
  private listSnapshots() {
    try {
      return fs.readdirSync(this.paths.snapshots).filter(f => f.endsWith('.sav')).sort().reverse().slice(0, 30)
        .map(file => ({ file, label: file.replace(/\.sav$/, '') }));
    } catch { return []; }
  }

  async takeSnapshot(label: string) {
    const slot = this.state.activeSlot;
    const cur = slot && this.lastParsed.get(slot);
    if (!slot || !cur || !this.userDir) return;
    // Re-read so the snapshot is exactly what is on disk now.
    const info = listSlots(this.userDir).find(s => s.name === slot)!;
    const { buf, data } = await readSaveStable(info.progress);
    fs.mkdirSync(this.paths.snapshots, { recursive: true });
    const prevFile = this.listSnapshots()[0]?.file;
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    const safe = (label || 'snap').replace(/[^\w.-]+/g, '-').slice(0, 60);
    const file = `${stamp}-${slot}-${safe}.sav`;
    fs.writeFileSync(path.join(this.paths.snapshots, file), buf);
    let snapshotDiff = this.state.snapshotDiff;
    if (prevFile) {
      const prev = parseGameData(fs.readFileSync(path.join(this.paths.snapshots, prevFile)));
      const rep = this.tracker.describeChanges(prev, data, slot, this.names, this.enumNames);
      snapshotDiff = { from: prevFile, to: file, rows: [...rep.known, ...rep.unknown] };
    }
    this.state = { ...this.state, snapshots: this.listSnapshots(), snapshotDiff };
    this.emit();
  }

  stop() { this.watcher?.stop(); this.live?.stop(); }
}

function singular(label: string) {
  const map: Record<string, string> = { 'Heart Pieces': 'Piece of Heart', 'Gold Skulltulas': 'Gold Skulltula', 'Bosses': 'Boss', 'Mini-bosses': 'Mini-boss',
    'Dungeons Cleared': 'Dungeon cleared', 'Side Quests': 'Side quest', 'Great Fairies': 'Great Fairy', 'Capacity Upgrades': 'Upgrade', 'Stones & Medallions': 'Stone/Medallion' };
  return map[label] ?? label.replace(/es$/, '').replace(/s$/, '');
}

/** "Market_Child" -> "Market (child)", "HyruleField_Adult" -> "Hyrule Field (adult)" */
export function prettyArea(s: string): string {
  const m = s.match(/^(.*?)(?:_(Adult|Child))?$/)!;
  const base = m[1].replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return m[2] ? `${base} (${m[2].toLowerCase()})` : base;
}
