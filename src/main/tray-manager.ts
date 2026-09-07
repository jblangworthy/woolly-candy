import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import * as store from './store';

let tray: Tray | null = null;
let connected = false;

export function createTray(): Tray {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'tray-icon.png')
    : path.join(__dirname, '../../assets/tray-icon.png');

  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('woolly-candy');
  rebuildMenu();
  return tray;
}

export function setConnected(status: boolean): void {
  connected = status;
  rebuildMenu();
}

function rebuildMenu(): void {
  if (!tray) return;

  const source = store.get('sourceLanguage');
  const target = store.get('targetLanguage');
  const sourceLabel = source === 'auto' ? 'Auto' : source.toUpperCase();
  const targetLabel = target.toUpperCase();
  const launchAtLogin = store.get('launchAtLogin');

  const menu = Menu.buildFromTemplate([
    {
      label: `LibreTranslate: ${connected ? 'Connected' : 'Disconnected'}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: `Language: ${sourceLabel} → ${targetLabel}`,
      enabled: false,
    },
    { label: 'Trigger: Double Cmd+C', enabled: false },
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: launchAtLogin as boolean,
      click: (menuItem) => {
        store.set('launchAtLogin', menuItem.checked);
        if (app.isPackaged) {
          app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        }
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
}
