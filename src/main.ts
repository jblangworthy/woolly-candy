import { app, ipcMain, clipboard } from 'electron';
import { exec, execSync } from 'child_process';
import started from 'electron-squirrel-startup';
import { IPC } from './shared/ipc-channels';
import { clipboardMonitor } from './main/clipboard-monitor';
import { translationService } from './main/translation-service';
import { showPopup, hidePopup, setMode, getPopup, whenReady } from './main/window-manager';
import { createTray, setConnected } from './main/tray-manager';
import * as store from './main/store';
import * as ltManager from './main/libretranslate-manager';

if (started) app.quit();

let lastDetectedLanguage: string | null = null;
let sourceAppBundleId: string | null = null;

async function handleTranslationTrigger(text: string): Promise<void> {
  try {
    sourceAppBundleId = execSync(
      `osascript -e 'tell application "System Events" to get bundle identifier of first application process whose frontmost is true'`,
      { encoding: 'utf-8', timeout: 1000 }
    ).trim();
  } catch {
    sourceAppBundleId = null;
  }

  await whenReady();
  showPopup();

  const popup = getPopup();
  if (!popup) return;

  const source = store.get('sourceLanguage');
  const target = store.get('targetLanguage');

  popup.webContents.send(IPC.SOURCE_TEXT, text);

  try {
    const result = await translationService.translate(text, source, target);
    if (result.detectedLanguage) {
      lastDetectedLanguage = result.detectedLanguage;
    }
    popup.webContents.send(IPC.TRANSLATION_RESULT, result);
  } catch (err: any) {
    popup.webContents.send(IPC.TRANSLATION_ERROR, err.message);
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.TRANSLATE, async (_event, text: string, source: string, target: string) => {
    try {
      const result = await translationService.translate(text, source, target);
      if (result.detectedLanguage) {
        lastDetectedLanguage = result.detectedLanguage;
      }
      return result;
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle(IPC.SWAP_LANGUAGES, async () => {
    const source = store.get('sourceLanguage');
    const target = store.get('targetLanguage');

    const effectiveSource = source === 'auto'
      ? (lastDetectedLanguage ?? 'en')
      : source;

    store.set('sourceLanguage', target);
    store.set('targetLanguage', effectiveSource);

    return { sourceLanguage: target, targetLanguage: effectiveSource };
  });

  ipcMain.handle(IPC.SET_LANGUAGE_PAIR, (_event, source: string, target: string) => {
    store.set('sourceLanguage', source);
    store.set('targetLanguage', target);
  });

  ipcMain.handle(IPC.GET_LANGUAGES, async () => {
    try {
      return await translationService.getLanguages();
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC.GET_PREFERENCES, () => {
    return store.getAll();
  });

  ipcMain.on(IPC.DISMISS_WINDOW, () => hidePopup());

  ipcMain.on(IPC.SET_EXPANDED, (_event, mode: string) => {
    if (mode === 'compact' || mode === 'expanded' || mode === 'settings') {
      store.set('expanded', mode === 'expanded');
      setMode(mode);
    }
  });

  ipcMain.handle(IPC.SET_ENABLED_LANGUAGES, (_event, languages: string[]) => {
    store.set('enabledLanguages', languages);
  });

  ipcMain.handle(IPC.COPY_TRANSLATION, (_event, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle(IPC.REPLACE_ORIGINAL, (_event, text: string) => {
    clipboard.writeText(text);
    hidePopup();

    const activateAndPaste = sourceAppBundleId
      ? `tell application id "${sourceAppBundleId}" to activate
delay 0.3
tell application "System Events" to keystroke "v" using command down`
      : `delay 0.3
tell application "System Events" to keystroke "v" using command down`;

    setTimeout(() => {
      exec(`osascript -e '${activateAndPaste}'`);
    }, 200);
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  store.initStore();
  registerIpcHandlers();

  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: store.get('launchAtLogin') as boolean });
  }

  createTray();

  await ltManager.startIfNeeded();

  translationService.on('status-change', (status: boolean) => {
    setConnected(status);
    const popup = getPopup();
    if (popup) {
      popup.webContents.send(IPC.CONNECTION_STATUS, status);
    }
  });
  translationService.startHealthPolling();

  clipboardMonitor.on('double-copy', (text: string) => {
    handleTranslationTrigger(text);
  });
  clipboardMonitor.start();
});

app.on('will-quit', () => {
  clipboardMonitor.stop();
  translationService.stopHealthPolling();
  ltManager.stop();
});

app.on('window-all-closed', () => {
  // Keep running — tray app stays alive with no windows
});
