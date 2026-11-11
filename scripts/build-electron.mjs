// Bundles the Electron main process and preload with esbuild.
//   node scripts/build-electron.mjs          one-off build
//   node scripts/build-electron.mjs --watch  rebuild on change (used by `npm run dev`)
import * as esbuild from 'esbuild';

const common = { bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'], sourcemap: true, logLevel: 'info' };
const builds = [
  { ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist-electron/main.cjs' },
  { ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist-electron/preload.cjs' },
];

if (process.argv.includes('--watch')) {
  for (const b of builds) await (await esbuild.context(b)).watch();
} else {
  await Promise.all(builds.map(b => esbuild.build(b)));
}
