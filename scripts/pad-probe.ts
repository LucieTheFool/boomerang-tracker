// Lists the HID game controllers (and XInput pads) and prints, live, the input-report bytes
// that change, so a button's place in the report can be checked on a real controller.
//   npx tsx scripts/pad-probe.ts [seconds=15]
// Uses the app's own reader (src/main/gamepad.ts), with the same read-only rules: devices are
// opened for reading and shared, only input reports are read. Nothing is sent to the
// controller (no output or feature reports, no HidD_GetFeature) and nothing is written anywhere.
// Keep your hands off the controller for the first second: bytes that change on their own
// then (sticks, triggers, counters, gyro) are listed once and not printed after that.
import { HidReader, describeHid, hidPaths, initPadAccess, isGameController, padProblem, productString, xinputButtons, type HidInfo } from '../src/main/gamepad.js';
import { ButtonLearner, LEARN_BASELINE_MS, bindingLabel, bindingsFor, hidPressed, padName, type PadBinding } from '../src/main/gamepad-logic.js';

const seconds = Number(process.argv[2] ?? 15) || 15;
const hex = (n: number, w = 2) => n.toString(16).toUpperCase().padStart(w, '0');

if (!(await initPadAccess())) {
  console.error(`Controller access isn't available: ${padProblem()}`);
  process.exit(1);
}

const pads: { info: HidInfo; reader: HidReader; name: string }[] = [];
const all = hidPaths().map(describeHid).filter((i): i is HidInfo => !!i && isGameController(i));
console.log(`HID game controllers: ${all.length}`);
for (const info of all) {
  const name = productString(info.path) ?? padName(info.vid, info.pid);
  console.log(`  ${hex(info.vid, 4)}:${hex(info.pid, 4)}  "${name}"  usage ${hex(info.usagePage)}/${hex(info.usage)}  input report ${info.reportLen} bytes  ${info.bluetooth ? 'Bluetooth' : 'USB'}${info.xinput ? '  (XInput pad: read through XInput)' : ''}`);
  console.log(`    ${info.path}`);
  if (info.xinput) continue;
  try { pads.push({ info, reader: new HidReader(info), name }); } catch (e) { console.log(`    can't read: ${(e as Error).message}`); }
}
const xslots = [0, 1, 2, 3].filter(s => xinputButtons(s) !== null);
console.log(`XInput pads: ${xslots.length ? xslots.map(s => `slot ${s + 1}`).join(', ') : 'none'}`);
if (!pads.length && !xslots.length) process.exit(0);

console.log(`\nReading for ${seconds} s. Hands off for a second, then press buttons…\n`);
const start = performance.now();
const t = () => ((performance.now() - start) / 1000).toFixed(3).padStart(7);
// Per pad and report id: the previous report, and the bits that changed during the first second.
const prev = new Map<string, Uint8Array>();
const noise = new Map<string, Uint8Array>();
const shown = new Set<string>();
const defaultDown = new Map<string, boolean>();
const xprev = new Map<number, number>();
let learner = new ButtonLearner();
const learned = (b: PadBinding) => { console.log(`${t()}  → "Choose button…" would pick: ${bindingLabel(b)}  ${JSON.stringify(b)}`); learner = new ButtonLearner(); };

const timer = setInterval(() => {
  const now = performance.now();
  for (const p of pads) {
    let reports: Uint8Array[];
    try { reports = p.reader.drain(); } catch (e) { console.log(`${t()}  ${p.name}: ${(e as Error).message}`); continue; }
    for (const r of reports) {
      const key = `${p.info.path}#${r[0]}`;
      const before = prev.get(key);
      prev.set(key, r);
      if (!before) {
        console.log(`${t()}  ${p.name} report 0x${hex(r[0])} (${r.length} bytes): ${[...r].map(x => hex(x)).join(' ')}`);
        noise.set(key, new Uint8Array(r.length));
        continue;
      }
      const nz = noise.get(key)!;
      if (now - start < LEARN_BASELINE_MS) { for (let i = 0; i < r.length; i++) nz[i] |= r[i] ^ before[i]; continue; }
      if (!shown.has(key)) {
        shown.add(key);
        const busy = [...nz].map((m, i) => (m ? `[${i}]&${hex(m)}` : '')).filter(Boolean);
        console.log(`${t()}  ${p.name} report 0x${hex(r[0])}: changing on their own (not printed): ${busy.join(' ') || 'none'}`);
      }
      const changes: string[] = [];
      for (let i = 0; i < r.length; i++) if ((r[i] ^ before[i]) & ~nz[i]) changes.push(`[${i}] ${hex(before[i])}→${hex(r[i])}`);
      if (changes.length) console.log(`${t()}  ${p.name} 0x${hex(r[0])}  ${changes.join('  ')}`);
      const down = hidPressed(bindingsFor(null, p.info), r);
      if (down !== null && down !== (defaultDown.get(p.info.path) ?? false)) {
        defaultDown.set(p.info.path, down);
        console.log(`${t()}  default button (L3) ${down ? 'down' : 'up'}`);
      }
      const b = learner.hidReport(p.info.path, p.info, r, now);
      if (b) learned(b);
    }
  }
  for (const s of xslots) {
    const buttons = xinputButtons(s);
    if (buttons === null) continue;
    if (xprev.has(s) && xprev.get(s) !== buttons) console.log(`${t()}  XInput slot ${s + 1} wButtons ${hex(xprev.get(s)!, 4)}→${hex(buttons, 4)}`);
    xprev.set(s, buttons);
    const b = learner.xinputState(s, buttons, now);
    if (b) learned(b);
  }
}, 15);

setTimeout(() => {
  clearInterval(timer);
  for (const p of pads) p.reader.close();
  console.log('\nDone.');
}, seconds * 1000);
