import 'dotenv/config'
import { insertTicket, logSync, pruneOldTickets } from './db.js'

const HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest'
}

// Permet de désactiver la vérification TLS via NODE_TLS_REJECT_UNAUTHORIZED=0
// Utile derrière un proxy d'entreprise avec inspection SSL
const TLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
  ? { tls: { rejectUnauthorized: false } }
  : {}

export async function getAuthCookies() {
  const res = await fetch(`${process.env.MONEWEB_URL}/clients/api/sign/in`, {
    method: 'POST',
    headers: HEADERS,
    ...TLS,
    body: JSON.stringify({
      ID: (process.env.MONEWEB_ID || '').trim(),
      Password: (process.env.MONEWEB_PASSWORD || '').trim(),
      RememberMe: true
    })
  })

  if (!res.ok) throw new Error(`Login échoué HTTP ${res.status}`)

  // Extraire les cookies depuis les headers Set-Cookie
  const setCookies = res.headers.getSetCookie?.() ?? []
  const cookieStr = setCookies.map(c => c.split(';')[0]).join('; ')

  if (!cookieStr.includes('__Auth')) {
    throw new Error('Auth échouée : cookie __Auth absent')
  }
  return cookieStr
}

export async function collectTickets(cookieStr, db) {
  const res = await fetch(`${process.env.MONEWEB_URL}/clients/api/compte/dashboard`, {
    method: 'POST',
    headers: { ...HEADERS, Cookie: cookieStr },
    ...TLS,
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
    pruneOldTickets(db)
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
