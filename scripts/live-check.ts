// One-shot check of live tracking against a running game, read-only.
//   npx tsx scripts/live-check.ts [Rekarina.exe] [save folder]
// Opens the game with PROCESS_VM_READ | PROCESS_QUERY_LIMITED_INFORMATION only (src/main/procmem.ts),
// searches for the progress tables the way the app does but without any remembered addresses
// (so the full sweep is exercised), compares them with the newest save and prints what it
// found. Writes nothing: not to the game, not to its saves, not to the tracker's settings.
import { GAMES, LiveSource, findGame } from '../src/main/live.js';
import { ProcessMemory, initMemoryAccess } from '../src/main/procmem.js';
import { userFolderForExe, resolveUserFolders, listSlots, mostRecentSlot, readSaveStable } from '../src/gamedata/saves.js';
import { readTables, buildLive, matchesReference, areaFrom, STAGE_KEY, LOCATION_KEY } from '../src/gamedata/live.js';

const hex = (n: bigint | number) => '0x' + n.toString(16);
function fail(msg: string): never { console.error(msg); process.exit(1); }

const [image = 'Rekarina.exe', saveArg] = process.argv.slice(2);
const game = GAMES.find(g => g.image.toLowerCase() === image.toLowerCase());
if (!game) fail(`Unknown game exe "${image}". Known: ${GAMES.map(g => g.image).join(', ')}`);
if (!(await initMemoryAccess())) fail('Reading process memory is not available here (Windows + koffi needed).');
const running = await findGame(true, [game]);
if (!running) fail(`${game.image} is not running.`);
const mem = new ProcessMemory(running.pid);
const exe = mem.imagePath();
console.log(`pid       ${running.pid}  ${exe ?? '(path not given)'}`);

const userDir = saveArg ? resolveUserFolders(saveArg)[0] : exe ? userFolderForExe(exe) : null;
if (!userDir) { mem.close(); fail('No save folder found; pass it as the second argument.'); }
const slot = mostRecentSlot(listSlots(userDir));
if (!slot) { mem.close(); fail(`No slots in ${userDir}`); }
const ref = (await readSaveStable(slot.progress)).data;
console.log(`save      ${slot.progress}${slot.pending ? '  (pending: not put in place by the game yet)' : ''}`);
console.log(`          ${new Date(slot.mtimeMs).toLocaleString()}, ${ref.entries.size} keys, ${ref.warnings.length} warnings`);

if (game.heap) {
  const [lo, hi] = game.heap;
  const blocks = mem.regions().filter(r => r.base + r.size > lo && r.base < hi);
  const mb = Number(blocks.reduce((n, r) => n + r.size, 0n) >> 20n);
  console.log(`heap      ${blocks.length} committed blocks in [${hex(lo)}, ${hex(hi)}), ${mb} MB`);
}

// Drive the app's own live source, a tick at a time, on a made-up clock (no waiting between ticks).
const clock = { t: 1_000_000 };
const live = new LiveSource({
  hints: [], onHint() {}, onChange() {}, onStatus() {}, now: () => clock.t,
  findGame: async () => running, open: () => mem,
});
live.setReference(ref);
const log = console.log;
console.log = () => {}; // the live source's own status lines
const t0 = performance.now();
let ticks = 0;
for (; ticks < 20_000; ticks++) {
  await live.tick();
  clock.t += 500;
  const s = live.info.status;
  if (s === 'live' || s === 'no-game' || (s === 'waiting' && (live.located() || /Couldn't find/.test(live.info.detail ?? '')))) break;
}
const ms = Math.round(performance.now() - t0);
console.log = log;

console.log(`status    ${live.info.status}${live.info.detail ? `: ${live.info.detail}` : ''}`);
console.log(`time      ${ms} ms, ${ticks + 1} steps (the app takes one step per 0.5 s)`);
const t = live.located();
if (t) {
  for (const r of t.records) console.log(`table     ${r.type.padEnd(8)} ${String(r.count).padStart(6)} records at ${hex(r.start)}, vtable ${hex(r.vtable)}, ${r.index.size} keys mapped`);
  console.log(`table     64-bit   ${String(t.b64.count).padStart(6)} keys at ${hex(t.b64.start)}`);
  console.log(`location  ${t.location ? `record ${hex(t.location.record)}, guest base ${hex(t.location.base)}, ${t.location.checked ? 'checked' : 'NOT checked'}` : 'not found'}`);
  const raw = readTables(mem, t);
  if (raw) {
    const r = buildLive(t, raw, ref);
    for (const a of r.agreement) console.log(`agree     ${a.type.padEnd(12)} ${a.agree}/${a.checked}${a.refTrue !== undefined && a.type === 'Bool' ? `, ${a.liveTrueOfRefTrue}/${a.refTrue} of the save's true flags still true` : ''}`);
    console.log(`matches   ${matchesReference(r.agreement)}`);
    const stage = r.data.entries.get(STAGE_KEY)?.value;
    console.log(`area      ${typeof stage === 'string' ? areaFrom(stage, r.data.entries.get(LOCATION_KEY)?.value) : '(no stage)'}`);
  } else console.log('read      the tables could not be read again');
}
mem.close();
