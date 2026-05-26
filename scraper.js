import { chromium } from 'playwright'
import 'dotenv/config'
import { insertTicket, logSync } from './db.js'

export async function getAuthCookies() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(`${process.env.MONEYWEB_URL}/clients#/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="ID"]', process.env.MONEYWEB_ID)
  await page.fill('input[name="Password"]', process.env.MONEYWEB_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(3000)

  const cookies = await browser.contexts()[0].cookies()
  await browser.close()

  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
  if (!cookieStr.includes('__Auth')) {
    throw new Error('Auth échouée : cookie __Auth absent')
  }
  return cookieStr
}

export async function collectTickets(cookieStr, db) {
  const res = await fetch(`${process.env.MONEYWEB_URL}/clients/api/compte/dashboard`, {
    method: 'POST',
    headers: {
      'Cookie': cookieStr,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: '{}'
  })

  if (!res.ok) throw new Error(`Dashboard API erreur HTTP ${res.status}`)

  const data = await res.json()
  const items = data.Tickets?.List ?? []

  let inserted = 0
  for (const item of items) {
    const ticket = {
      id:       String(item.IdTicket),
      date:     item.DateTicket,
      amount:   Math.round((item.NouveauSolde - item.AncienSolde) * 100) / 100,
      label:    item.Activite || '',
      location: '',
      balance:  item.NouveauSolde,
      raw_json: JSON.stringify(item)
    }
    const result = insertTicket(db, ticket)
    if (result.changes > 0) inserted++
  }

  return { total: items.length, inserted }
}

export async function runSync(db) {
  const started_at = new Date().toISOString()
  try {
    const cookieStr = await getAuthCookies()
    const { total, inserted } = await collectTickets(cookieStr, db)
    logSync(db, {
      started_at,
      finished_at: new Date().toISOString(),
      status: 'success',
      tickets_new: inserted,
      error_msg: null
    })
    return { success: true, total, tickets_new: inserted }
  } catch (err) {
    logSync(db, {
      started_at,
      finished_at: new Date().toISOString(),
      status: 'error',
      tickets_new: 0,
      error_msg: err.message
    })
    throw err
  }
}
