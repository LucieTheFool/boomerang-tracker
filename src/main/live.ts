// Live source: attaches (read-only) to a running Hookshot, keeps the progress tables
// located, and reports when tracked values change. Falls back to nothing (the save
// files) whenever the game isn't running or isn't in the same playthrough.
import type { GameDataFile } from '../gamedata/parser.js';
import { locate, readTables, buildLive, fingerprint, matchesReference, LiveTables, Agreement } from '../gamedata/live.js';
import { ProcessMemory, findProcesses, initMemoryAccess } from './procmem.js';
import type { LiveInfo } from '../shared/types.js';

/** Hookshot and its fork Longshot both run the game as hookshot.exe. */
const IMAGE = 'hookshot.exe';
const TICK_MS = 500;
const FIND_EVERY_MS = 3000;
/** Where the tables were in Hookshot v2.1.0 and Longshot v1.0.0 (host addresses). Only starting points. */
const DEFAULT_HINTS = [0x1010_99f4_f418n, 0x1010_7eea_f418n];
/** The game's heap: guest 0x10_0000_0000, ~7 GB, mapped at host base 0x1000_0000_0000. */
const HEAP_LO = 0x1010_0000_0000n, HEAP_HI = 0x1011_c000_0000n;
const SWEEP_WINDOW = 64 << 20; // locate() reads twice this per step

export interface LiveOptions {
  /** Table addresses found before (hex), newest first. */
  hints: string[];
  onHint(hex: string): void;
  /** A game was attached to: the full path of its exe, if Windows gave it. */
  onGame?(exe: string | undefined): void;
  onChange(): void;
  onStatus(): void;
}

export class LiveSource {
  info: LiveInfo = { status: 'off' };
  private mem?: ProcessMemory;
  private tables?: LiveTables;
  private ref?: GameDataFile;
  private timer?: NodeJS.Timeout;
  private lastFind = 0;
  private lastPrint?: string;
  private snapshot?: { data: GameDataFile; atMs: number; resettable: Set<bigint> };
  private sweep?: bigint;
  private sweepPausedUntil = 0;
  private busy = false;
  watchInts = new Set<number>();

  constructor(private opts: LiveOptions) {}

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
  }

  private async tick() {
    if (this.busy) return;
    this.busy = true;
    try { await this.step(); } catch (e) { console.error('live', e); this.detach(); this.set({ status: 'no-game', detail: String((e as Error).message ?? e) }); }
    finally { this.busy = false; }
  }

  private async step() {
    if (this.mem && !this.mem.alive()) { this.detach(); this.set({ status: 'no-game' }); }
    if (!this.mem) {
      if (Date.now() - this.lastFind < FIND_EVERY_MS) return;
      this.lastFind = Date.now();
      const [pid] = await findProcesses(IMAGE);
      if (!pid) return this.set({ status: 'no-game' });
      this.mem = new ProcessMemory(pid);
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
    const wasLive = this.info.status === 'live';
    this.set({ status: 'live' });
    if (print !== this.lastPrint || !wasLive) {
      this.lastPrint = print;
      this.snapshot = { data: live.data, atMs: Date.now(), resettable: live.resettable };
      this.opts.onChange();
    }
  }

  /** Try the saved hints, then the defaults, then sweep the heap one window per tick. */
  private find(): boolean {
    const mem = this.mem!, ref = this.ref!;
    if (this.sweep === undefined) {
      this.set({ status: 'searching' });
      const hints = [...new Set([...this.opts.hints.map(h => BigInt('0x' + h)), ...DEFAULT_HINTS])];
      // Exact spots first (cheap), then a wider window around each.
      for (const h of hints) { const t = locate(mem, ref, h, 4 << 20); if (t) return this.found(t); }
      for (const h of hints.slice(0, 2)) {
        const t = locate(mem, ref, h, SWEEP_WINDOW);
        if (t) return this.found(t);
      }
      this.sweep = HEAP_LO + BigInt(SWEEP_WINDOW);
    }
    if (Date.now() < this.sweepPausedUntil) return false;
    const t = locate(mem, ref, this.sweep, SWEEP_WINDOW);
    if (t) return this.found(t);
    this.sweep += BigInt(SWEEP_WINDOW * 2);
    if (this.sweep >= HEAP_HI) {
      // Not found anywhere (e.g. still at the title screen). Try again in a bit.
      this.sweep = HEAP_LO + BigInt(SWEEP_WINDOW);
      this.sweepPausedUntil = Date.now() + 10_000;
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

function describeMismatch(a: Agreement[]): string {
  const b = a.find(x => x.type === 'Bool');
  const k = a.find(x => x.type === 'Bool64bitKey');
  const kept = b?.refTrue ? Math.round((100 * b.liveTrueOfRefTrue!) / b.refTrue) : 100;
  return `The game is running, but its progress doesn't match your latest save (${kept}% of flags, ${k ? k.checked - k.agree : 0} collected objects missing). On the title screen, or a different file?`;
}
