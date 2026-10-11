import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localScriptDir = resolve(projectRoot, 'apps-script');

await mkdir(localScriptDir, { recursive: true });

const claspEntry = require.resolve('@google/clasp');
const child = spawn(process.execPath, [claspEntry, '--auth', '.clasprc.json', 'pull'], {
  cwd: projectRoot,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`No se pudo iniciar clasp: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`clasp terminó por la señal ${signal}`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
