// Read-only access to another process's memory on Windows, through koffi.
// The handle is opened with PROCESS_VM_READ | PROCESS_QUERY_LIMITED_INFORMATION only:
// it cannot write to, or otherwise change, the process.
import { execFile } from 'node:child_process';
import type { Mem } from '../gamedata/live.js';

const PROCESS_VM_READ = 0x0010;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

type Fn = (...args: unknown[]) => unknown;
let api: { OpenProcess: Fn; CloseHandle: Fn; ReadProcessMemory: Fn; GetExitCodeProcess: Fn; QueryFullProcessImageNameW: Fn; VirtualQueryEx: Fn; mbiSize: number } | null | undefined;

/** A committed, readable block of the process's memory. type: 0x20000 private, 0x40000 mapped, 0x1000000 image. */
export interface MemRegion { base: bigint; size: bigint; type: number }

/** Load koffi and the kernel32 functions once. Call before using ProcessMemory. */
export async function initMemoryAccess(): Promise<boolean> {
  if (api !== undefined) return !!api;
  if (process.platform !== 'win32') return !!(api = null);
  try {
    const mod = await import('koffi');
    const koffi = (mod as { default?: unknown }).default ?? mod;
    api = bind(koffi);
  } catch (e) {
    console.error('koffi unavailable', e);
    api = null;
  }
  return !!api;
}

function load() { return api ?? null; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bind(koffi: any) {
  {
    const k32 = koffi.load('kernel32.dll');
    const mbi = koffi.struct('MEMORY_BASIC_INFORMATION', {
      BaseAddress: 'uint64', AllocationBase: 'uint64', AllocationProtect: 'uint32', PartitionId: 'uint16', _pad: 'uint16',
      RegionSize: 'uint64', State: 'uint32', Protect: 'uint32', Type: 'uint32', _pad2: 'uint32',
    });
    return {
      mbiSize: koffi.sizeof(mbi) as number,
      VirtualQueryEx: k32.func('size_t __stdcall VirtualQueryEx(void *h, uint64_t addr, _Out_ MEMORY_BASIC_INFORMATION *info, size_t len)'),
      OpenProcess: k32.func('void * __stdcall OpenProcess(uint32_t access, int inherit, uint32_t pid)'),
      CloseHandle: k32.func('int __stdcall CloseHandle(void *h)'),
      ReadProcessMemory: k32.func('int __stdcall ReadProcessMemory(void *h, uint64_t addr, _Out_ uint8_t *buf, size_t size, void *read)'),
      GetExitCodeProcess: k32.func('int __stdcall GetExitCodeProcess(void *h, _Out_ uint32_t *code)'),
      QueryFullProcessImageNameW: k32.func('int __stdcall QueryFullProcessImageNameW(void *h, uint32_t flags, _Out_ uint16_t *name, _Inout_ uint32_t *size)'),
    };
  }
}

export class ProcessMemory implements Mem {
  private handle: unknown;
  constructor(readonly pid: number) {
    const a = load();
    if (!a) throw new Error('Process memory access is not available on this system');
    this.handle = a.OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
    if (!this.handle) throw new Error(`Couldn't open process ${pid} for reading`);
  }
  read(addr: bigint, len: number): Buffer | null {
    if (!this.handle) return null;
    const buf = Buffer.alloc(len);
    const ok = api!.ReadProcessMemory(this.handle, addr, buf, len, null);
    return ok ? buf : null;
  }
  /** Full path of the program (e.g. D:\Games\Longshot\hookshot.exe), if Windows will say. */
  imagePath(): string | undefined {
    if (!this.handle) return undefined;
    const name = new Uint16Array(1024), size = [name.length];
    if (!api!.QueryFullProcessImageNameW(this.handle, 0, name, size)) return undefined;
    return String.fromCharCode(...name.subarray(0, size[0]));
  }
  /**
   * The process's committed, readable memory blocks (works with the limited query right).
   * Emulators put the game's memory at a different place every run, so it has to be found.
   */
  regions(): MemRegion[] {
    const out: MemRegion[] = [];
    if (!this.handle) return out;
    let addr = 0n;
    for (;;) {
      const m: { BaseAddress: bigint | number; RegionSize: bigint | number; State: number; Protect: number; Type: number } = {} as never;
      if (!api!.VirtualQueryEx(this.handle, addr, m, api!.mbiSize)) break;
      const base = BigInt(m.BaseAddress), size = BigInt(m.RegionSize);
      // MEM_COMMIT, and not PAGE_NOACCESS or PAGE_GUARD.
      if (m.State === 0x1000 && m.Protect !== 0 && !(m.Protect & 0x01) && !(m.Protect & 0x100)) out.push({ base, size, type: m.Type });
      if (base + size <= addr) break;
      addr = base + size;
    }
    return out;
  }
  alive(): boolean {
    if (!this.handle) return false;
    const code = [0];
    if (!api!.GetExitCodeProcess(this.handle, code)) return false;
    return code[0] === 259; // STILL_ACTIVE
  }
  close() {
    if (this.handle) api!.CloseHandle(this.handle);
    this.handle = undefined;
  }
}

/**
 * Process ids of running programs with this image name (e.g. "hookshot.exe").
 * `strict`: reject when tasklist fails instead of answering "none" (for checks that must be sure).
 */
export function findProcesses(image: string, strict = false): Promise<number[]> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') return resolve([]);
    execFile('tasklist.exe', ['/FI', `IMAGENAME eq ${image}`, '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 5000 }, (err, out) => {
      if (err) return strict ? reject(new Error(`couldn’t list running programs (${err.message})`)) : resolve([]);
      const pids = String(out).split(/\r?\n/).map(l => l.match(/^"[^"]+","(\d+)"/)?.[1]).filter((x): x is string => !!x).map(Number);
      resolve(pids);
    });
  });
}
