import { BrowserWindow, screen } from 'electron';
import path from 'path';
import * as store from './store';

const COMPACT_WIDTH = 480;
const COMPACT_HEIGHT = 200;
const EXPANDED_HEIGHT = 420;
const SETTINGS_HEIGHT = 500;
const FADE_DURATION_MS = 150;
const FADE_STEP_MS = 16;
const SNAP_DISTANCE = 20;

let popup: BrowserWindow | null = null;
let ready = false;
let readyResolve: (() => void) | null = null;
let readyPromise: Promise<void> | null = null;

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

function ensurePopup(): BrowserWindow {
  if (popup && !popup.isDestroyed()) return popup;

  popup = new BrowserWindow({
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    resizable: false,
    movable: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popup.setAlwaysOnTop(true, 'screen-saver');
  popup.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  ready = false;
  readyPromise = new Promise<void>((resolve) => { readyResolve = resolve; });

  popup.webContents.on('did-finish-load', () => {
    ready = true;
    if (readyResolve) { readyResolve(); readyResolve = null; }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    popup.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    popup.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  popup.on('moved', () => {
    if (!popup) return;
    const [x, y] = popup.getPosition();
    const snapped = snapToEdge(x, y);
    if (snapped.x !== x || snapped.y !== y) {
      popup.setPosition(snapped.x, snapped.y);
    }
    store.set('windowPosition', { x: snapped.x, y: snapped.y });
  });

  return popup;
}

export function showPopup(): void {
  const win = ensurePopup();

  const saved = store.get('windowPosition');
  if (saved) {
    win.setPosition(saved.x, saved.y);
  } else {
    centerOnScreen();
  }

  win.setOpacity(0);
  win.showInactive();
  win.focus();
  fadeIn();
}

export function hidePopup(): void {
  if (!popup || popup.isDestroyed() || !popup.isVisible()) return;
  fadeOut(() => {
    if (popup && !popup.isDestroyed()) popup.hide();
  });
}

export function setMode(mode: 'compact' | 'expanded' | 'settings'): void {
  if (!popup || popup.isDestroyed()) return;

  let height: number;
  switch (mode) {
    case 'compact': height = COMPACT_HEIGHT; break;
    case 'expanded': height = EXPANDED_HEIGHT; break;
    case 'settings': height = SETTINGS_HEIGHT; break;
  }

  popup.setSize(COMPACT_WIDTH, height);
}

export function getPopup(): BrowserWindow | null {
  if (popup && popup.isDestroyed()) popup = null;
  return popup;
}

export async function whenReady(): Promise<void> {
  ensurePopup();
  if (ready) return;
  if (readyPromise) await readyPromise;
}

function centerOnScreen(): void {
  if (!popup) return;
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { width: dw, height: dh } = display.workAreaSize;
  const { x: dx, y: dy } = display.workArea;
  const bounds = popup.getBounds();

  const x = dx + Math.round((dw - bounds.width) / 2);
  const y = dy + Math.round((dh - bounds.height) / 2);
  popup.setPosition(x, y);
}

function snapToEdge(x: number, y: number): { x: number; y: number } {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const work = display.workArea;
  const bounds = popup!.getBounds();

  let sx = x;
  let sy = y;

  if (Math.abs(x - work.x) < SNAP_DISTANCE) {
    sx = work.x;
  } else if (Math.abs((x + bounds.width) - (work.x + work.width)) < SNAP_DISTANCE) {
    sx = work.x + work.width - bounds.width;
  }

  if (Math.abs(y - work.y) < SNAP_DISTANCE) {
    sy = work.y;
  } else if (Math.abs((y + bounds.height) - (work.y + work.height)) < SNAP_DISTANCE) {
    sy = work.y + work.height - bounds.height;
  }

  return { x: sx, y: sy };
}

function fadeIn(): void {
  if (!popup) return;
  let opacity = 0;
  const step = FADE_STEP_MS / FADE_DURATION_MS;
  const interval = setInterval(() => {
    if (!popup || popup.isDestroyed()) { clearInterval(interval); return; }
    opacity = Math.min(1, opacity + step);
    popup.setOpacity(opacity);
    if (opacity >= 1) clearInterval(interval);
  }, FADE_STEP_MS);
}

function fadeOut(done: () => void): void {
  if (!popup) return;
  let opacity = popup.getOpacity();
  const step = FADE_STEP_MS / FADE_DURATION_MS;
  const interval = setInterval(() => {
    if (!popup || popup.isDestroyed()) { clearInterval(interval); return; }
    opacity = Math.max(0, opacity - step);
    popup.setOpacity(opacity);
    if (opacity <= 0) {
      clearInterval(interval);
      done();
    }
  }, FADE_STEP_MS);
}
