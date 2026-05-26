#!/usr/bin/env bash
# Build script — crée des distributions autonomes de monewe (Mac ARM64 / Mac x64)
# Usage : bash build.sh [arm64|x64|all]
# Prérequis : Node.js universal binary (/usr/local/bin/node), npm, lipo
set -e

TARGET=${1:-arm64}
DIST=dist
APP_NAME="monewe"
NODE_BIN="${NODE_BIN:-$(which node)}"
SQLITE_SRC="node_modules/better-sqlite3/build/Release/better_sqlite3.node"

echo "==> Build $APP_NAME standalone (Node $(node -e 'console.log(process.version)'))"
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
# Fonction : construire une distribution pour une cible Mac
# build_dist <nom_dossier> <arch: arm64|x86_64> <sqlite_node_src>
# ------------------------------------------------------------------
build_dist() {
  local DIR="$DIST/$1"
  local ARCH="$2"
  local SQLITE_NODE="$3"

  echo "--> Création distribution : $DIR ($ARCH)"
  rm -rf "$DIR"
  mkdir -p "$DIR/node_modules/better-sqlite3/build/Release"
  mkdir -p "$DIR/node_modules/better-sqlite3/lib"
  mkdir -p "$DIR/node_modules/bindings"
  mkdir -p "$DIR/node_modules/file-uri-to-path"

  # Extraire la tranche architecturale du fat binary Node.js
  lipo "$NODE_BIN" -extract "$ARCH" -output "$DIR/node" 2>/dev/null \
    || cp "$NODE_BIN" "$DIR/node"
  chmod +x "$DIR/node"

  # App bundlée
  cp "$DIST/server.cjs" "$DIR/server.cjs"

  # better-sqlite3 (fichiers runtime uniquement)
  cp "$SQLITE_NODE" "$DIR/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
  cp -r node_modules/better-sqlite3/lib/         "$DIR/node_modules/better-sqlite3/lib/"
  cp    node_modules/better-sqlite3/package.json "$DIR/node_modules/better-sqlite3/"
  cp -r node_modules/bindings/                   "$DIR/node_modules/bindings/"
  cp -r node_modules/file-uri-to-path/           "$DIR/node_modules/file-uri-to-path/"

  # Assets statiques
  cp -r public/ "$DIR/public/"
  cp .env.example "$DIR/.env.example"

  # Lanceur macOS (double-clic dans le Finder)
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
  echo "    Prêt : $DIST/${1}.zip ($(du -sh "$DIST/${1}.zip" | cut -f1))"
}

# ------------------------------------------------------------------
# Mac ARM64 (Apple Silicon M1/M2/M3)
# ------------------------------------------------------------------
if [[ "$TARGET" == "arm64" || "$TARGET" == "all" ]]; then
  echo "--> Cible : mac-arm64"
  build_dist "${APP_NAME}-mac-arm64" "arm64" "$SQLITE_SRC"
fi

# ------------------------------------------------------------------
# Mac x64 (Intel / Rosetta)
# Nécessite de recompiler better-sqlite3 pour x86_64 :
#   arch -x86_64 npm rebuild better-sqlite3
# Le binaire Node.js x64 est extrait du fat binary universel.
# ------------------------------------------------------------------
if [[ "$TARGET" == "x64" || "$TARGET" == "all" ]]; then
  echo "--> Cible : mac-x64"
  X64_SQLITE="${X64_SQLITE:-}"

  if [[ -z "$X64_SQLITE" ]]; then
    echo "    Recompilation better-sqlite3 pour x86_64 via Rosetta..."
    cp "$SQLITE_SRC" "/tmp/better_sqlite3_arm64.node"
    if arch -x86_64 npm rebuild better-sqlite3 --build-from-source 2>&1 | tail -3; then
      X64_SQLITE="$SQLITE_SRC"
    else
      echo "    IGNORÉ — recompilation x64 échouée (relancer avec X64_SQLITE=/chemin/vers/better_sqlite3-x64.node bash build.sh x64)"
      cp "/tmp/better_sqlite3_arm64.node" "$SQLITE_SRC"
      X64_SQLITE=""
    fi
    # Restaurer arm64 pour ne pas casser l'env de dev
    cp "/tmp/better_sqlite3_arm64.node" "$SQLITE_SRC"
  fi

  [[ -n "$X64_SQLITE" ]] && build_dist "${APP_NAME}-mac-x64" "x86_64" "$X64_SQLITE" \
    || echo "    Distribution mac-x64 ignorée."
fi

echo ""
echo "==> Terminé ! Distributions dans : $DIST/"
ls -lh "$DIST/"*.zip 2>/dev/null || true
