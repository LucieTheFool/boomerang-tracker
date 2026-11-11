// `npm start`: run the built app. Clears ELECTRON_RUN_AS_NODE, which VS Code's
// terminal sets and which would make Electron start as plain Node.
import { spawn } from 'node:child_process';
import electronPath from 'electron';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electronPath, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', code => process.exit(code ?? 0));
