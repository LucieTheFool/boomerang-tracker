#!/usr/bin/env bash
# Builds the Linux AppImage and tar.gz inside WSL (Ubuntu 24.04), from a clean copy of this repo.
#
# Run it from Windows, in the repo folder:
#   wsl -d Ubuntu-24.04 -- bash scripts/dist-linux-wsl.sh
#
# What it runs, in order (it installs nothing; it writes only ~/bt-build and <repo>/release/):
#   1. . ~/.nvm/nvm.sh; nvm use 24         only if nvm is installed (a non-interactive bash doesn't load it)
#      node --version, npm --version       Node 24 inside WSL (not Windows' node via /mnt/c); says how to get it if missing
#   2. rm -rf ~/bt-build; mkdir ~/bt-build
#   3. tar -C <repo> -cf - . | tar -C ~/bt-build -xf -
#        leaving out node_modules, release, dist, dist-electron, local, fixtures, .git, *.sav
#        and data/checklist.local.json (saves and local-only data never go into a build)
#   4. cd ~/bt-build && npm ci             (with the repo's package-lock.json)
#   5. npm run dist:linux                  (npm run build && electron-builder --linux AppImage tar.gz)
#   6. npx --yes @electron/asar list release/linux-unpacked/resources/app.asar
#        stops (exit 1, nothing copied back) if anything besides /dist, /dist-electron, /data,
#        /node_modules and /package.json is in it, or data/checklist.local.json is
#   7. cp ~/bt-build/release/*.AppImage ~/bt-build/release/*.tar.gz <repo>/release/
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD="$HOME/bt-build"

need_node() {
  cat >&2 <<'EOF'
Node 24 is needed inside WSL (Windows' own Node can't build the Linux app). Nothing was changed.
Install it in WSL with either of these, then run this script again:
  nvm:        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
              (open a new WSL shell)  nvm install 24
  NodeSource: curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
              sudo apt-get install -y nodejs
EOF
  exit 1
}

# 1. Node 24, the Linux one. nvm only sets PATH from ~/.bashrc, which a non-interactive bash skips.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  set +u
  . "$HOME/.nvm/nvm.sh"
  nvm use 24 >/dev/null 2>&1 || true
  set -u
fi
command -v node >/dev/null 2>&1 || need_node
command -v npm >/dev/null 2>&1 || need_node
case "$(command -v node) $(command -v npm)" in /mnt/*) echo "node/npm come from Windows ($(command -v npm))." >&2; need_node ;; esac
NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
[ "$NODE_MAJOR" -ge 24 ] 2>/dev/null || { echo "Found Node $(node --version)." >&2; need_node; }
echo "Node $(node --version), npm $(npm --version)"

# 2-3. A clean copy, without dependencies, builds, local data or saves.
echo "Copying $REPO to $BUILD"
rm -rf "$BUILD"
mkdir -p "$BUILD"
tar -C "$REPO" --anchored \
  --exclude=./node_modules --exclude=./release --exclude=./dist --exclude=./dist-electron \
  --exclude=./local --exclude=./fixtures --exclude=./.git --exclude='*.sav' \
  --exclude=./data/checklist.local.json \
  -cf - . | tar -C "$BUILD" -xf -

# 4-5. Install and build.
cd "$BUILD"
npm ci
npm run dist:linux

# 6. The package holds the app only: no sources, docs, scripts or local data.
ASAR="$BUILD/release/linux-unpacked/resources/app.asar"
ENTRIES="$(npx --yes @electron/asar list "$ASAR")"
BAD="$(printf '%s\n' "$ENTRIES" | grep -Ev '^/(dist|dist-electron|data|node_modules)(/|$)|^/package\.json$' || true)"
LOCAL="$(printf '%s\n' "$ENTRIES" | grep -E '^/data/checklist\.local\.json$' || true)"
if [ -n "$BAD$LOCAL" ]; then
  echo "app.asar holds files that must not ship (nothing copied back):" >&2
  printf '%s\n' "$BAD" "$LOCAL" | sed '/^$/d; s/^/  /' >&2
  exit 1
fi
echo "app.asar: $(printf '%s\n' "$ENTRIES" | wc -l) entries, all under dist, dist-electron, data, node_modules, package.json"

# 7. Back to the Windows repo.
mkdir -p "$REPO/release"
cp -v "$BUILD"/release/*.AppImage "$BUILD"/release/*.tar.gz "$REPO/release/"
echo "Done: $REPO/release/"
