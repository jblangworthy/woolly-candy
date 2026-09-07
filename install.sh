#!/bin/bash
set -e

WOOLLY_DIR="$HOME/.woolly-candy"
VENV_DIR="$WOOLLY_DIR/venv"
APP_SOURCE="$(cd "$(dirname "$0")" && pwd)/out/woolly-candy.app"

echo "woolly-candy installer"
echo "======================"
echo ""

# 1. Check prerequisites
if ! command -v python3 &>/dev/null; then
  echo "Error: python3 is required. Install it from https://python.org or via:"
  echo "  brew install python3"
  exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Found Python $PYTHON_VERSION"

# 2. Check that the .app exists
if [ ! -d "$APP_SOURCE" ]; then
  echo "Error: woolly-candy.app not found at $APP_SOURCE"
  echo "Run 'npm run build:app' first to build it."
  exit 1
fi

# 3. Create venv and install LibreTranslate
echo ""
echo "Setting up LibreTranslate..."
mkdir -p "$WOOLLY_DIR"

if [ ! -f "$VENV_DIR/bin/libretranslate" ]; then
  echo "  Creating virtual environment at $VENV_DIR..."
  python3 -m venv "$VENV_DIR"

  echo "  Installing LibreTranslate (this may take a minute)..."
  "$VENV_DIR/bin/pip" install --quiet --upgrade pip
  "$VENV_DIR/bin/pip" install --quiet libretranslate
else
  echo "  LibreTranslate already installed."
fi

# 4. List available languages and let user choose
echo ""
echo "Fetching available language pairs..."

AVAILABLE=$("$VENV_DIR/bin/python" -c "
from argostranslate import package as pkg
pkg.update_package_index()
available = pkg.get_available_packages()
langs = {}
for p in available:
    langs.setdefault(p.from_code, p.from_name)
    langs.setdefault(p.to_code, p.to_name)
for code in sorted(langs):
    print(f'{code}:{langs[code]}')
")

echo ""
echo "Available languages:"
echo ""
i=1
declare -a LANG_CODES
declare -a LANG_NAMES
while IFS=: read -r code name; do
  LANG_CODES+=("$code")
  LANG_NAMES+=("$name")
  printf "  %2d) %s (%s)\n" "$i" "$name" "$code"
  i=$((i + 1))
done <<< "$AVAILABLE"

echo ""
echo "Enter the numbers of languages you want, separated by spaces."
echo "Each selected language will be able to translate to/from every other."
echo "Example: 1 5 10"
echo ""

# Show which are already installed
INSTALLED=$("$VENV_DIR/bin/python" -c "
from argostranslate import package as pkg
installed = {p.from_code for p in pkg.get_installed_packages()} | {p.to_code for p in pkg.get_installed_packages()}
print(' '.join(sorted(installed)))
")

if [ -n "$INSTALLED" ]; then
  echo "Already installed: $INSTALLED"
  echo ""
fi

read -p "Languages (or 'skip' to keep current): " SELECTION

if [ "$SELECTION" = "skip" ] || [ -z "$SELECTION" ]; then
  echo "Keeping existing language models."
else
  # Parse selection into language codes
  SELECTED_CODES=()
  for num in $SELECTION; do
    idx=$((num - 1))
    if [ "$idx" -ge 0 ] && [ "$idx" -lt "${#LANG_CODES[@]}" ]; then
      SELECTED_CODES+=("${LANG_CODES[$idx]}")
    else
      echo "Warning: '$num' is not a valid selection, skipping."
    fi
  done

  if [ ${#SELECTED_CODES[@]} -lt 2 ]; then
    echo "Need at least 2 languages to form translation pairs. Skipping."
  else
    echo ""
    echo "Selected: ${SELECTED_CODES[*]}"
    echo "Installing language pairs..."

    # Build all pairs between selected languages
    PAIRS=""
    for src in "${SELECTED_CODES[@]}"; do
      for tgt in "${SELECTED_CODES[@]}"; do
        if [ "$src" != "$tgt" ]; then
          PAIRS="$PAIRS $src:$tgt"
        fi
      done
    done

    "$VENV_DIR/bin/python" -c "
import sys
from argostranslate import package as pkg

pkg.update_package_index()
available = pkg.get_available_packages()
installed_codes = {(p.from_code, p.to_code) for p in pkg.get_installed_packages()}

pairs = '${PAIRS}'.strip().split()
for pair in pairs:
    src, tgt = pair.split(':')
    if (src, tgt) in installed_codes:
        print(f'  {src} → {tgt}: already installed')
        continue
    match = next((p for p in available if p.from_code == src and p.to_code == tgt), None)
    if match:
        print(f'  {src} → {tgt}: downloading...')
        pkg.install_from_path(match.download())
        print(f'  {src} → {tgt}: done')
    else:
        print(f'  {src} → {tgt}: not available (may need an intermediate language)')
"
  fi
fi

# 5. Copy app to /Applications
echo ""
if [ -d "/Applications/woolly-candy.app" ]; then
  echo "Updating /Applications/woolly-candy.app..."
  rm -rf "/Applications/woolly-candy.app"
else
  echo "Installing to /Applications..."
fi
cp -R "$APP_SOURCE" "/Applications/woolly-candy.app"

# 6. Clear quarantine attribute (unsigned app)
xattr -rd com.apple.quarantine "/Applications/woolly-candy.app" 2>/dev/null || true

echo ""
echo "Installation complete!"
echo ""
echo "  App:            /Applications/woolly-candy.app"
echo "  LibreTranslate: $VENV_DIR/bin/libretranslate"
echo ""
echo "Launch woolly-candy from /Applications (or Spotlight)."
echo "The app starts LibreTranslate automatically — no extra steps."
echo ""
echo "Usage: select text anywhere, then tap Cmd+C twice quickly."
