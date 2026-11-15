// Read-only access to another process's memory on Windows, through koffi.
// The handle is opened with PROCESS_VM_READ | PROCESS_QUERY_LIMITED_INFORMATION only:
// it cannot write to, or otherwise change, the process.
import { execFile } from 'node:child_process';
import type { Mem } from '../gamedata/live.js';

const PROCESS_VM_READ = 0x0010;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

type Fn = (...args: unknown[]) => unknown;
let api: { OpenProcess: Fn; CloseHandle: Fn; ReadProcessMemory: Fn; GetExitCodeProcess: Fn; QueryFullProcessImageNameW: Fn } | null | undefined;

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
    return {
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

/** Process ids of running programs with this image name (e.g. "hookshot.exe"). */
export function findProcesses(image: string): Promise<number[]> {
  return new Promise(resolve => {
    if (process.platform !== 'win32') return resolve([]);
    execFile('tasklist.exe', ['/FI', `IMAGENAME eq ${image}`, '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 5000 }, (err, out) => {
      if (err) return resolve([]);
      const pids = String(out).split(/\r?\n/).map(l => l.match(/^"[^"]+","(\d+)"/)?.[1]).filter((x): x is string => !!x).map(Number);
      resolve(pids);
    });
  });
}
