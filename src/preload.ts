import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './shared/ipc-channels';

contextBridge.exposeInMainWorld('api', {
  translate: (text: string, source: string, target: string) =>
    ipcRenderer.invoke(IPC.TRANSLATE, text, source, target),

  swapLanguages: () =>
    ipcRenderer.invoke(IPC.SWAP_LANGUAGES),

  setLanguagePair: (source: string, target: string) =>
    ipcRenderer.invoke(IPC.SET_LANGUAGE_PAIR, source, target),

  getLanguages: () =>
    ipcRenderer.invoke(IPC.GET_LANGUAGES),

  getPreferences: () =>
    ipcRenderer.invoke(IPC.GET_PREFERENCES),

  dismissWindow: () =>
    ipcRenderer.send(IPC.DISMISS_WINDOW),

  setMode: (mode: string) =>
    ipcRenderer.send(IPC.SET_EXPANDED, mode),

  setEnabledLanguages: (languages: string[]) =>
    ipcRenderer.invoke(IPC.SET_ENABLED_LANGUAGES, languages),

  copyTranslation: (text: string) =>
    ipcRenderer.invoke(IPC.COPY_TRANSLATION, text),

  replaceOriginal: (text: string) =>
    ipcRenderer.invoke(IPC.REPLACE_ORIGINAL, text),

  onSourceText: (callback: (text: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, text: string) => callback(text);
    ipcRenderer.on(IPC.SOURCE_TEXT, handler);
    return () => ipcRenderer.removeListener(IPC.SOURCE_TEXT, handler);
  },

  onTranslationResult: (callback: (result: { translatedText: string; detectedLanguage?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: any) => callback(result);
    ipcRenderer.on(IPC.TRANSLATION_RESULT, handler);
    return () => ipcRenderer.removeListener(IPC.TRANSLATION_RESULT, handler);
  },

  onTranslationError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on(IPC.TRANSLATION_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.TRANSLATION_ERROR, handler);
  },

  onLanguagesLoaded: (callback: (languages: any[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, languages: any[]) => callback(languages);
    ipcRenderer.on(IPC.LANGUAGES_LOADED, handler);
    return () => ipcRenderer.removeListener(IPC.LANGUAGES_LOADED, handler);
  },

  onConnectionStatus: (callback: (connected: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, connected: boolean) => callback(connected);
    ipcRenderer.on(IPC.CONNECTION_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC.CONNECTION_STATUS, handler);
  },
});
