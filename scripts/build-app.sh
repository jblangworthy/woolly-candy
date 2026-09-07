#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$PROJECT_DIR/out"
ELECTRON_CACHE="$HOME/Library/Caches/electron"

cd "$PROJECT_DIR"

echo "Building woolly-candy.app..."

# 1. Build the native clipboard monitor
echo "  Compiling native binary..."
bash native/build-native.sh ./native

# 2. Build with Vite (production)
echo "  Building main process..."
rm -rf .vite
npx vite build --config vite.build.main.config.ts 2>/dev/null
echo "  Building preload..."
npx vite build --config vite.build.preload.config.ts 2>/dev/null
echo "  Building renderer..."
npx vite build --config vite.build.renderer.config.ts 2>/dev/null

# 3. Find the cached Electron zip
ELECTRON_VERSION=$(node -e "console.log(require('./package.json').devDependencies.electron.replace('^',''))")
ZIP_FILE=$(find "$ELECTRON_CACHE" -name "electron-v${ELECTRON_VERSION}-darwin-arm64.zip" 2>/dev/null | head -1)

if [ -z "$ZIP_FILE" ]; then
  echo "Error: Electron zip not found. Run 'npm start' once to download it."
  exit 1
fi

# 4. Extract Electron template
echo "  Assembling app bundle..."
BUILD_DIR="$(mktemp -d)"
cd "$BUILD_DIR"
unzip -q "$ZIP_FILE"
mv Electron.app woolly-candy.app

# 5. Rename executable
mv "woolly-candy.app/Contents/MacOS/Electron" "woolly-candy.app/Contents/MacOS/woolly-candy"

# 6. Remove default app
rm -f "woolly-candy.app/Contents/Resources/default_app.asar"

# 7. Copy built app code
mkdir -p "woolly-candy.app/Contents/Resources/app"
cp "$PROJECT_DIR/package.json" "woolly-candy.app/Contents/Resources/app/package.json"
cp -R "$PROJECT_DIR/.vite" "woolly-candy.app/Contents/Resources/app/.vite"

# 8. Copy extra resources
cp "$PROJECT_DIR/native/clipboard-monitor" "woolly-candy.app/Contents/Resources/clipboard-monitor"
cp "$PROJECT_DIR/assets/tray-icon.png" "woolly-candy.app/Contents/Resources/tray-icon.png"

# 9. Write Info.plist
cat > "woolly-candy.app/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDisplayName</key>
	<string>woolly-candy</string>
	<key>CFBundleExecutable</key>
	<string>woolly-candy</string>
	<key>CFBundleIconFile</key>
	<string>electron.icns</string>
	<key>CFBundleIdentifier</key>
	<string>com.woollycandy.app</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>woolly-candy</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0.0</string>
	<key>CFBundleVersion</key>
	<string>1.0.0</string>
	<key>LSApplicationCategoryType</key>
	<string>public.app-category.utilities</string>
	<key>LSUIElement</key>
	<true/>
	<key>LSEnvironment</key>
	<dict>
		<key>MallocNanoZone</key>
		<string>0</string>
	</dict>
	<key>LSMinimumSystemVersion</key>
	<string>12.0</string>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<true/>
	</dict>
	<key>NSHighResolutionCapable</key>
	<true/>
	<key>NSMainNibFile</key>
	<string>MainMenu</string>
	<key>NSPrefersDisplaySafeAreaCompatibilityMode</key>
	<false/>
	<key>NSPrincipalClass</key>
	<string>AtomApplication</string>
	<key>NSQuitAlwaysKeepsWindows</key>
	<false/>
	<key>NSRequiresAquaSystemAppearance</key>
	<false/>
	<key>NSSupportsAutomaticGraphicsSwitching</key>
	<true/>
</dict>
</plist>
PLIST

# 10. Move to output
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
mv "woolly-candy.app" "$OUT_DIR/woolly-candy.app"

# 11. Clean up
rm -rf "$BUILD_DIR"

echo ""
echo "Done: $OUT_DIR/woolly-candy.app ($(du -sh "$OUT_DIR/woolly-candy.app" | cut -f1))"
echo "To install: drag woolly-candy.app to /Applications"
