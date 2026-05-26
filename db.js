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
  // Migration : ajout de la colonne ticket_html si elle n'existe pas encore
  try { db.exec('ALTER TABLE tickets ADD COLUMN ticket_html TEXT') } catch {}
  return db
}

export function getTicketHtml(db, id) {
  const row = db.prepare('SELECT ticket_html FROM tickets WHERE id = ?').get(String(id))
  return row?.ticket_html ?? null
}

export function setTicketHtml(db, id, html) {
  db.prepare('UPDATE tickets SET ticket_html = ? WHERE id = ?').run(html, String(id))
}

export function getUncachedIds(db) {
  return db.prepare('SELECT id FROM tickets WHERE ticket_html IS NULL').all().map(r => r.id)
}

export function getCacheStats(db) {
  const { total } = db.prepare('SELECT COUNT(*) as total FROM tickets').get()
  const { cached } = db.prepare('SELECT COUNT(*) as cached FROM tickets WHERE ticket_html IS NOT NULL').get()
  return { total, cached }
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

  const dateFilter = conditions.length ? ' AND ' + conditions.join(' AND ') : ''

  // Passages cantine : tous tickets où TotalPlateau > 0 (inclut les tickets combinés)
  const spending = db.prepare(`
    SELECT
      COUNT(*) as count,
      -SUM(json_extract(raw_json, '$.TotalPlateau')) as total,
      -AVG(json_extract(raw_json, '$.TotalPlateau')) as average
    FROM tickets
    WHERE json_extract(raw_json, '$.TotalPlateau') > 0${dateFilter}
  `).get(...params)

  // Rechargements : somme de TotalFinancier pour tous les tickets où TotalFinancier > 0
  const { total: credited } = db.prepare(`
    SELECT COALESCE(SUM(json_extract(raw_json, '$.TotalFinancier')), 0) as total
    FROM tickets
    WHERE json_extract(raw_json, '$.TotalFinancier') > 0${dateFilter}
  `).get(...params)

  const lastRow = db.prepare('SELECT balance FROM tickets ORDER BY date DESC LIMIT 1').get()

  return {
    count:        spending.count,
    total:        spending.total   != null ? -Math.abs(spending.total)   : null,
    average:      spending.average != null ? -Math.abs(spending.average) : null,
    credited,
    last_balance: lastRow?.balance ?? null
  }
}

export function pruneOldTickets(db) {
  const cutoffYear = new Date().getFullYear() - 4
  const cutoff = `${cutoffYear}-01-01T00:00:00`
  return db.prepare('DELETE FROM tickets WHERE date < ?').run(cutoff)
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
