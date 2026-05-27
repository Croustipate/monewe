import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, renameSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const target = process.argv[2] || 'arm64'
const DIST = resolve(__dirname, 'dist')
if (!existsSync(DIST)) mkdirSync(DIST)

const sqliteShimPath = resolve(__dirname, 'bun-sqlite-compat.js')

const sqlitePlugin = {
  name: 'better-sqlite3-shim',
  setup(build) {
    build.onResolve({ filter: /^better-sqlite3$/ }, () => ({
      path: sqliteShimPath
    }))
  }
}

const TARGETS = {
  arm64: { bunTarget: 'bun-darwin-arm64', out: `${DIST}/monewe-mac-arm64` },
  x64:   { bunTarget: 'bun-darwin-x64',   out: `${DIST}/monewe-mac-x64` },
  win:   { bunTarget: 'bun-windows-x64',  out: `${DIST}/monewe-windows.exe` },
}

const toBuild = target === 'all' ? Object.keys(TARGETS) : [target]

for (const t of toBuild) {
  const { bunTarget, out } = TARGETS[t]
  console.log(`--> ${t} (${bunTarget})`)
  const result = await Bun.build({
    entrypoints: [resolve(__dirname, 'server.js')],
    outdir: DIST,
    target: bunTarget,
    compile: true,
    plugins: [sqlitePlugin],
    minify: true,
  })
  if (!result.success) {
    console.error('ERREUR:', result.logs)
    process.exit(1)
  }
  // Bun nomme le binaire d'après l'entrypoint (server) — on renomme
  const bunDefault = resolve(DIST, t === 'win' ? 'server.exe' : 'server')
  if (existsSync(bunDefault)) renameSync(bunDefault, out)
  console.log(`    OK → ${out}`)
}

console.log('\nBinaires créés dans dist/')
