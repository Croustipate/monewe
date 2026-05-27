// Shim bun:sqlite → API compatible better-sqlite3
// Convertit @name → $name dans les requêtes et { name } → { $name } dans les paramètres
import { Database as BunDatabase } from 'bun:sqlite'

function adaptSql(sql) {
  return sql.replace(/@(\w+)/g, '$$$1')
}

function adaptParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return params
  const out = {}
  for (const [k, v] of Object.entries(params)) {
    out[k.startsWith('$') ? k : `$${k}`] = v
  }
  return out
}

function wrapStmt(stmt) {
  return {
    run(...args) {
      const p = args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? adaptParams(args[0]) : args
      return Array.isArray(p) ? stmt.run(...p) : stmt.run(p)
    },
    get(...args) {
      const p = args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? adaptParams(args[0]) : args
      return Array.isArray(p) ? stmt.get(...p) : stmt.get(p)
    },
    all(...args) {
      const p = args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? adaptParams(args[0]) : args
      return Array.isArray(p) ? stmt.all(...p) : stmt.all(p)
    }
  }
}

class Database {
  constructor(path, opts) { this._db = new BunDatabase(path, opts) }
  exec(sql) { return this._db.exec(sql) }
  prepare(sql) { return wrapStmt(this._db.prepare(adaptSql(sql))) }
}

export default Database
