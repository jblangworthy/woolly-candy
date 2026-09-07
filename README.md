# woolly-candy

A macOS menu bar app for translating text. Select text anywhere, double-tap Cmd+C, and a popup appears with the translation.

Uses [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) running locally — no API keys, no cloud services, everything stays on your machine.

## Install (one command)

Requires Python 3 and macOS 12+.

```bash
git clone https://github.com/jblangworthy/woolly-candy.git
cd woolly-candy
npm install
npm run build:app
bash install.sh
```

The install script will:

1. Create a Python virtual environment at `~/.woolly-candy/venv/`
2. Install LibreTranslate into it
3. Ask which languages you want (downloads ~500 MB per pair)
4. Copy the app to `/Applications`

After that, open **woolly-candy** from `/Applications` or Spotlight. It starts LibreTranslate automatically.

## Usage

1. Select text in any app
2. Tap **Cmd+C** twice quickly (within 500ms)
3. A popup appears with the translation

From the popup you can:

- **Swap** the translation direction with the ⇄ button
- **Expand** to a side-by-side view to edit the source text
- **Copy** the translation to your clipboard
- **Replace** the original selected text with the translation
- **Change languages** via the dropdowns
- **Manage languages** via the ⚙ settings button

The app lives in your menu bar (no dock icon). Right-click the tray icon for options including "Launch at Login".

## Development

```bash
npm install
npm run build:native
npm start
```

LibreTranslate must be running on `localhost:5000`. If you have it installed globally:

```bash
libretranslate
```

Or from the woolly-candy venv (created by `install.sh`):

```bash
~/.woolly-candy/venv/bin/libretranslate
```

## Build the .app

```bash
npm run build:app
```

Produces `out/woolly-candy.app`. Drag it to `/Applications` or run `bash install.sh` to install with LibreTranslate.

## How it works

- **Electron** app with a frameless, transparent popup window
- A **Swift CLI binary** polls `NSPasteboard.changeCount` to detect the double Cmd+C without needing accessibility permissions
- **LibreTranslate** runs as a local HTTP server; the app auto-starts and stops it
- Translation models are from [Argos Translate](https://github.com/argosopentech/argos-translate), stored in the venv

## Project structure

```
src/
  main.ts                    # App entry, IPC handlers, orchestration
  main/
    clipboard-monitor.ts     # Spawns Swift binary, detects double-tap
    translation-service.ts   # HTTP client for LibreTranslate
    window-manager.ts        # Popup window lifecycle
    tray-manager.ts          # Menu bar icon and context menu
    libretranslate-manager.ts # Auto-start/stop LibreTranslate
    store.ts                 # Preferences (JSON file)
  preload.ts                 # IPC bridge for renderer
  renderer.ts                # UI logic
  renderer/styles.css        # Styling
native/
  clipboard-monitor.swift    # Pasteboard polling
scripts/
  build-app.sh               # Builds the .app bundle
```
