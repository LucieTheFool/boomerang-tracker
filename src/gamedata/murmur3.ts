// MurmurHash3 x86_32, the hash GameData uses for key names and enum values.
// Confirmed against the game's own table: murmur3("AttackByWeapon") === 0xB58C29C3.
export function murmur3(input: string | Uint8Array, seed = 0): number {
  const d = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let h = seed >>> 0;
  const n = d.length & ~3;
  for (let i = 0; i < n; i += 4) {
    let k = d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24);
    k = Math.imul(k, c1);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, c2);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  let k = 0;
  const r = d.length & 3;
  if (r === 3) k ^= d[n + 2] << 16;
  if (r >= 2) k ^= d[n + 1] << 8;
  if (r >= 1) {
    k ^= d[n];
    k = Math.imul(k, c1);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, c2);
    h ^= k;
  }
  h ^= d.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export const hex32 = (n: number) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
export const hex64 = (n: bigint) => '0x' + n.toString(16).toUpperCase().padStart(16, '0');
