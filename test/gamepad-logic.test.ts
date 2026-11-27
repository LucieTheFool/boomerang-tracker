import { describe, it, expect } from 'vitest';
import {
  ButtonLearner, LEARN_BASELINE_MS, NO_PADS, PAD_DEFAULTS, PRESS_DEBOUNCE_MS, PadTrigger, XINPUT_LEFT_THUMB,
  bindingLabel, bindingsFor, cleanBinding, cleanPadToggle, defaultHidBindings, equivalentBindings, hidPressed, padState,
  isBluetoothPath, isXInputHidPath, xinputMaskFor, xinputPressed,
  type HidBinding, type PadDevice,
} from '../src/main/gamepad-logic';

const DS_USB: PadDevice = { vid: 0x054c, pid: 0x0ce6, bluetooth: false };
const DS_BT: PadDevice = { vid: 0x054c, pid: 0x0ce6, bluetooth: true };
const DS4_BT: PadDevice = { vid: 0x054c, pid: 0x09cc, bluetooth: true };
const OTHER: PadDevice = { vid: 0x1234, pid: 0x5678, bluetooth: false };

/** Report shapes as Windows hands them over: byte 0 = report id, padded to the device's longest report. */
function dsUsb(l3 = false) { const r = new Uint8Array(64); r.set([0x01, 0x80, 0x80, 0x80, 0x80, 0, 0, 0, 0x08, l3 ? 0x40 : 0, 0]); return r; }
function dsBtFull(l3 = false) { const r = new Uint8Array(78); r.set([0x31, 0x10, 0x80, 0x80, 0x80, 0x80, 0, 0, 0, 0x08, l3 ? 0x40 : 0, 0]); return r; }
function dsBtShort(l3 = false) { const r = new Uint8Array(78); r.set([0x01, 0x80, 0x80, 0x80, 0x80, 0x08, l3 ? 0x40 : 0, 0, 0, 0]); return r; }

describe('paths', () => {
  it('tells Bluetooth HID and XInput HID devices apart', () => {
    expect(isBluetoothPath('\\\\?\\hid#{00001124-0000-1000-8000-00805f9b34fb}_vid&0002054c_pid&0ce6#9&2d&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}')).toBe(true);
    expect(isBluetoothPath('\\\\?\\hid#vid_054c&pid_0ce6&mi_03#8&1&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}')).toBe(false);
    expect(isXInputHidPath('\\\\?\\hid#vid_045e&pid_0b12&ig_00#9&1&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}')).toBe(true);
    expect(isXInputHidPath('\\\\?\\hid#vid_054c&pid_0ce6&mi_03#8&1&0&0000#{x}')).toBe(false);
  });
});

describe('DualSense default (L3)', () => {
  it('USB: report 0x01 byte 9 bit 0x40', () => {
    const b = defaultHidBindings(DS_USB);
    expect(b).toEqual([{ kind: 'hid', vid: 0x054c, pid: 0x0ce6, reportId: 0x01, byteIndex: 9, bitMask: 0x40 }]);
    expect(hidPressed(b, dsUsb(true))).toBe(true);
    expect(hidPressed(b, dsUsb(false))).toBe(false);
  });
  it('Bluetooth: short 0x01 byte 6 and full 0x31 byte 10', () => {
    const b = defaultHidBindings(DS_BT);
    expect(b.map(x => [x.reportId, x.byteIndex, x.bitMask])).toEqual([[0x01, 6, 0x40], [0x31, 10, 0x40]]);
    expect(hidPressed(b, dsBtShort(true))).toBe(true);
    expect(hidPressed(b, dsBtShort(false))).toBe(false);
    expect(hidPressed(b, dsBtFull(true))).toBe(true);
    expect(hidPressed(b, dsBtFull(false))).toBe(false);
  });
  it('a USB report does not trip the Bluetooth layout (byte 6 is a trigger there)', () => {
    const r = dsUsb(false); r[6] = 0xff;
    expect(hidPressed(defaultHidBindings(DS_USB), r)).toBe(false);
  });
  it('reports of another id say nothing', () => {
    const r = new Uint8Array(78); r[0] = 0x05; r[6] = 0x40;
    expect(hidPressed(defaultHidBindings(DS_BT), r)).toBeNull();
  });
  it('DualShock 4: 0x01 byte 6, Bluetooth 0x11 byte 8', () => {
    expect(defaultHidBindings(DS4_BT).map(x => [x.reportId, x.byteIndex])).toEqual([[0x01, 6], [0x11, 8]]);
  });
  it('no default for an unknown pad', () => expect(defaultHidBindings(OTHER)).toEqual([]));
});

describe('bindings', () => {
  const learnedShort: HidBinding = { kind: 'hid', vid: 0x054c, pid: 0x0ce6, reportId: 0x01, byteIndex: 6, bitMask: 0x01 }; // L1, short BT report
  it('a button learned from the short BT report still works once the pad sends 0x31', () => {
    const all = equivalentBindings(learnedShort, DS_BT);
    expect(all).toContainEqual({ ...learnedShort, reportId: 0x31, byteIndex: 10 });
    const r = dsBtFull(); r[10] = 0x01;
    expect(hidPressed(all, r)).toBe(true);
  });
  it('a learned binding only applies to its own pad', () => {
    expect(bindingsFor(learnedShort, OTHER)).toEqual([]);
    expect(bindingsFor({ kind: 'xinput', xinputMask: 0x1000 }, DS_BT)).toEqual([]);
    expect(bindingsFor(null, DS_BT)).toEqual(defaultHidBindings(DS_BT));
  });
  it('an unknown pad keeps the learned byte as is', () => {
    const b: HidBinding = { kind: 'hid', vid: 0x1234, pid: 0x5678, reportId: 0, byteIndex: 3, bitMask: 0x04 };
    expect(equivalentBindings(b, OTHER)).toEqual([b]);
  });
  it('XInput: left thumb by default, the learned mask otherwise, nothing for a HID binding', () => {
    expect(xinputMaskFor(null)).toBe(XINPUT_LEFT_THUMB);
    expect(xinputMaskFor({ kind: 'xinput', xinputMask: 0x2000 })).toBe(0x2000);
    expect(xinputMaskFor(learnedShort)).toBe(0);
    expect(xinputPressed(0x0040, 0x0040 | 0x1000)).toBe(true);
    expect(xinputPressed(0x0040, 0x1000)).toBe(false);
    expect(xinputPressed(0, 0xffff)).toBe(false);
  });
  it('names buttons', () => {
    expect(bindingLabel(null)).toBe('Left stick click (L3)');
    expect(bindingLabel(defaultHidBindings(DS_BT)[1])).toBe('Left stick click (L3)');
    expect(bindingLabel(learnedShort)).toBe('L1');
    expect(bindingLabel({ kind: 'xinput', xinputMask: 0x1000 })).toBe('A');
    expect(bindingLabel({ kind: 'hid', vid: 0x1234, pid: 0x5678, reportId: 0, byteIndex: 3, bitMask: 0x04 })).toBe('Controller 1234:5678 report 0 byte 3 bit 0x4');
  });
});

describe('PadTrigger', () => {
  it('hold: fires once after holdMs, release re-arms', () => {
    const t = new PadTrigger('hold', 500);
    expect(t.update(true, 0)).toBe(false);
    expect(t.update(true, 499)).toBe(false);
    expect(t.update(true, 500)).toBe(true);
    for (let ms = 516; ms < 3000; ms += 16) expect(t.update(true, ms)).toBe(false);
    expect(t.update(false, 3000)).toBe(false);
    expect(t.update(true, 3100)).toBe(false);
    expect(t.update(true, 3600)).toBe(true);
  });
  it('hold: a short tap does nothing', () => {
    const t = new PadTrigger('hold', 500);
    t.update(true, 0); t.update(true, 300);
    expect(t.update(false, 320)).toBe(false);
    expect(t.update(true, 400)).toBe(false);
    expect(t.update(true, 800)).toBe(false); // the hold restarted at 400
    expect(t.update(true, 900)).toBe(true);
  });
  it('press: fires on the press, never while held', () => {
    const t = new PadTrigger('press');
    expect(t.update(true, 0)).toBe(true);
    for (let ms = 16; ms < 2000; ms += 16) expect(t.update(true, ms)).toBe(false);
    t.update(false, 2000);
    expect(t.update(true, 2400)).toBe(true);
  });
  it('press: a bounce within the debounce time is ignored', () => {
    const t = new PadTrigger('press');
    expect(t.update(true, 0)).toBe(true);
    t.update(false, 20);
    expect(t.update(true, 40)).toBe(false);
    t.update(false, 60);
    expect(t.update(true, PRESS_DEBOUNCE_MS + 1)).toBe(true);
  });
  it('after a settings change, a button still held does nothing until released', () => {
    const t = new PadTrigger('hold', 500);
    t.waitForRelease();
    expect(t.update(true, 0)).toBe(false);
    expect(t.update(true, 2000)).toBe(false);
    t.update(false, 2016);
    t.update(true, 2032);
    expect(t.update(true, 2532)).toBe(true);
    const p = new PadTrigger('press');
    p.waitForRelease();
    expect(p.update(true, 0)).toBe(false);
    p.update(false, 16);
    expect(p.update(true, 400)).toBe(true);
  });
  it('switching mode applies to the next press', () => {
    const t = new PadTrigger('press');
    t.mode = 'hold'; t.holdMs = 200;
    expect(t.update(true, 0)).toBe(false);
    expect(t.update(true, 200)).toBe(true);
  });
});

describe('ButtonLearner', () => {
  /** Feeds a stream of reports every 4 ms; `shape(t)` builds the report at time t. */
  function feed(l: ButtonLearner, d: PadDevice, until: number, shape: (t: number) => Uint8Array, from = 0) {
    for (let t = from; t <= until; t += 4) { const b = l.hidReport('dev', d, shape(t), t); if (b) return b; }
    return null;
  }
  const PRESS_AT = LEARN_BASELINE_MS + 200;

  it('learns L3 on a USB DualSense despite the counter, gyro and a nudged stick', () => {
    let n = 0;
    const b = feed(new ButtonLearner(), DS_USB, 3000, t => {
      const r = dsUsb(t >= PRESS_AT);
      r[7] = n++ & 0xff; // counter
      r[16] = (t * 7) & 0xff; r[17] = (t * 13) & 0xff; // gyro
      if (t >= PRESS_AT) r[1] = 0x80 + ((t / 4) % 9); // the stick moves while it's clicked
      return r;
    });
    expect(b).toEqual({ kind: 'hid', vid: 0x054c, pid: 0x0ce6, reportId: 0x01, byteIndex: 9, bitMask: 0x40 });
  });

  it('learns from the short Bluetooth report', () => {
    const b = feed(new ButtonLearner(), DS_BT, 3000, t => { const r = dsBtShort(); r[7] = (t / 4) << 2 & 0xfc; if (t >= PRESS_AT) r[6] = 0x01; return r; });
    expect(b).toMatchObject({ reportId: 0x01, byteIndex: 6, bitMask: 0x01 });
  });

  it('learns from the full 0x31 report', () => {
    const b = feed(new ButtonLearner(), DS_BT, 3000, t => { const r = dsBtFull(); r[1] = (t / 4) & 0xff; if (t >= PRESS_AT) r[9] |= 0x20; return r; });
    expect(b).toMatchObject({ reportId: 0x31, byteIndex: 9, bitMask: 0x20 }); // Cross
  });

  it('waits for the button to stay down (a blip is not a press)', () => {
    const b = feed(new ButtonLearner(), DS_USB, 3000, t => dsUsb(t >= PRESS_AT && t < PRESS_AT + 20));
    expect(b).toBeNull();
  });

  it('ignores presses during the baseline second', () => {
    const l = new ButtonLearner();
    expect(feed(l, DS_USB, LEARN_BASELINE_MS - 4, t => dsUsb(t > 200))).toBeNull();
  });

  it('skips d-pad hats (bits clear, not set)', () => {
    const b = feed(new ButtonLearner(), DS_USB, 3000, t => { const r = dsUsb(); if (t >= PRESS_AT) r[8] = 0x00; return r; });
    expect(b).toBeNull();
  });

  it('unknown pad: learns a button bit, not an analog trigger or a noisy byte', () => {
    const shape = (t: number) => {
      const r = new Uint8Array(12);
      r[1] = (t * 3) & 0xff; // noisy from the start
      if (t >= PRESS_AT) r[4] = Math.min(255, (t - PRESS_AT) >> 1); // trigger squeezed
      if (t >= PRESS_AT + 400) r[5] = 0x04; // the button
      return r;
    };
    expect(feed(new ButtonLearner(), OTHER, 4000, shape)).toEqual({ kind: 'hid', vid: 0x1234, pid: 0x5678, reportId: 0, byteIndex: 5, bitMask: 0x04 });
  });

  it('unknown pad: two bits at once is ambiguous', () => {
    const b = feed(new ButtonLearner(), OTHER, 3000, t => { const r = new Uint8Array(8); if (t >= PRESS_AT) { r[3] = 0x01; r[5] = 0x02; } return r; });
    expect(b).toBeNull();
  });

  it('XInput: learns the new button, not one that was already held', () => {
    const l = new ButtonLearner();
    let out: ReturnType<ButtonLearner['xinputState']> = null;
    for (let t = 0; t <= 3000 && !out; t += 16) out = l.xinputState(0, 0x0010 | (t >= PRESS_AT ? 0x1000 : 0), t);
    expect(out).toEqual({ kind: 'xinput', xinputMask: 0x1000 });
  });
});

describe('padState (what Settings shows)', () => {
  const on = PAD_DEFAULTS;
  it('says what is connected', () => {
    expect(padState(on, NO_PADS)).toMatchObject({ supported: true, status: 'No controller found', needsChoose: false, button: 'Left stick click (L3)', custom: false });
    expect(padState(on, { ...NO_PADS, devices: ['DualSense'], matched: true })).toMatchObject({ status: 'DualSense connected', needsChoose: false });
  });
  it('asks to choose a button when the default does not fit the pad', () => {
    expect(padState(on, { ...NO_PADS, devices: ['Controller 1234:5678'], matched: false }).needsChoose).toBe(true);
    expect(padState({ ...on, enabled: false }, { ...NO_PADS, devices: ['Controller 1234:5678'] })).toMatchObject({ status: 'Off', needsChoose: false });
  });
  it('walks through choosing a button', () => {
    expect(padState(on, { ...NO_PADS, learning: { phase: 'idle', secondsLeft: 10 } })).toMatchObject({ learning: true, status: 'Hands off the controller for a second…' });
    expect(padState(on, { ...NO_PADS, learning: { phase: 'press', secondsLeft: 7 } }).status).toBe('Press a button on your controller (7 s)…');
    expect(padState({ ...on, binding: { kind: 'xinput', xinputMask: 0x1000 } }, { ...NO_PADS, note: 'Chosen: A' })).toMatchObject({ button: 'A', custom: true, note: 'Chosen: A' });
  });
  it('off this system: says why', () => {
    expect(padState(on, { ...NO_PADS, supported: false, detail: 'Windows only for now' })).toMatchObject({ supported: false, status: 'Windows only for now' });
  });
});

describe('padToggle settings', () => {
  it('missing → defaults', () => {
    expect(cleanPadToggle(undefined)).toEqual(PAD_DEFAULTS);
    expect(cleanPadToggle({})).toEqual(PAD_DEFAULTS);
    expect(PAD_DEFAULTS).toEqual({ enabled: true, mode: 'hold', holdMs: 500, binding: null });
  });
  it('keeps good values and unknown fields', () => {
    const p = { enabled: false, mode: 'press', holdMs: 800, binding: { kind: 'xinput', xinputMask: 0x40 }, later: 1 };
    expect(cleanPadToggle(p)).toEqual(p);
  });
  it('repairs bad fields one by one', () => {
    expect(cleanPadToggle({ enabled: 'yes', mode: 'tap', holdMs: '500', binding: 7 })).toEqual(PAD_DEFAULTS);
    expect(cleanPadToggle({ holdMs: 5 }).holdMs).toBe(100);
    expect(cleanPadToggle({ holdMs: 99999 }).holdMs).toBe(3000);
    expect(cleanPadToggle({ holdMs: NaN }).holdMs).toBe(500);
  });
  it('drops a binding that could never match', () => {
    const good = { kind: 'hid', vid: 0x054c, pid: 0x0ce6, reportId: 1, byteIndex: 9, bitMask: 0x40 };
    expect(cleanBinding(good)).toEqual(good);
    expect(cleanBinding({ ...good, bitMask: 0x41 })).toBeNull();
    expect(cleanBinding({ ...good, bitMask: 0 })).toBeNull();
    expect(cleanBinding({ ...good, vid: -1 })).toBeNull();
    expect(cleanBinding({ ...good, kind: 'mouse' })).toBeNull();
    expect(cleanBinding({ kind: 'xinput', xinputMask: 0x0003 })).toBeNull();
  });
});
