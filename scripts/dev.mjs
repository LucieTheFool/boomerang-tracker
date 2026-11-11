// `npm run dev`: Vite dev server for the UI + esbuild watch for main/preload + Electron.
// Restarts Electron when the main process is rebuilt.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createServer } from 'vite';
import electronPath from 'electron';

const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const url = `http://localhost:${server.config.server.port}/`;

const watcher = spawn(process.execPath, ['scripts/build-electron.mjs', '--watch'], { stdio: 'inherit' });

let app = null;
function startElectron() {
  if (app) { app.removeAllListeners('exit'); app.kill(); }
  // VS Code's terminal sets ELECTRON_RUN_AS_NODE, which would start Electron as plain Node.
  const env = { ...process.env, VITE_DEV_SERVER_URL: url };
  delete env.ELECTRON_RUN_AS_NODE;
  app = spawn(electronPath, ['.'], { stdio: 'inherit', env });
  app.on('exit', () => { watcher.kill(); void server.close(); process.exit(0); });
}

// Wait for the first build, then restart on each rebuild of main.cjs.
const main = 'dist-electron/main.cjs';
const wait = setInterval(() => {
  if (fs.existsSync(main)) {
    clearInterval(wait);
    startElectron();
    let t;
    fs.watch(main, () => { clearTimeout(t); t = setTimeout(startElectron, 300); });
  }
}, 200);
