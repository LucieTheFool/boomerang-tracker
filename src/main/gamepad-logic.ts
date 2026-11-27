// Pure parts of the controller toggle: button bindings, learning a button from input reports,
// and the hold / single-press trigger. No koffi, no Electron, so they can be tested anywhere.
import type { PadState } from '../shared/types.js';

/** A button in a HID input report: pressed when report[byteIndex] & bitMask is set. */
export interface HidBinding { kind: 'hid'; vid: number; pid: number; reportId: number; byteIndex: number; bitMask: number }
/** A button of an XInput pad (any of the four slots): wButtons & xinputMask. */
export interface XInputBinding { kind: 'xinput'; xinputMask: number }
export type PadBinding = HidBinding | XInputBinding;

export type PadMode = 'hold' | 'press';
export interface PadToggleSettings { enabled: boolean; mode: PadMode; holdMs: number; binding: PadBinding | null }

export const PAD_DEFAULTS: PadToggleSettings = { enabled: true, mode: 'hold', holdMs: 500, binding: null };
export const HOLD_MIN_MS = 100;
export const HOLD_MAX_MS = 3000;
/** Single-press mode ignores a second press this soon after the last one. */
export const PRESS_DEBOUNCE_MS = 300;

export const XINPUT_LEFT_THUMB = 0x0040;

const SONY = 0x054c;
const DUALSENSE = [0x0ce6, 0x0df2]; // DualSense, DualSense Edge
const DS4 = [0x05c4, 0x09cc];

/** A HID device the reader found (what the pure helpers need to know about it). */
export interface PadDevice { vid: number; pid: number; bluetooth: boolean }

export function padName(vid: number, pid: number): string {
  if (vid === SONY && pid === 0x0df2) return 'DualSense Edge';
  if (vid === SONY && DUALSENSE.includes(pid)) return 'DualSense';
  if (vid === SONY && DS4.includes(pid)) return 'DualShock 4';
  return `Controller ${hex4(vid)}:${hex4(pid)}`;
}
const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

/** Bluetooth HID devices have the HID service class in their path: {00001124-0000-1000-8000-00805f9b34fb}. */
export const isBluetoothPath = (p: string) => /00001124-0000-1000-8000-00805f9b34fb/i.test(p);
/** Xbox pads' HID side ("IG_" in the path); XInput reads them, so the HID side is skipped. */
export const isXInputHidPath = (p: string) => /&ig_/i.test(p);

/**
 * Where the button bytes sit in each Sony report shape (byte 0 is the report id):
 * DualSense USB 0x01 and BT 0x31 carry buttons at 8–10 / 9–11; the short BT 0x01 report
 * (before anything asks for the full one) and DS4 USB/BT-short 0x01 at 5–7; DS4 BT 0x11 at 7–9.
 * Within those three bytes the layout is the same: [dpad+face, L1 R1 L2 R2 Share Options L3 R3, PS touchpad].
 */
function sonyButtonBytes(d: PadDevice, reportId: number): number | null {
  if (d.vid !== SONY) return null;
  if (DUALSENSE.includes(d.pid)) {
    if (reportId === 0x31 && d.bluetooth) return 9;
    if (reportId === 0x01) return d.bluetooth ? 5 : 8;
  }
  if (DS4.includes(d.pid)) {
    if (reportId === 0x11 && d.bluetooth) return 7;
    if (reportId === 0x01) return 5;
  }
  return null;
}
const SONY_REPORTS = [0x01, 0x11, 0x31];

/** The default binding (left stick click, L3) for a known pad, for each report shape it may send. */
export function defaultHidBindings(d: PadDevice): HidBinding[] {
  const out: HidBinding[] = [];
  for (const reportId of SONY_REPORTS) {
    const at = sonyButtonBytes(d, reportId);
    if (at !== null) out.push({ kind: 'hid', vid: d.vid, pid: d.pid, reportId, byteIndex: at + 1, bitMask: 0x40 });
  }
  return out;
}

/**
 * A learned button in every report shape the pad can send: a Bluetooth DualSense switches
 * from the short 0x01 report to 0x31 when a program asks for it, which moves the buttons.
 */
export function equivalentBindings(b: HidBinding, d: PadDevice): HidBinding[] {
  const from = sonyButtonBytes(d, b.reportId);
  if (from === null || b.byteIndex < from || b.byteIndex > from + 2) return [b];
  const out = [b];
  for (const reportId of SONY_REPORTS) {
    const at = sonyButtonBytes(d, reportId);
    if (at !== null && reportId !== b.reportId) out.push({ ...b, reportId, byteIndex: at + (b.byteIndex - from) });
  }
  return out;
}

/** The HID bindings to watch on this device: the learned one (if it's for this pad), else the default. */
export function bindingsFor(binding: PadBinding | null, d: PadDevice): HidBinding[] {
  if (!binding) return defaultHidBindings(d);
  if (binding.kind !== 'hid' || binding.vid !== d.vid || binding.pid !== d.pid) return [];
  return equivalentBindings(binding, d);
}

export function xinputMaskFor(binding: PadBinding | null): number {
  if (!binding) return XINPUT_LEFT_THUMB;
  return binding.kind === 'xinput' ? binding.xinputMask : 0;
}

/** Whether a HID report has the bound button down. Reports of other ids say nothing (null). */
export function hidPressed(bindings: HidBinding[], report: Uint8Array): boolean | null {
  let seen = false;
  for (const b of bindings) {
    if (report[0] !== b.reportId || b.byteIndex >= report.length) continue;
    seen = true;
    if (report[b.byteIndex] & b.bitMask) return true;
  }
  return seen ? false : null;
}

export const xinputPressed = (mask: number, wButtons: number) => mask !== 0 && (wButtons & mask) !== 0;

/** A short name for a binding, for Settings. */
export function bindingLabel(b: PadBinding | null): string {
  if (!b) return 'Left stick click (L3)';
  if (b.kind === 'xinput') return XINPUT_NAMES[b.xinputMask] ?? `XInput button 0x${b.xinputMask.toString(16)}`;
  const d: PadDevice = { vid: b.vid, pid: b.pid, bluetooth: false };
  const bt: PadDevice = { ...d, bluetooth: true };
  for (const dev of [d, bt]) {
    const at = sonyButtonBytes(dev, b.reportId);
    if (at !== null && b.byteIndex >= at && b.byteIndex <= at + 2) {
      const name = SONY_NAMES[b.byteIndex - at]?.[bitIndex(b.bitMask)];
      if (name) return name;
    }
  }
  return `${padName(b.vid, b.pid)} report ${b.reportId} byte ${b.byteIndex} bit 0x${b.bitMask.toString(16)}`;
}
const bitIndex = (mask: number) => Math.log2(mask) | 0;
const SONY_NAMES: (string | undefined)[][] = [
  [undefined, undefined, undefined, undefined, 'Square', 'Cross', 'Circle', 'Triangle'],
  ['L1', 'R1', 'L2', 'R2', 'Create/Share', 'Options', 'Left stick click (L3)', 'Right stick click (R3)'],
  ['PS', 'Touchpad', 'Mute'],
];
const XINPUT_NAMES: Record<number, string> = {
  0x0001: 'D-pad up', 0x0002: 'D-pad down', 0x0004: 'D-pad left', 0x0008: 'D-pad right',
  0x0010: 'Start', 0x0020: 'Back', 0x0040: 'Left stick click (LS)', 0x0080: 'Right stick click (RS)',
  0x0100: 'LB', 0x0200: 'RB', 0x1000: 'A', 0x2000: 'B', 0x4000: 'X', 0x8000: 'Y',
};

export function cleanBinding(raw: unknown): PadBinding | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const int = (x: unknown, max: number) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= max;
  const oneBit = (x: unknown, max: number) => int(x, max) && (x as number) > 0 && ((x as number) & ((x as number) - 1)) === 0;
  if (b.kind === 'xinput' && oneBit(b.xinputMask, 0xffff)) return { kind: 'xinput', xinputMask: b.xinputMask as number };
  if (b.kind === 'hid' && int(b.vid, 0xffff) && int(b.pid, 0xffff) && int(b.reportId, 0xff) && int(b.byteIndex, 0xffff) && oneBit(b.bitMask, 0x80)) {
    return { kind: 'hid', vid: b.vid as number, pid: b.pid as number, reportId: b.reportId as number, byteIndex: b.byteIndex as number, bitMask: b.bitMask as number };
  }
  return null;
}

/** settings.json's padToggle, repaired: a missing or wrong field gets its default, unknown fields are kept. */
export function cleanPadToggle(raw: unknown): PadToggleSettings {
  const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = PAD_DEFAULTS;
  const holdMs = typeof p.holdMs === 'number' && Number.isFinite(p.holdMs) ? Math.round(Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, p.holdMs))) : d.holdMs;
  return {
    ...p,
    enabled: typeof p.enabled === 'boolean' ? p.enabled : d.enabled,
    mode: p.mode === 'hold' || p.mode === 'press' ? p.mode : d.mode,
    holdMs,
    binding: cleanBinding(p.binding),
  };
}

/** What the reader knows right now (gamepad.ts sends it on every change). */
export interface PadStatus {
  supported: boolean;
  /** Why it isn't supported, or why it stopped */
  detail?: string;
  /** Connected controllers, in words */
  devices: string[];
  /** At least one of them has the button (the default or the chosen one) */
  matched: boolean;
  learning: null | { phase: 'idle' | 'press'; secondsLeft: number };
  note?: string;
}

export const NO_PADS: PadStatus = { supported: true, devices: [], matched: false, learning: null };

export function padState(cfg: PadToggleSettings, s: PadStatus): PadState {
  const base = { enabled: cfg.enabled, mode: cfg.mode, holdMs: cfg.holdMs, button: bindingLabel(cfg.binding), custom: !!cfg.binding, note: s.note };
  if (!s.supported) return { ...base, supported: false, learning: false, needsChoose: false, status: s.detail ?? 'Windows only for now' };
  let status: string;
  if (s.learning?.phase === 'idle') status = 'Hands off the controller for a second…';
  else if (s.learning) status = `Press a button on your controller (${s.learning.secondsLeft} s)…`;
  else if (!cfg.enabled) status = 'Off';
  else if (s.detail) status = s.detail;
  else if (!s.devices.length) status = 'No controller found';
  else status = `${s.devices.join(', ')} connected`;
  return { ...base, supported: true, learning: !!s.learning, needsChoose: cfg.enabled && !s.learning && s.devices.length > 0 && !s.matched, status };
}

// ---------------- Trigger ----------------

/**
 * Turns "button down/up" into "toggle now". hold: once, after the button has been down for
 * holdMs; release re-arms. press: on the press, at most once per PRESS_DEBOUNCE_MS.
 * Never fires again while the button stays down. Call update() on every report and on every
 * poll tick (a hold has to fire even when no new report arrives).
 */
export class PadTrigger {
  private down = false;
  private downAt = 0;
  private fired = false;
  private lastFire = -Infinity;
  constructor(public mode: PadMode = 'hold', public holdMs = PAD_DEFAULTS.holdMs) {}

  update(down: boolean, now: number): boolean {
    if (!down) { this.down = false; this.fired = false; return false; }
    if (!this.down) {
      this.down = true;
      this.downAt = now;
      this.fired = false;
      if (this.mode === 'press') {
        this.fired = true;
        if (now - this.lastFire < PRESS_DEBOUNCE_MS) return false;
        this.lastFire = now;
        return true;
      }
    }
    if (this.mode === 'hold' && !this.fired && now - this.downAt >= this.holdMs) { this.fired = true; return true; }
    return false;
  }

  /** Ignore the button until it has been released (after a settings change or choosing it). */
  waitForRelease() { this.down = true; this.fired = true; }
}

// ---------------- Learning a button ----------------

export const LEARN_BASELINE_MS = 1000;
/** The new bit has to stay set this long (a stick wobbling past a bit doesn't). */
export const LEARN_STABLE_MS = 80;

interface Stream {
  first: number;
  baseline: Uint8Array;
  /** Bits that changed while the pad was supposed to be idle (sticks, triggers, counters, gyro). */
  noise: Uint8Array;
  /** Per byte: the values seen (ignoring noise bits) after the baseline. Analog bytes take many. */
  values: Set<number>[];
  /** Candidate bit -> when it was first seen set */
  since: Map<string, number>;
  device: PadDevice;
}

/**
 * Learns which button the player pressed. Feed it every report for ~1 s with nothing pressed
 * (that marks the bytes that change on their own), then the press. A candidate is a single bit
 * that goes 0→1 in a byte that was quiet, only ever takes the two values (released/pressed),
 * and stays set for LEARN_STABLE_MS. On known pads only their button bytes count.
 */
export class ButtonLearner {
  private streams = new Map<string, Stream>();
  private xinputBase = new Map<number, { first: number; buttons: number; since?: number; bit?: number }>();

  /** Returns the binding once a press is recognised. `key` names the device (its path). */
  hidReport(key: string, device: PadDevice, report: Uint8Array, now: number): HidBinding | null {
    const sk = `${key}#${report[0]}`;
    let s = this.streams.get(sk);
    if (!s) {
      s = { first: now, baseline: Uint8Array.from(report), noise: new Uint8Array(report.length), values: Array.from(report, () => new Set<number>()), since: new Map(), device };
      this.streams.set(sk, s);
      return null;
    }
    const n = Math.min(report.length, s.baseline.length);
    if (now - s.first < LEARN_BASELINE_MS) {
      for (let i = 0; i < n; i++) s.noise[i] |= report[i] ^ s.baseline[i];
      return null;
    }
    const sony = sonyButtonBytes(device, report[0]);
    const found: HidBinding[] = [];
    for (let i = 1; i < n; i++) {
      if (sony !== null && (i < sony || i > sony + 2)) continue;
      const quiet = ~s.noise[i] & 0xff;
      const v = report[i] & quiet;
      s.values[i].add(v);
      const diff = (v ^ (s.baseline[i] & quiet)) & 0xff;
      const keyPrefix = `${i}:`;
      if (!diff) { for (const k of [...s.since.keys()]) if (k.startsWith(keyPrefix)) s.since.delete(k); continue; }
      // One bit, set (buttons read 1 when held). On an unknown pad the byte must also have shown
      // only two values (released/pressed): an analog axis or trigger takes many.
      const single = (diff & (diff - 1)) === 0 && (v & diff) !== 0 && (sony !== null || s.values[i].size <= 2);
      const ck = `${i}:${diff}`;
      for (const k of [...s.since.keys()]) if (k.startsWith(keyPrefix) && k !== ck) s.since.delete(k);
      if (!single) { s.since.delete(ck); continue; }
      const t = s.since.get(ck) ?? now;
      s.since.set(ck, t);
      if (now - t >= LEARN_STABLE_MS) found.push({ kind: 'hid', vid: device.vid, pid: device.pid, reportId: report[0], byteIndex: i, bitMask: diff });
    }
    // Two "buttons" at once is ambiguous (a stick nudged with the press): wait for a clean press.
    return found.length === 1 ? found[0] : null;
  }

  xinputState(slot: number, wButtons: number, now: number): XInputBinding | null {
    let s = this.xinputBase.get(slot);
    if (!s) { this.xinputBase.set(slot, { first: now, buttons: wButtons }); return null; }
    if (now - s.first < LEARN_BASELINE_MS) { s.buttons = wButtons; return null; }
    const diff = wButtons & ~s.buttons & 0xffff;
    if (!diff || (diff & (diff - 1)) !== 0) { s.since = undefined; s.bit = undefined; return null; }
    if (s.bit !== diff) { s.bit = diff; s.since = now; }
    return now - (s.since ?? now) >= LEARN_STABLE_MS ? { kind: 'xinput', xinputMask: diff } : null;
  }
}
