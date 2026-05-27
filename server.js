import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { initDb, getTickets, getSummary, getLastSync, getTicketHtml, setTicketHtml, getUncachedIds, getCacheStats } from './db.js'
import { runSync, getAuthCookies } from './scraper.js'
import { startScheduler, triggerSync, isSyncInProgress } from './scheduler.js'

const __metaFile = fileURLToPath(import.meta.url)
// Dans un binaire compilé Bun, les sources sont embarquées sous /$bunfs/
// On utilise alors le répertoire du binaire pour trouver public/ et tickets.db
const __dirname = __metaFile.startsWith('/$bunfs/')
  ? dirname(process.execPath)
  : dirname(__metaFile)
const app = express()
const db = initDb()

// Cache des cookies de session MONEWEB (valide 4h)
let _cookieCache = { str: null, ts: 0 }
const COOKIE_TTL = 4 * 60 * 60 * 1000

async function getCachedCookies() {
  if (_cookieCache.str && Date.now() - _cookieCache.ts < COOKIE_TTL) return _cookieCache.str
  const str = await getAuthCookies()
  _cookieCache = { str, ts: Date.now() }
  return str
}

async function fetchTicketDisplay(id) {
  const cookieStr = await getCachedCookies()
  const r = await fetch(`${process.env.MONEWEB_URL}/clients/api/ticket/display/${id}`, {
    headers: { Cookie: cookieStr, 'X-Requested-With': 'XMLHttpRequest' }
  })
  if (r.status === 401 || r.status === 403) {
    _cookieCache = { str: null, ts: 0 }
    const freshCookies = await getCachedCookies()
    const r2 = await fetch(`${process.env.MONEWEB_URL}/clients/api/ticket/display/${id}`, {
      headers: { Cookie: freshCookies, 'X-Requested-With': 'XMLHttpRequest' }
    })
    return r2.json()
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

app.use(express.json())
app.use(express.static(join(__dirname, 'public')))

app.get('/api/tickets', (req, res) => {
  const { from, to } = req.query
  res.json({ tickets: getTickets(db, { from, to }) })
})

app.get('/api/summary', (req, res) => {
  const { from, to } = req.query
  res.json({ summary: getSummary(db, { from, to }) })
})

app.get('/api/sync/status', (req, res) => {
  res.json({ last_sync: getLastSync(db), in_progress: isSyncInProgress() })
})

app.post('/api/sync/trigger', async (req, res) => {
  try {
    const result = await triggerSync(db, runSync)
    res.json({ success: true, tickets_new: result.tickets_new })
    runWarmup(getUncachedIds(db))
  } catch (err) {
    res.status(409).json({ success: false, error: err.message })
  }
})

app.get('/api/ticket/:id/display', async (req, res) => {
  const id = req.params.id
  const cached = getTicketHtml(db, id)
  if (cached) return res.json({ html: cached })
  try {
    const data = await fetchTicketDisplay(id)
    if (data.html) setTicketHtml(db, id, data.html)
    res.json({ html: data.html ?? null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/cache/status', (_req, res) => {
  res.json(getCacheStats(db))
})

app.post('/api/cache/warmup', (_req, res) => {
  const ids = getUncachedIds(db)
  res.json({ queued: ids.length })
  runWarmup(ids)
})

async function runWarmup(ids) {
  if (!ids.length) return
  let i = 0
  async function worker() {
    while (i < ids.length) {
      const id = ids[i++]
      try {
        const data = await fetchTicketDisplay(id)
        if (data.html) setTicketHtml(db, id, data.html)
      } catch {}
    }
  }
  await Promise.all([worker(), worker(), worker(), worker(), worker()])
  const { cached, total } = getCacheStats(db)
  console.log(`Cache HTML : ${cached}/${total} tickets`)
}

app.get('/api/export/csv', (req, res) => {
  const { from, to } = req.query
  const tickets = getTickets(db, { from, to })
  const header = 'Date,Libellé,Montant (€),Solde (€)\n'
  const rows = tickets.map(t =>
    `"${t.date}","${(t.label || '').replace(/"/g, '""')}",${t.amount},${t.balance ?? ''}`
  ).join('\n')
  const filename = `moneweb-${from || 'debut'}-${to || 'fin'}.csv`
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send('﻿' + header + rows)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`monewe démarré sur http://localhost:${PORT}`)
  startScheduler(db, runSync)
  const { cached, total } = getCacheStats(db)
  console.log(`Cache HTML : ${cached}/${total} tickets en cache`)
  if (cached < total) runWarmup(getUncachedIds(db))
})
