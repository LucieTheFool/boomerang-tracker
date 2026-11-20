// Live source: attaches (read-only) to a running game (Hookshot, Longshot, NX2navi, ReLink,
// Rekarina or the Fritchii emulator), keeps the progress tables located, and reports when
// tracked values change. Falls back to nothing (the save files) whenever the game isn't
// running or isn't in the same playthrough.
import type { GameDataFile } from '../gamedata/parser.js';
import { locate, readTables, buildLive, fingerprint, matchesReference, sweepRanges, type LiveTables, type Agreement, type Mem, type MemLayout } from '../gamedata/live.js';
import { ProcessMemory, findProcesses, initMemoryAccess, type MemRegion } from './procmem.js';
import type { LiveInfo } from '../shared/types.js';

export interface GameInfo {
  image: string;
  /** An emulator: the game's memory moves every run; swept through its mapped views. */
  emulator?: boolean;
  /** Where things are, when it isn't the recomps' layout (RECOMP_LAYOUT). */
  layout?: MemLayout;
  /** No fixed place known: sweep the committed, readable blocks in [lo, hi) (host addresses). */
  heap?: readonly [bigint, bigint];
}

/**
 * Rekarina 1.2.1 maps guest memory at the same addresses (guest 0 = host 0), with the
 * game's code at 0x70_0000_0000, so the tables' vtables are 0x70xxxxxxxx. The tables are
 * in the heap between 4 GB and the code; there is no fixed place to try first.
 */
const REKARINA: Pick<GameInfo, 'layout' | 'heap'> = {
  layout: { guestBase: 0n, vtables: [0x70_0000_0000n, 0x80_0000_0000n] },
  heap: [0x1_0000_0000n, 0x70_0000_0000n],
};

/**
 * Programs that run the game. Hookshot and its fork Longshot run it as hookshot.exe;
 * NX2navi builds it as Triforce.exe and Project ReLink as bin\relink-game.exe. They map the game
 * at a fixed place. Rekarina (game\Rekarina.exe; its helper rekarina_xlate.exe is not the
 * game) keeps the tables somewhere in its heap, found by sweeping it. The Fritchii
 * emulator (lichii.exe) puts it somewhere new every run, so it's found by sweeping.
 */
export const GAMES: GameInfo[] = [
  { image: 'hookshot.exe' }, { image: 'Triforce.exe' }, { image: 'relink-game.exe' }, { image: 'lichii.exe', emulator: true },
  { image: 'Rekarina.exe', ...REKARINA },
];
/**
 * Why live tracking can't run on this system, or undefined where it can (Windows). Elsewhere
 * nothing is tried: no process list, no memory access library.
 */
export function liveUnavailableReason(platform: NodeJS.Platform = process.platform): string | undefined {
  if (platform === 'win32') return undefined;
  const where = platform === 'linux' ? 'on Linux yet' : 'on this system';
  return `Live tracking isn't available ${where}. The tracker follows your save files and updates each time the game saves.`;
}

const TICK_MS = 500;
const FIND_EVERY_MS = 3000;
/** While attached but not live, how often to tell the app again which game it is (onGame). */
const FOLLOW_EVERY_MS = 5000;
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
/** A heap sweep (GameInfo.heap) joins blocks closer than this and skips smaller ones. */
const HEAP_JOIN_GAP = 8n << 20n, HEAP_MIN_BLOCK = 1n << 20n;

/** One step of a sweep: locate() around `at`, `half` bytes either side. */
export interface SweepWindow { at: bigint; half: number }

/**
 * The windows to sweep `ranges` with, in order. A range longer than one window is stepped
 * through (overlapping a little); with `fit`, a shorter one gets a single window of its own
 * size (Rekarina's heap is many blocks: reading 128 MB around each would be slow).
 */
export function sweepWindows(ranges: [bigint, bigint][], fit = false): SweepWindow[] {
  const out: SweepWindow[] = [];
  const W = BigInt(SWEEP_WINDOW);
  for (const [lo, hi] of ranges) {
    if (fit && hi - lo <= 2n * W) { const half = (hi - lo + 1n) / 2n; out.push({ at: lo + half, half: Number(half) }); continue; }
    for (let at = lo + W; at - W < hi; at += SWEEP_STEP) out.push({ at, half: SWEEP_WINDOW });
  }
  return out;
}

/**
 * Reads that only touch the given committed blocks (sorted by address): a read that fails
 * as a whole is put together from the parts inside the blocks, the rest left zero. A sweep
 * window then still sees tables next to a hole in Rekarina's heap. null if none of it is readable.
 */
export function committedReader(mem: Mem, blocks: MemRegion[]): Mem {
  const sorted = [...blocks].sort((a, b) => (a.base < b.base ? -1 : a.base > b.base ? 1 : 0));
  return {
    read(addr, len) {
      const whole = mem.read(addr, len);
      if (whole) return whole;
      const end = addr + BigInt(len);
      const out = Buffer.alloc(len);
      let any = false;
      for (const r of sorted) {
        if (r.base >= end) break;
        const lo = r.base > addr ? r.base : addr, hi = r.base + r.size < end ? r.base + r.size : end;
        if (hi <= lo) continue;
        const b = mem.read(lo, Number(hi - lo));
        if (b) { b.copy(out, Number(lo - addr)); any = true; }
      }
      return any ? out : null;
    },
  };
}

/** What the live source needs from an opened game (read-only). */
export type LiveMem = Pick<ProcessMemory, 'read' | 'imagePath' | 'regions' | 'alive' | 'close'>;

export interface LiveOptions {
  /** Table addresses found before (hex), newest first. */
  hints: string[];
  onHint(hex: string): void;
  /**
   * A game is attached: the full path of its exe, if Windows gave it, and which attach this
   * is (a new number each time a game is attached). Called on attach, then every
   * FOLLOW_EVERY_MS for as long as it isn't live, so the app can follow the game's saves.
   */
  onGame?(exe: string | undefined, attach: number): void;
  onChange(): void;
  onStatus(): void;
  /** Tests: find and open the game without Windows (defaults: tasklist + ProcessMemory). */
  findGame?: () => Promise<(GameInfo & { pid: number }) | undefined>;
  open?: (pid: number) => LiveMem;
  now?: () => number;
  /** Tests: the system to act as (default: this one). */
  platform?: NodeJS.Platform;
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
  private game?: GameInfo;
  /** The current attach: its number, the exe path once Windows gave it, when onGame was last called. */
  private attach?: { id: number; exe?: string; lastFollow: number };
  private attaches = 0;
  /** Where the sweep is: the windows to search, the next one, and how to read memory for it. */
  private sweep?: { windows: SweepWindow[]; i: number; reader: Mem };
  private sweepPausedUntil = 0;
  private busy = false;
  private lastError?: string;
  private readonly now: () => number;
  watchInts = new Set<number>();

  constructor(private opts: LiveOptions) { this.now = opts.now ?? Date.now; }

  async start() {
    const off = liveUnavailableReason(this.opts.platform);
    if (off) return this.set({ status: 'unavailable', detail: off });
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

  /** The tables found (also while they don't match the save), for scripts/live-check.ts. */
  located() { return this.tables; }

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
    this.attach = undefined;
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
      this.game = game;
      this.attach = { id: ++this.attaches, lastFollow: -Infinity };
    }
    // Following the game's saves can fail for a moment (no exe path yet, Rekarina swapping a
    // save in): keep offering until live.
    if (this.info.status !== 'live') this.follow();
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
   * heap, an emulator's mapped memory (biggest blocks first), or Rekarina's heap blocks.
   */
  private find(): boolean {
    const mem = this.mem!, ref = this.ref!, game = this.game!;
    if (this.now() < this.sweepPausedUntil) return false;
    if (this.sweep === undefined) {
      // After a full sweep found nothing, stay "waiting" rather than flicker back.
      if (this.info.status !== 'waiting') this.set({ status: 'searching' });
      // A heap sweep reads around the holes between the committed blocks.
      const blocks = game.heap ? mem.regions() : [];
      const reader = game.heap ? committedReader(mem, blocks) : mem;
      const hints = [...new Set([...this.opts.hints.map(h => BigInt('0x' + h)), ...DEFAULT_HINTS])];
      // Exact spots first (cheap), then a wider window around each. An emulator's memory
      // moves every run, so only a tracker restart during the same run hits a hint there.
      for (const h of hints) { const t = locate(reader, ref, h, 4 << 20, game.layout); if (t) return this.found(t); }
      if (!game.emulator) for (const h of hints.slice(0, 2)) {
        const t = locate(reader, ref, h, SWEEP_WINDOW, game.layout);
        if (t) return this.found(t);
      }
      const ranges: [bigint, bigint][] = game.heap
        ? sweepRanges(blocks, { within: game.heap, anyType: true, joinGap: HEAP_JOIN_GAP, minSize: HEAP_MIN_BLOCK })
        : game.emulator ? sweepRanges(mem.regions()) : [[HEAP_LO, HEAP_HI]];
      this.sweep = { windows: sweepWindows(ranges, !!game.heap), i: 0, reader };
    }
    const s = this.sweep;
    // One full window per tick; a heap sweep's smaller windows share that much reading.
    for (let budget = SWEEP_WINDOW * 2; budget > 0 && s.i < s.windows.length;) {
      const w = s.windows[s.i++];
      const t = locate(s.reader, ref, w.at, w.half, game.layout);
      if (t) return this.found(t);
      budget -= w.half * 2;
    }
    if (s.i >= s.windows.length) {
      // Not found anywhere (e.g. still at the title screen). Try again in a bit.
      this.sweep = undefined;
      this.sweepPausedUntil = this.now() + 10_000;
      this.set({ status: 'waiting', detail: "Couldn't find the progress tables yet. Load your file in the game." });
    }
    return false;
  }

  /** onGame, at most every FOLLOW_EVERY_MS. Asks Windows for the exe path until it gives it. */
  private follow() {
    const a = this.attach!;
    if (this.now() - a.lastFollow < FOLLOW_EVERY_MS) return;
    a.lastFollow = this.now();
    a.exe ??= this.mem!.imagePath();
    this.opts.onGame?.(a.exe, a.id);
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
export async function findGame(strict = false, games = GAMES): Promise<(GameInfo & { pid: number }) | undefined> {
  for (const g of games) {
    const [pid] = await findProcesses(g.image, strict);
    if (pid) return { ...g, pid };
  }
  return undefined;
}

function describeMismatch(a: Agreement[]): string {
  const b = a.find(x => x.type === 'Bool');
  const k = a.find(x => x.type === 'Bool64bitKey');
  const kept = b?.refTrue ? Math.round((100 * b.liveTrueOfRefTrue!) / b.refTrue) : 100;
  return `The game is running, but its progress doesn't match your latest save (${kept}% of flags, ${k ? k.checked - k.agree : 0} collected objects missing). On the title screen, or a different file?`;
}
