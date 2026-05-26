#!/usr/bin/env bash
# Build script — crée des distributions autonomes de monewe
# Usage : bash build.sh [arm64|x64|all]
# Prérequis : Node.js, npm (esbuild installé via npx)
set -e

TARGET=${1:-arm64}
DIST=dist
APP_NAME="monewe"

echo "==> Build monewe standalone (Node $(node -e 'console.log(process.version)'))"
mkdir -p "$DIST"

# ------------------------------------------------------------------
# Étape 1 : Bundle JS avec esbuild (tout sauf better-sqlite3 natif)
# ------------------------------------------------------------------
echo "--> Bundle esbuild..."
npx --yes esbuild server.js \
  --bundle \
  --platform=node \
  --format=cjs \
  --target=node18 \
  --outfile="$DIST/server.cjs" \
  --external:better-sqlite3 \
  --banner:js="var __import_meta_url=require('url').pathToFileURL(__filename);" \
  --define:import.meta.url="__import_meta_url"

echo "    Bundle : $DIST/server.cjs ($(du -sh "$DIST/server.cjs" | cut -f1))"

# ------------------------------------------------------------------
# Fonction : construire une distribution pour une cible
# build_dist <nom_dossier> <node_binary_src> <sqlite_node_src>
# ------------------------------------------------------------------
build_dist() {
  local DIR="$DIST/$1"
  local NODE_BIN="$2"
  local SQLITE_NODE="$3"

  echo "--> Création distribution : $DIR"
  rm -rf "$DIR"
  mkdir -p "$DIR/node_modules/better-sqlite3/build/Release"
  mkdir -p "$DIR/node_modules/better-sqlite3/lib"
  mkdir -p "$DIR/node_modules/bindings"
  mkdir -p "$DIR/node_modules/file-uri-to-path"

  # Binaire Node.js
  cp "$NODE_BIN" "$DIR/node"
  chmod +x "$DIR/node"

  # App bundlée
  cp "$DIST/server.cjs" "$DIR/server.cjs"

  # better-sqlite3 (uniquement les fichiers runtime nécessaires)
  cp "$SQLITE_NODE" "$DIR/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
  cp -r node_modules/better-sqlite3/lib/         "$DIR/node_modules/better-sqlite3/lib/"
  cp    node_modules/better-sqlite3/package.json "$DIR/node_modules/better-sqlite3/"
  cp -r node_modules/bindings/                   "$DIR/node_modules/bindings/"
  cp -r node_modules/file-uri-to-path/           "$DIR/node_modules/file-uri-to-path/"

  # Assets statiques
  cp -r public/ "$DIR/public/"
  cp .env.example "$DIR/.env.example"

  # Lanceur macOS (double-clic dans Finder)
  cat > "$DIR/start.command" << 'LAUNCHER'
#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Démarrage de monewe..."
echo "Ouvrez http://localhost:3000 dans votre navigateur"
./node server.cjs
LAUNCHER
  chmod +x "$DIR/start.command"

  # Créer le zip de distribution
  (cd "$DIST" && zip -qr "../$DIST/${1}.zip" "$1/")
  echo "    Distribution prête : $DIST/${1}.zip ($(du -sh "$DIST/${1}.zip" | cut -f1))"
}

# ------------------------------------------------------------------
# Mac ARM64 (Apple Silicon M1/M2/M3)
# ------------------------------------------------------------------
if [[ "$TARGET" == "arm64" || "$TARGET" == "all" ]]; then
  echo "--> Cible : mac-arm64"
  CURRENT_ARCH=$(uname -m)
  if [[ "$CURRENT_ARCH" != "arm64" ]]; then
    echo "    ATTENTION : machine courante ($CURRENT_ARCH), skip arm64"
  else
    build_dist "${APP_NAME}-mac-arm64" \
      "$(which node)" \
      "node_modules/better-sqlite3/build/Release/better_sqlite3.node"
  fi
fi

# ------------------------------------------------------------------
# Mac x64 (Intel)
# Pour construire depuis une machine arm64 :
#   arch -x86_64 npm rebuild better-sqlite3
#   X64_NODE=/path/to/node-x64 X64_SQLITE=/path/to/better_sqlite3-x64.node bash build.sh x64
# ------------------------------------------------------------------
if [[ "$TARGET" == "x64" || "$TARGET" == "all" ]]; then
  echo "--> Cible : mac-x64"
  X64_NODE="${X64_NODE:-}"
  X64_SQLITE="${X64_SQLITE:-}"
  if [[ -z "$X64_NODE" || -z "$X64_SQLITE" ]]; then
    echo "    IGNORÉ — définir X64_NODE et X64_SQLITE pour cette cible"
    echo "    Ex : X64_NODE=/path/to/node-x64 X64_SQLITE=/path/to/better_sqlite3-x64.node bash build.sh x64"
  else
    build_dist "${APP_NAME}-mac-x64" "$X64_NODE" "$X64_SQLITE"
  fi
fi

# ------------------------------------------------------------------
# Windows x64
# Depuis Mac : cross-compilation non supportée pour les bindings natifs.
# Sur une machine Windows avec Node.js + node-gyp : npm install && npm run build
# ------------------------------------------------------------------
if [[ "$TARGET" == "win" || "$TARGET" == "all" ]]; then
  echo "--> Cible : windows-x64 (nécessite build sur machine Windows)"
  echo "    IGNORÉ — voir README pour les instructions Windows"
fi

echo ""
echo "==> Terminé ! Distributions dans : $DIST/"
ls -lh "$DIST/"*.zip 2>/dev/null || true
