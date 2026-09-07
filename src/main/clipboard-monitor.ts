import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { clipboard, app } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { createInterface } from 'readline';

const DOUBLE_TAP_WINDOW_MS = 500;

class ClipboardMonitor extends EventEmitter {
  private process: ChildProcess | null = null;
  private lastChangeTime = 0;

  start(): void {
    const binaryPath = this.getBinaryPath();
    if (!existsSync(binaryPath)) {
      console.error(`Clipboard monitor binary not found at ${binaryPath}`);
      return;
    }

    this.process = spawn(binaryPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });

    const rl = createInterface({ input: this.process.stdout! });
    rl.on('line', () => this.handleClipboardChange());

    this.process.stderr!.on('data', (data: Buffer) => {
      console.error('clipboard-monitor:', data.toString());
    });

    this.process.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.error(`clipboard-monitor exited with code ${code}`);
      }
    });
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private handleClipboardChange(): void {
    const now = Date.now();
    const gap = now - this.lastChangeTime;
    this.lastChangeTime = now;

    if (gap > 0 && gap < DOUBLE_TAP_WINDOW_MS) {
      const text = clipboard.readText().trim();
      if (text.length > 0) {
        this.emit('double-copy', text);
      }
    }
  }

  private getBinaryPath(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'clipboard-monitor');
    }
    return join(__dirname, '../../native/clipboard-monitor');
  }
}

export const clipboardMonitor = new ClipboardMonitor();
