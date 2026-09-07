import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const VENV_DIR = join(homedir(), '.woolly-candy');
const BIN_DIR = join(VENV_DIR, 'venv', 'bin');
const LT_BIN = join(BIN_DIR, 'libretranslate');
const PORT = '5000';

let child: ChildProcess | null = null;
let managedByUs = false;

function isInstalled(): boolean {
  return existsSync(LT_BIN);
}

async function isAlreadyRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const resp = await fetch(`http://localhost:${PORT}/languages`, { signal: controller.signal });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}

export async function startIfNeeded(): Promise<void> {
  if (await isAlreadyRunning()) return;
  if (!isInstalled()) return;

  child = spawn(LT_BIN, ['--port', PORT, '--host', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: `${BIN_DIR}:${process.env.PATH}` },
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`LibreTranslate exited with code ${code}`);
    }
    child = null;
    managedByUs = false;
  });

  child.stderr?.on('data', (data: Buffer) => {
    const line = data.toString();
    if (line.includes('ERROR') || line.includes('Traceback')) {
      console.error('libretranslate:', line.trim());
    }
  });

  managedByUs = true;
}

export function stop(): void {
  if (child && managedByUs) {
    child.kill('SIGTERM');
    child = null;
    managedByUs = false;
  }
}

export function isManagedByUs(): boolean {
  return managedByUs;
}
