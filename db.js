import Database from 'better-sqlite3'

export function initDb(path = 'tickets.db') {
  const db = new Database(path)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id        TEXT PRIMARY KEY,
      date      TEXT NOT NULL,
      amount    REAL NOT NULL,
      label     TEXT,
      location  TEXT,
      balance   REAL,
      raw_json  TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at  TEXT NOT NULL,
      finished_at TEXT,
      status      TEXT,
      tickets_new INTEGER,
      error_msg   TEXT
    );
  `)
  return db
}

export function insertTicket(db, ticket) {
  return db.prepare(`
    INSERT OR IGNORE INTO tickets (id, date, amount, label, location, balance, raw_json)
    VALUES (@id, @date, @amount, @label, @location, @balance, @raw_json)
  `).run(ticket)
}

export function getTickets(db, { from, to } = {}) {
  const conditions = []
  const params = []
  if (from) { conditions.push('date >= ?'); params.push(from) }
  if (to)   { conditions.push('date <= ?'); params.push(to + 'T23:59:59') }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
  return db.prepare(`SELECT * FROM tickets${where} ORDER BY date DESC`).all(...params)
}

export function getSummary(db, { from, to } = {}) {
  const conditions = []
  const params = []
  if (from) { conditions.push('date >= ?'); params.push(from) }
  if (to)   { conditions.push('date <= ?'); params.push(to + 'T23:59:59') }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
  const row = db.prepare(`
    SELECT COUNT(*) as count, SUM(amount) as total, AVG(amount) as average
    FROM tickets${where}
  `).get(...params)
  const lastRow = db.prepare('SELECT balance FROM tickets ORDER BY date DESC LIMIT 1').get()
  return { ...row, last_balance: lastRow?.balance ?? null }
}

export function logSync(db, { started_at, finished_at, status, tickets_new, error_msg }) {
  return db.prepare(`
    INSERT INTO sync_log (started_at, finished_at, status, tickets_new, error_msg)
    VALUES (?, ?, ?, ?, ?)
  `).run(started_at, finished_at, status, tickets_new, error_msg)
}

export function getLastSync(db) {
  return db.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 1').get()
}
