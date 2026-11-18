import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { locate } from '../src/gamedata/live';
import type { GameDataFile } from '../src/gamedata/parser';
import { LiveSource, findGame, type LiveMem, type LiveOptions } from '../src/main/live';
import { findProcesses } from '../src/main/procmem';

// The table code has its own tests (live.test.ts); here it only has to say "found" or "not found".
vi.mock('../src/gamedata/live', () => ({
  locate: vi.fn(),
  readTables: () => [],
  fingerprint: () => 'print',
  buildLive: () => ({ agreement: [], data: {}, resettable: new Set() }),
  matchesReference: () => true,
  sweepRanges: () => [],
}));
vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

const FIND_EVERY_MS = 3000;
const TABLES = { records: [{ start: 0x1234n }] };
const GAME = { pid: 4321, image: 'hookshot.exe' };
const ADMIN = "hookshot.exe is running, but Windows won't let Boomerang Tracker open it. If the game runs as administrator, run the tracker as administrator too.";

function fakeMem() {
  const m = { running: true, close: vi.fn(), read: () => null, imagePath: () => undefined, regions: () => [], alive: () => m.running };
  return m satisfies LiveMem;
}

function setup(opts: Partial<LiveOptions> = {}) {
  const clock = { t: 100_000 };
  const mem = fakeMem();
  const findGame = vi.fn(async () => GAME as Awaited<ReturnType<NonNullable<LiveOptions['findGame']>>>);
  const open = vi.fn((_pid: number): LiveMem => mem);
  const live = new LiveSource({ hints: [], onHint() {}, onChange() {}, onStatus() {}, findGame, open, now: () => clock.t, ...opts });
  live.setReference({} as GameDataFile);
  return { live, mem, clock, findGame, open };
}

describe('LiveSource attach', () => {
  const found = vi.mocked(locate);
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    found.mockReset().mockReturnValue(TABLES as never);
    errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('goes live and stamps the snapshot with its own clock', async () => {
    const { live, clock, open } = setup();
    await live.tick();
    expect(open).toHaveBeenCalledWith(GAME.pid);
    expect(live.info.status).toBe('live');
    expect(live.current()?.atMs).toBe(clock.t);
  });

  it('explains a game it may not open, and retries only at the normal pace', async () => {
    const open = vi.fn((): LiveMem => { throw new Error('access denied'); });
    const { live, clock, findGame } = setup({ open });
    await live.tick();
    expect(live.info).toEqual({ status: 'no-game', detail: ADMIN });
    expect(errors).not.toHaveBeenCalled();

    clock.t += FIND_EVERY_MS - 1;
    await live.tick();
    expect(findGame).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);

    clock.t += 1;
    await live.tick();
    expect(findGame).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledTimes(2);
    expect(live.info).toEqual({ status: 'no-game', detail: ADMIN });
  });

  it('attaches once the game can be opened after all', async () => {
    const mem = fakeMem();
    const open = vi.fn((): LiveMem => { throw new Error('access denied'); });
    const { live, clock } = setup({ open });
    await live.tick();
    open.mockImplementation(() => mem);
    clock.t += FIND_EVERY_MS;
    await live.tick();
    expect(live.info).toEqual({ status: 'live' });
  });

  it('logs the same error once and waits before looking again', async () => {
    const findGame = vi.fn(async () => { throw new Error('boom'); });
    const { live, clock } = setup({ findGame });
    await live.tick();
    expect(live.info).toEqual({ status: 'no-game', detail: 'boom' });

    await live.tick(); // the very next tick doesn't look again
    expect(findGame).toHaveBeenCalledTimes(1);

    clock.t += FIND_EVERY_MS;
    await live.tick();
    expect(findGame).toHaveBeenCalledTimes(2);
    expect(errors).toHaveBeenCalledTimes(1);

    findGame.mockRejectedValueOnce(new Error('another'));
    clock.t += FIND_EVERY_MS;
    await live.tick();
    expect(errors).toHaveBeenCalledTimes(2);
  });

  it('waits after an error even when it came from an attached game', async () => {
    const { live, mem, clock, findGame } = setup();
    await live.tick();
    mem.alive = () => { throw new Error('boom'); };
    clock.t += FIND_EVERY_MS;
    await live.tick();
    expect(live.info).toEqual({ status: 'no-game', detail: 'boom' });
    expect(mem.close).toHaveBeenCalledTimes(1);

    clock.t += FIND_EVERY_MS - 1;
    await live.tick();
    expect(findGame).toHaveBeenCalledTimes(1);
  });

  it('logs an error again after having been live in between', async () => {
    const { live, mem, clock, findGame } = setup();
    findGame.mockRejectedValueOnce(new Error('boom'));
    await live.tick();
    expect(errors).toHaveBeenCalledTimes(1);

    clock.t += FIND_EVERY_MS;
    await live.tick();
    expect(live.info.status).toBe('live');

    mem.running = false;
    findGame.mockRejectedValueOnce(new Error('boom'));
    clock.t += FIND_EVERY_MS;
    await live.tick();
    expect(errors).toHaveBeenCalledTimes(2);
  });

  it('lets go of a game that closed', async () => {
    const { live, mem, clock, findGame, open } = setup();
    await live.tick();
    mem.running = false;
    clock.t += 500; // too soon to look for a game again
    await live.tick();
    expect(live.info).toEqual({ status: 'no-game' });
    expect(live.current()).toBeUndefined();
    expect(mem.close).toHaveBeenCalledTimes(1);
    expect(findGame).toHaveBeenCalledTimes(1);

    mem.running = true;
    clock.t += FIND_EVERY_MS;
    await live.tick();
    expect(open).toHaveBeenCalledTimes(2);
    expect(live.info.status).toBe('live');
  });

  it("doesn't make a restarted game wait out the last run's sweep pause", async () => {
    found.mockReturnValue(null);
    const findGame = vi.fn(async () => ({ ...GAME, emulator: true }));
    const { live, mem, clock } = setup({ findGame });
    await live.tick(); // nothing to sweep: gives up and pauses for 10 s
    expect(live.info.status).toBe('waiting');

    // The pause holds while the same game stays open...
    const looked = found.mock.calls.length;
    clock.t += 1000;
    await live.tick();
    expect(found.mock.calls.length).toBe(looked);

    // ...but not for the next run, found well inside those 10 s.
    mem.running = false;
    found.mockReturnValue(TABLES as never);
    clock.t += FIND_EVERY_MS;
    await live.tick();
    expect(findGame).toHaveBeenCalledTimes(2);
    expect(found.mock.calls.length).toBeGreaterThan(looked);
    expect(live.info.status).toBe('live');
  });
});

describe('strict process lookup', () => {
  const tasklistFails = () => vi.mocked(execFile).mockImplementation(((...a: unknown[]) => {
    (a[a.length - 1] as (e: Error) => void)(new Error('tasklist broke'));
  }) as never);
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;

  beforeEach(() => { Object.defineProperty(process, 'platform', { ...platform, value: 'win32' }); tasklistFails(); });
  afterEach(() => { Object.defineProperty(process, 'platform', platform); vi.mocked(execFile).mockReset(); });

  it('answers "none" by default when tasklist fails', async () => {
    await expect(findProcesses('hookshot.exe')).resolves.toEqual([]);
    await expect(findGame()).resolves.toBeUndefined();
  });

  it('rejects when strict', async () => {
    await expect(findProcesses('hookshot.exe', true)).rejects.toThrow('tasklist broke');
    await expect(findGame(true)).rejects.toThrow('tasklist broke');
  });
});
