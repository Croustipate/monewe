import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { initDb, getTickets, getSummary, getLastSync } from './db.js'
import { runSync } from './scraper.js'
import { startScheduler, triggerSync, isSyncInProgress } from './scheduler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const db = initDb()

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
  } catch (err) {
    res.status(409).json({ success: false, error: err.message })
  }
})

app.get('/api/export/csv', (req, res) => {
  const { from, to } = req.query
  const tickets = getTickets(db, { from, to })
  const header = 'Date,Libellé,Montant (€),Solde (€)\n'
  const rows = tickets.map(t =>
    `"${t.date}","${(t.label || '').replace(/"/g, '""')}",${t.amount},${t.balance ?? ''}`
  ).join('\n')
  const filename = `moneyweb-${from || 'debut'}-${to || 'fin'}.csv`
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send('﻿' + header + rows)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`MONEYWEB démarré sur http://localhost:${PORT}`)
  startScheduler(db, runSync)
})
