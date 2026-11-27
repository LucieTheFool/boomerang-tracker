// Controller buttons for the overlay toggle (Windows, through koffi). Read in the main process,
// so it works while the game has focus and the tracker's windows are hidden.
//
// STRICTLY READ-ONLY toward the controller, in the same spirit as the tracker's memory rule:
// - devices are opened for reading only (GENERIC_READ, or no access at all just to look at
//   them), shared with FILE_SHARE_READ | FILE_SHARE_WRITE so the game keeps its own access;
// - only input reports are read (ReadFile). Nothing is ever sent to a device: no output reports,
//   no HidD_SetFeature / HidD_SetOutputReport, and no HidD_GetFeature either: on a Bluetooth
//   DualSense, reading feature report 0x05 switches it to the full 0x31 report mode, which
//   changes what the game sees;
// - XInput pads are only polled (XInputGetState), never XInputSetState.
//
// Reads are overlapped and polled (never waited on), so the main thread never blocks. With no
// controller connected, the only work is a device list every ENUM_MS.
import {
  ButtonLearner, LEARN_BASELINE_MS, NO_PADS, PadTrigger,
  bindingLabel, bindingsFor, hidPressed, isBluetoothPath, isXInputHidPath, padName, xinputMaskFor, xinputPressed,
  type HidBinding, type PadBinding, type PadDevice, type PadStatus, type PadToggleSettings,
} from './gamepad-logic.js';

const ENUM_MS = 3000;
const POLL_MS = 15;
const LEARN_MS = 10_000;

const DIGCF_PRESENT = 0x02;
const DIGCF_DEVICEINTERFACE = 0x10;
const GENERIC_READ = 0x80000000;
const FILE_SHARE_READ_WRITE = 0x01 | 0x02;
const OPEN_EXISTING = 3;
const FILE_FLAG_OVERLAPPED = 0x40000000;
const ERROR_IO_PENDING = 997;
const STATUS_PENDING = 0x103n;
const HIDP_STATUS_SUCCESS = 0x00110000;

type Fn = (...args: unknown[]) => unknown;
interface Api {
  CreateFileW: Fn; ReadFile: Fn; GetOverlappedResult: Fn; CancelIoEx: Fn; CloseHandle: Fn; GetLastError: Fn;
  HidD_GetHidGuid: Fn; HidD_GetAttributes: Fn; HidD_GetPreparsedData: Fn; HidD_FreePreparsedData: Fn; HidP_GetCaps: Fn; HidD_GetProductString: Fn;
  SetupDiGetClassDevsW: Fn; SetupDiEnumDeviceInterfaces: Fn; SetupDiGetDeviceInterfaceDetailW: Fn; SetupDiDestroyDeviceInfoList: Fn;
  XInputGetState?: Fn;
}
let api: Api | null | undefined;
let apiProblem = '';

/** Load koffi and the Windows functions once. False (with padProblem()) when unavailable. */
export async function initPadAccess(): Promise<boolean> {
  if (api !== undefined) return !!api;
  if (process.platform !== 'win32') { apiProblem = 'Windows only for now'; return !!(api = null); }
  try {
    const mod = await import('koffi');
    api = bind((mod as { default?: unknown }).default ?? mod);
  } catch (e) {
    apiProblem = `Controller support couldn't start (${e instanceof Error ? e.message : String(e)})`;
    api = null;
  }
  return !!api;
}
export const padProblem = () => apiProblem;

// Handles are intptr_t so INVALID_HANDLE_VALUE (-1) can be told apart. Buffers are passed as
// void *: koffi hands the OS the Buffer's own memory, which overlapped reads need.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bind(koffi: any): Api {
  const k32 = koffi.load('kernel32.dll');
  const hid = koffi.load('hid.dll');
  const setup = koffi.load('setupapi.dll');
  let xinput: { func: (sig: string) => Fn } | undefined;
  for (const dll of ['xinput1_4.dll', 'xinput9_1_0.dll']) { try { xinput = koffi.load(dll); break; } catch { /* next */ } }
  return {
    CreateFileW: k32.func('intptr_t __stdcall CreateFileW(void *name, uint32_t access, uint32_t share, void *sa, uint32_t disposition, uint32_t flags, intptr_t tmpl)'),
    ReadFile: k32.func('int __stdcall ReadFile(intptr_t h, void *buf, uint32_t len, void *read, void *ov)'),
    GetOverlappedResult: k32.func('int __stdcall GetOverlappedResult(intptr_t h, void *ov, _Out_ uint32_t *n, int wait)'),
    CancelIoEx: k32.func('int __stdcall CancelIoEx(intptr_t h, void *ov)'),
    CloseHandle: k32.func('int __stdcall CloseHandle(intptr_t h)'),
    GetLastError: k32.func('uint32_t __stdcall GetLastError()'),
    HidD_GetHidGuid: hid.func('void __stdcall HidD_GetHidGuid(void *guid)'),
    HidD_GetAttributes: hid.func('int __stdcall HidD_GetAttributes(intptr_t h, void *attrs)'),
    HidD_GetPreparsedData: hid.func('int __stdcall HidD_GetPreparsedData(intptr_t h, _Out_ intptr_t *pp)'),
    HidD_FreePreparsedData: hid.func('int __stdcall HidD_FreePreparsedData(intptr_t pp)'),
    HidP_GetCaps: hid.func('int32_t __stdcall HidP_GetCaps(intptr_t pp, void *caps)'),
    HidD_GetProductString: hid.func('int __stdcall HidD_GetProductString(intptr_t h, void *buf, uint32_t len)'),
    SetupDiGetClassDevsW: setup.func('intptr_t __stdcall SetupDiGetClassDevsW(void *guid, void *enumerator, intptr_t hwnd, uint32_t flags)'),
    SetupDiEnumDeviceInterfaces: setup.func('int __stdcall SetupDiEnumDeviceInterfaces(intptr_t set, void *devinfo, void *guid, uint32_t index, void *data)'),
    SetupDiGetDeviceInterfaceDetailW: setup.func('int __stdcall SetupDiGetDeviceInterfaceDetailW(intptr_t set, void *data, void *detail, uint32_t size, void *required, void *devinfo)'),
    SetupDiDestroyDeviceInfoList: setup.func('int __stdcall SetupDiDestroyDeviceInfoList(intptr_t set)'),
    XInputGetState: xinput?.func('uint32_t __stdcall XInputGetState(uint32_t index, void *state)'),
  };
}

const A = () => { if (!api) throw new Error('controller access not initialised'); return api; };
type Handle = number | bigint;
const bad = (h: unknown) => h === null || h === undefined || Number(h) === -1 || Number(h) === 0;
const wide = (s: string) => Buffer.from(s + '\0', 'utf16le');

/** Device interface paths of every present HID device. */
export function hidPaths(): string[] {
  const a = A();
  const guid = Buffer.alloc(16);
  a.HidD_GetHidGuid(guid);
  const set = a.SetupDiGetClassDevsW(guid, null, 0, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
  if (bad(set)) return [];
  const out: string[] = [];
  try {
    const data = Buffer.alloc(32); // SP_DEVICE_INTERFACE_DATA
    const detail = Buffer.alloc(4 + 2 * 1024); // SP_DEVICE_INTERFACE_DETAIL_DATA_W
    for (let i = 0; i < 512; i++) {
      data.fill(0); data.writeUInt32LE(32, 0);
      if (!a.SetupDiEnumDeviceInterfaces(set, null, guid, i, data)) break;
      detail.fill(0); detail.writeUInt32LE(8, 0); // cbSize of the fixed part on x64
      if (!a.SetupDiGetDeviceInterfaceDetailW(set, data, detail, detail.length, null, null)) continue;
      let end = 4;
      while (end + 1 < detail.length && detail.readUInt16LE(end) !== 0) end += 2;
      out.push(detail.toString('utf16le', 4, end));
    }
  } finally {
    a.SetupDiDestroyDeviceInfoList(set);
  }
  return out;
}

export interface HidInfo extends PadDevice { path: string; usagePage: number; usage: number; reportLen: number; xinput: boolean }

/** Looks at a HID device without reading from it: opened with no access rights at all. */
export function describeHid(path: string): HidInfo | null {
  const a = A();
  const h = a.CreateFileW(wide(path), 0, FILE_SHARE_READ_WRITE, null, OPEN_EXISTING, 0, 0) as Handle;
  if (bad(h)) return null;
  try {
    const attrs = Buffer.alloc(16); // HIDD_ATTRIBUTES
    attrs.writeUInt32LE(12, 0);
    if (!a.HidD_GetAttributes(h, attrs)) return null;
    const pp: Handle[] = [0];
    if (!a.HidD_GetPreparsedData(h, pp)) return null;
    const caps = Buffer.alloc(64); // HIDP_CAPS
    let st: unknown;
    try { st = a.HidP_GetCaps(pp[0], caps); } finally { a.HidD_FreePreparsedData(pp[0]); }
    if (st !== HIDP_STATUS_SUCCESS) return null;
    return {
      path, vid: attrs.readUInt16LE(4), pid: attrs.readUInt16LE(6), bluetooth: isBluetoothPath(path), xinput: isXInputHidPath(path),
      usage: caps.readUInt16LE(0), usagePage: caps.readUInt16LE(2), reportLen: caps.readUInt16LE(4),
    };
  } finally {
    a.CloseHandle(h);
  }
}

/** Generic Desktop page, Joystick or Game Pad. */
export const isGameController = (i: HidInfo) => i.usagePage === 0x01 && (i.usage === 0x04 || i.usage === 0x05);

/** The device's product name (a string descriptor: read-only). For the probe; may take a moment on Bluetooth. */
export function productString(path: string): string | undefined {
  const a = A();
  const h = a.CreateFileW(wide(path), 0, FILE_SHARE_READ_WRITE, null, OPEN_EXISTING, 0, 0) as Handle;
  if (bad(h)) return undefined;
  try {
    const buf = Buffer.alloc(512);
    if (!a.HidD_GetProductString(h, buf, buf.length)) return undefined;
    let end = 0;
    while (end + 1 < buf.length && buf.readUInt16LE(end) !== 0) end += 2;
    return buf.toString('utf16le', 0, end) || undefined;
  } finally {
    a.CloseHandle(h);
  }
}

// Buffers of closed readers stay referenced for a while: a cancelled read may still be
// finishing in the kernel, and it must never write into freed memory.
const retired: Buffer[] = [];

/** Input reports of one HID device, read with overlapped I/O and never waited on. */
export class HidReader {
  private h: Handle;
  // OVERLAPPED in its own buffer, larger than V8 keeps on its heap, so its address can't move.
  private ov = Buffer.alloc(128);
  private buf: Buffer;
  private pending = false;
  constructor(readonly info: HidInfo) {
    const a = A();
    this.h = a.CreateFileW(wide(info.path), GENERIC_READ, FILE_SHARE_READ_WRITE, null, OPEN_EXISTING, FILE_FLAG_OVERLAPPED, 0) as Handle;
    if (bad(this.h)) throw new Error(`couldn't open for reading (error ${a.GetLastError()})`);
    // Room for several reports: the HID driver hands over as many as fit.
    this.buf = Buffer.alloc(Math.max(64, info.reportLen) * 16);
  }

  /** The reports that arrived since the last call. Throws when the device is gone. */
  drain(max = 32): Uint8Array[] {
    const a = A();
    const out: Uint8Array[] = [];
    for (let k = 0; k < max; k++) {
      if (this.pending) {
        if (this.ov.readBigUInt64LE(0) === STATUS_PENDING) break; // HasOverlappedIoCompleted
        this.pending = false;
        this.collect(out);
        continue;
      }
      this.ov.fill(0);
      if (a.ReadFile(this.h, this.buf, this.buf.length, null, this.ov)) { this.collect(out); continue; }
      const err = a.GetLastError();
      // ReadFile marks the request pending before it starts, so this also holds if the error
      // code got lost. (A device that's gone for good drops out of the next listing.)
      if (err === ERROR_IO_PENDING || this.ov.readBigUInt64LE(0) === STATUS_PENDING) { this.pending = true; break; }
      throw new Error(`read failed (error ${err})`);
    }
    return out;
  }

  private collect(out: Uint8Array[]) {
    const n = [0];
    if (!A().GetOverlappedResult(this.h, this.ov, n, 0)) throw new Error(`read failed (error ${A().GetLastError()})`);
    const len = this.info.reportLen || n[0];
    for (let off = 0; off < n[0]; off += len) out.push(Uint8Array.from(this.buf.subarray(off, Math.min(n[0], off + len))));
  }

  close() {
    if (bad(this.h)) return;
    const a = A();
    if (this.pending) a.CancelIoEx(this.h, this.ov);
    a.CloseHandle(this.h);
    this.h = -1;
    retired.push(this.ov, this.buf);
    while (retired.length > 32) retired.shift();
  }
}

/** wButtons of an XInput pad, or null when that slot has none. */
export function xinputButtons(slot: number): number | null {
  const a = A();
  if (!a.XInputGetState) return null;
  const state = Buffer.alloc(16); // XINPUT_STATE
  return a.XInputGetState(slot, state) === 0 ? state.readUInt16LE(4) : null;
}

// ---------------- Watcher ----------------

export interface PadEvents {
  /** The bound button was pressed (or held): show/hide the overlay. */
  fire(): void;
  status(s: PadStatus): void;
  /** "Choose button…" recognised a press. */
  learned(b: PadBinding): void;
}

interface OpenPad { reader: HidReader; info: HidInfo; bindings: HidBinding[]; down: boolean }

/**
 * Watches controllers while the toggle is on (or a button is being chosen): lists HID game
 * controllers and XInput slots every ENUM_MS, reads them every POLL_MS while any is connected.
 */
export class PadWatcher {
  private cfg!: PadToggleSettings;
  private running = false;
  private starting = false;
  private timer?: NodeJS.Timeout;
  private pads = new Map<string, OpenPad>();
  /** HID devices that aren't game controllers (keyboards, mice, headsets…): not looked at again. */
  private ignored = new Set<string>();
  /** Controllers that couldn't be opened (logged once). */
  private failed = new Set<string>();
  private xslots = new Map<number, { down: boolean }>();
  private nextEnum = 0;
  private trigger = new PadTrigger();
  private learning?: { learner: ButtonLearner; start: number };
  private note?: string;
  private detail?: string;
  private last = '';

  constructor(cfg: PadToggleSettings, private ev: PadEvents) { this.apply(cfg); }

  /** New settings: re-reads the binding and mode, starts or stops reading. */
  apply(cfg: PadToggleSettings) {
    this.cfg = cfg;
    this.trigger.mode = cfg.mode;
    this.trigger.holdMs = cfg.holdMs;
    this.trigger.waitForRelease(); // e.g. the button just chosen is still held
    for (const p of this.pads.values()) { p.bindings = bindingsFor(cfg.binding, p.info); p.down = false; }
    void this.sync();
  }

  /** "Choose button…": a second hands off, then up to LEARN_MS for the press. */
  learn() {
    this.learning = { learner: new ButtonLearner(), start: performance.now() };
    this.note = undefined;
    this.trigger.waitForRelease();
    void this.sync();
  }

  cancelLearn() {
    if (!this.learning) return;
    this.learning = undefined;
    void this.sync();
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.running = false;
    for (const path of [...this.pads.keys()]) this.drop(path, false);
    this.xslots.clear();
  }

  private async sync() {
    const wanted = this.cfg.enabled || !!this.learning;
    if (wanted && !this.running && !this.starting) {
      this.starting = true;
      const ok = await initPadAccess();
      this.starting = false;
      if (!ok) { this.learning = undefined; this.publish(); return; }
      if (!(this.cfg.enabled || this.learning)) { this.publish(); return; }
      this.running = true;
      this.nextEnum = 0;
      this.tick();
      return;
    }
    if (!wanted && this.running) this.stop();
    this.publish();
  }

  private tick = () => {
    this.timer = undefined;
    if (!this.running) return;
    const now = performance.now();
    try {
      if (now >= this.nextEnum) { this.enumerate(); this.nextEnum = now + ENUM_MS; this.detail = undefined; }
      this.poll(now);
    } catch (e) {
      // Never take the tracker down: say so, and try again from scratch at the next listing.
      this.detail = `Controller reading stopped (${e instanceof Error ? e.message : String(e)})`;
      console.error('[pad]', this.detail);
      for (const path of [...this.pads.keys()]) this.drop(path, false);
      this.nextEnum = now + ENUM_MS;
    }
    this.publish();
    if (!this.running) return;
    const busy = this.pads.size > 0 || this.xslots.size > 0 || !!this.learning;
    this.timer = setTimeout(this.tick, busy ? POLL_MS : Math.max(POLL_MS, this.nextEnum - performance.now()));
  };

  private poll(now: number) {
    const learner = this.learning?.learner;
    let down = false;
    for (const [path, p] of this.pads) {
      let reports: Uint8Array[];
      try { reports = p.reader.drain(); } catch (e) {
        this.drop(path, true, e instanceof Error ? e.message : String(e));
        this.nextEnum = Math.min(this.nextEnum, now + 1000);
        continue;
      }
      for (const r of reports) {
        const b = learner?.hidReport(path, p.info, r, now);
        if (b) return this.learned(b);
        const pressed = hidPressed(p.bindings, r);
        if (pressed !== null) p.down = pressed;
      }
      down ||= p.down;
    }
    const mask = xinputMaskFor(this.cfg.binding);
    for (const [slot, x] of this.xslots) {
      const buttons = xinputButtons(slot);
      if (buttons === null) { this.xslots.delete(slot); console.log('[pad] disconnected: Xbox controller', slot + 1); continue; }
      const b = learner?.xinputState(slot, buttons, now);
      if (b) return this.learned(b);
      x.down = xinputPressed(mask, buttons);
      down ||= x.down;
    }
    if (this.learning) {
      if (now - this.learning.start >= LEARN_BASELINE_MS + LEARN_MS) {
        this.learning = undefined;
        this.note = 'No button press seen. Try again.';
        console.log('[pad] choose button: timed out');
        if (!this.cfg.enabled) this.stop();
      }
    } else if (this.trigger.update(down, now)) {
      console.log('[pad] toggle overlay');
      this.ev.fire();
    }
  }

  private learned(b: PadBinding) {
    this.learning = undefined;
    this.note = `Chosen: ${bindingLabel(b)}`;
    console.log('[pad] button learned:', JSON.stringify(b));
    this.ev.learned(b); // main saves it and calls apply()
  }

  private enumerate() {
    const paths = new Set(hidPaths());
    for (const path of [...this.pads.keys()]) if (!paths.has(path)) this.drop(path, true);
    for (const set of [this.ignored, this.failed]) for (const path of set) if (!paths.has(path)) set.delete(path);
    for (const path of paths) {
      if (this.pads.has(path) || this.ignored.has(path)) continue;
      const info = describeHid(path);
      if (!info) continue; // may be waking up: look again next time
      if (!isGameController(info) || info.xinput) { this.ignored.add(path); continue; } // XInput reads Xbox pads
      try {
        const reader = new HidReader(info);
        this.failed.delete(path);
        this.pads.set(path, { reader, info, bindings: bindingsFor(this.cfg.binding, info), down: false });
        console.log('[pad] connected:', describe(info));
      } catch (e) {
        if (!this.failed.has(path)) console.log('[pad] can\'t read', describe(info), '-', e instanceof Error ? e.message : String(e));
        this.failed.add(path);
      }
    }
    // Asking an empty XInput slot is slow-ish, so empty slots are only checked here.
    for (let slot = 0; slot < 4; slot++) {
      if (this.xslots.has(slot) || xinputButtons(slot) === null) continue;
      this.xslots.set(slot, { down: false });
      console.log('[pad] connected: Xbox controller', slot + 1);
    }
  }

  private drop(path: string, log: boolean, why?: string) {
    const p = this.pads.get(path);
    if (!p) return;
    try { p.reader.close(); } catch { /* already gone */ }
    this.pads.delete(path);
    if (log) console.log('[pad] disconnected:', describe(p.info), why ? `(${why})` : '');
  }

  private publish() {
    const xinputOk = xinputMaskFor(this.cfg.binding) !== 0;
    const s: PadStatus = api === null
      ? { ...NO_PADS, supported: false, detail: padProblem() }
      : {
          supported: true,
          detail: this.detail,
          devices: [...[...this.pads.values()].map(p => padName(p.info.vid, p.info.pid)), ...[...this.xslots.keys()].map(() => 'Xbox controller')],
          matched: [...this.pads.values()].some(p => p.bindings.length > 0) || (this.xslots.size > 0 && xinputOk),
          learning: this.learning ? learnPhase(this.learning.start) : null,
          note: this.note,
        };
    const key = JSON.stringify(s);
    if (key === this.last) return;
    this.last = key;
    this.ev.status(s);
  }
}

function learnPhase(start: number): PadStatus['learning'] {
  const t = performance.now() - start;
  if (t < LEARN_BASELINE_MS) return { phase: 'idle', secondsLeft: Math.ceil(LEARN_MS / 1000) };
  return { phase: 'press', secondsLeft: Math.max(0, Math.ceil((LEARN_BASELINE_MS + LEARN_MS - t) / 1000)) };
}

const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
const describe = (i: HidInfo) => `${padName(i.vid, i.pid)} ${hex4(i.vid)}:${hex4(i.pid)} (${i.bluetooth ? 'Bluetooth' : 'USB'})`;
