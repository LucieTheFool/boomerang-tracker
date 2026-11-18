// Live source: attaches (read-only) to a running game (Hookshot, Longshot, NX2navi or the
// Fritchii emulator), keeps the progress tables located, and reports when tracked values
// change. Falls back to nothing (the save files) whenever the game isn't running or isn't
// in the same playthrough.
import type { GameDataFile } from '../gamedata/parser.js';
import { locate, readTables, buildLive, fingerprint, matchesReference, sweepRanges, LiveTables, Agreement } from '../gamedata/live.js';
import { ProcessMemory, findProcesses, initMemoryAccess } from './procmem.js';
import type { LiveInfo } from '../shared/types.js';

/**
 * Programs that run the game. Hookshot and its fork Longshot run it as hookshot.exe;
 * NX2navi builds it as Triforce.exe and Project ReLink as bin\relink-game.exe. They map the game
 * at a fixed place. The Fritchii
 * emulator (lichii.exe) puts it somewhere new every run, so it's found by sweeping.
 */
const GAMES: { image: string; emulator?: boolean }[] = [
  { image: 'hookshot.exe' }, { image: 'Triforce.exe' }, { image: 'relink-game.exe' }, { image: 'lichii.exe', emulator: true },
];
const TICK_MS = 500;
const FIND_EVERY_MS = 3000;
/**
 * Where the tables were in Hookshot v2.1.0, Longshot v1.0.0, and NX2navi's Triforce v0.4.0 and
 * Project ReLink (the same address) (host addresses). Only starting points.
 */
const DEFAULT_HINTS = [0x1010_99f4_f418n, 0x1010_7eea_f418n, 0x1010_8bda_f418n];
/** The game's heap: guest 0x10_0000_0000, ~7 GB, mapped at host base 0x1000_0000_0000. */
const HEAP_LO = 0x1010_0000_0000n, HEAP_HI = 0x1011_c000_0000n;
const SWEEP_WINDOW = 64 << 20; // locate() reads twice this per step
/** Steps overlap a little, so tables lying across two windows are still found whole. */
const SWEEP_STEP = BigInt(SWEEP_WINDOW * 2 - (8 << 20));

/** What the live source needs from an opened game (read-only). */
export type LiveMem = Pick<ProcessMemory, 'read' | 'imagePath' | 'regions' | 'alive' | 'close'>;

export interface LiveOptions {
  /** Table addresses found before (hex), newest first. */
  hints: string[];
  onHint(hex: string): void;
  /** A game was attached to: the full path of its exe, if Windows gave it. */
  onGame?(exe: string | undefined): void;
  onChange(): void;
  onStatus(): void;
  /** Tests: find and open the game without Windows (defaults: tasklist + ProcessMemory). */
  findGame?: () => Promise<{ pid: number; image: string; emulator?: boolean } | undefined>;
  open?: (pid: number) => LiveMem;
  now?: () => number;
}

export class LiveSource {
  info: LiveInfo = { status: 'off' };
  private mem?: LiveMem;
  private tables?: LiveTables;
  private ref?: GameDataFile;
  private timer?: NodeJS.Timeout;
  private lastFind = 0;
  private lastPrint?: string;
  private snapshot?: { data: GameDataFile; atMs: number; resettable: Set<bigint> };
  private emulator = false;
  /** Where the sweep is: ranges to search (host [lo, hi)), the current one and the next window's centre. */
  private sweep?: { ranges: [bigint, bigint][]; i: number; at: bigint };
  private sweepPausedUntil = 0;
  private busy = false;
  private lastError?: string;
  private readonly now: () => number;
  watchInts = new Set<number>();

  constructor(private opts: LiveOptions) { this.now = opts.now ?? Date.now; }

  async start() {
    if (!(await initMemoryAccess())) return this.set({ status: 'unavailable', detail: 'Reading game memory is not available on this system.' });
    this.set({ status: 'no-game' });
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.detach();
    this.set({ status: 'off' });
  }

  /** The latest save: tells types apart and confirms we're looking at the same playthrough. */
  setReference(ref: GameDataFile) { this.ref = ref; }

  /** Live data, only while it matches the reference save. */
  current() { return this.info.status === 'live' ? this.snapshot : undefined; }

  private gone() { this.detach(); this.set({ status: 'no-game' }); }

  private set(info: LiveInfo) {
    const changed = info.status !== this.info.status || info.detail !== this.info.detail;
    this.info = info;
    if (changed) { console.log('[live]', info.status, info.detail ?? ''); this.opts.onStatus(); }
  }

  private detach() {
    this.mem?.close();
    this.mem = undefined;
    this.tables = undefined;
    this.snapshot = undefined;
    this.lastPrint = undefined;
    this.sweep = undefined;
    // A game started again is a fresh run: don't wait out the last run's "not found" pause.
    this.sweepPausedUntil = 0;
  }

  /** One attach/poll step (public for tests; start() runs it on a timer). */
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try { await this.step(); } catch (e) {
      // Once per distinct problem: this runs twice a second.
      const msg = String((e as Error)?.message ?? e);
      if (msg !== this.lastError) console.error('live', e);
      this.lastError = msg;
      this.detach();
      this.lastFind = this.now(); // look again at the usual pace, not on the very next tick
      this.set({ status: 'no-game', detail: msg });
    } finally { this.busy = false; }
  }

  private async step() {
    if (this.mem && !this.mem.alive()) this.gone();
    if (!this.mem) {
      if (this.now() - this.lastFind < FIND_EVERY_MS) return;
      this.lastFind = this.now();
      const game = await (this.opts.findGame ?? findGame)();
      if (!game) return this.set({ status: 'no-game' });
      try {
        this.mem = this.opts.open ? this.opts.open(game.pid) : new ProcessMemory(game.pid);
      } catch {
        // Typically a game started as administrator. Retried every few seconds; said once.
        return this.set({ status: 'no-game', detail: `${game.image} is running, but Windows won't let Boomerang Tracker open it. If the game runs as administrator, run the tracker as administrator too.` });
      }
      this.emulator = !!game.emulator;
      this.opts.onGame?.(this.mem.imagePath());
    }
    if (!this.ref) return this.set({ status: 'searching', detail: 'Waiting for a save to compare with.' });
    if (!this.tables && !this.find()) return;
    const raw = readTables(this.mem, this.tables!);
    if (!raw) { this.tables = undefined; this.lastPrint = undefined; return this.set({ status: 'searching' }); }
    const print = fingerprint(this.tables!, raw, this.watchInts);
    // Nothing tracked changed: skip rebuilding (most ticks).
    if (print === this.lastPrint && this.info.status === 'live') return;
    const live = buildLive(this.tables!, raw, this.ref);
    if (!matchesReference(live.agreement)) {
      this.snapshot = undefined;
      this.lastPrint = undefined;
      return this.set({ status: 'waiting', detail: describeMismatch(live.agreement) });
    }
    this.lastError = undefined;
    const wasLive = this.info.status === 'live';
    this.set({ status: 'live' });
    if (print !== this.lastPrint || !wasLive) {
      this.lastPrint = print;
      this.snapshot = { data: live.data, atMs: this.now(), resettable: live.resettable };
      this.opts.onChange();
    }
  }

  /**
   * Try the saved hints, then the defaults, then sweep one window per tick: the recomps'
   * heap, or an emulator's mapped memory (biggest blocks first).
   */
  private find(): boolean {
    const mem = this.mem!, ref = this.ref!;
    if (this.now() < this.sweepPausedUntil) return false;
    if (this.sweep === undefined) {
      // After a full sweep found nothing, stay "waiting" rather than flicker back.
      if (this.info.status !== 'waiting') this.set({ status: 'searching' });
      const hints = [...new Set([...this.opts.hints.map(h => BigInt('0x' + h)), ...DEFAULT_HINTS])];
      // Exact spots first (cheap), then a wider window around each. An emulator's memory
      // moves every run, so only a tracker restart during the same run hits a hint there.
      for (const h of hints) { const t = locate(mem, ref, h, 4 << 20); if (t) return this.found(t); }
      if (!this.emulator) for (const h of hints.slice(0, 2)) {
        const t = locate(mem, ref, h, SWEEP_WINDOW);
        if (t) return this.found(t);
      }
      const ranges: [bigint, bigint][] = this.emulator ? sweepRanges(mem.regions()) : [[HEAP_LO, HEAP_HI]];
      this.sweep = { ranges, i: 0, at: (ranges[0]?.[0] ?? 0n) + BigInt(SWEEP_WINDOW) };
    }
    const s = this.sweep;
    const range = s.ranges[s.i];
    if (range) {
      const t = locate(mem, ref, s.at, SWEEP_WINDOW);
      if (t) return this.found(t);
      s.at += SWEEP_STEP;
      if (s.at - BigInt(SWEEP_WINDOW) >= range[1] && s.ranges[++s.i]) s.at = s.ranges[s.i][0] + BigInt(SWEEP_WINDOW);
    }
    if (!s.ranges[s.i]) {
      // Not found anywhere (e.g. still at the title screen). Try again in a bit.
      this.sweep = undefined;
      this.sweepPausedUntil = this.now() + 10_000;
      this.set({ status: 'waiting', detail: "Couldn't find the progress tables yet. Load your file in the game." });
    }
    return false;
  }

  private found(t: LiveTables): boolean {
    this.tables = t;
    this.sweep = undefined;
    const hint = t.records[0].start.toString(16);
    if (hint !== this.opts.hints[0]) { this.opts.hints = [hint, ...this.opts.hints.filter(h => h !== hint)].slice(0, 4); this.opts.onHint(hint); }
    return true;
  }
}

/** The first running game, in the order of GAMES. `strict`: see findProcesses. */
export async function findGame(strict = false): Promise<{ pid: number; image: string; emulator?: boolean } | undefined> {
  for (const g of GAMES) {
    const [pid] = await findProcesses(g.image, strict);
    if (pid) return { pid, image: g.image, emulator: g.emulator };
  }
  return undefined;
}

function describeMismatch(a: Agreement[]): string {
  const b = a.find(x => x.type === 'Bool');
  const k = a.find(x => x.type === 'Bool64bitKey');
  const kept = b?.refTrue ? Math.round((100 * b.liveTrueOfRefTrue!) / b.refTrue) : 100;
  return `The game is running, but its progress doesn't match your latest save (${kept}% of flags, ${k ? k.checked - k.agree : 0} collected objects missing). On the title screen, or a different file?`;
}
