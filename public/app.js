const state = { from: null, to: null }

function toISO(date) { return date.toISOString().split('T')[0] }

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatAmount(amount) {
  return (amount >= 0 ? '+' : '') + amount.toFixed(2) + ' €'
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function setShortcut(shortcut) {
  const now = new Date()
  let from, to
  switch (shortcut) {
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      break
    case 'last-month':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      to   = new Date(now.getFullYear(), now.getMonth(), 0)
      break
    case '3months':
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      to   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      break
    case 'year':
      from = new Date(now.getFullYear(), 0, 1)
      to   = new Date(now.getFullYear(), 11, 31)
      break
  }
  document.getElementById('date-from').value = toISO(from)
  document.getElementById('date-to').value   = toISO(to)
  state.from = toISO(from)
  state.to   = toISO(to)
  loadData()
}

async function loadData() {
  const params = new URLSearchParams()
  if (state.from) params.set('from', state.from)
  if (state.to)   params.set('to',   state.to)
  const [{ tickets }, { summary }] = await Promise.all([
    fetch(`/api/tickets?${params}`).then(r => r.json()),
    fetch(`/api/summary?${params}`).then(r => r.json())
  ])
  renderTickets(tickets)
  renderSummary(summary)
}

let _tickets = []

function expandTicket(t) {
  const raw = t.raw_json ? JSON.parse(t.raw_json) : {}
  const fin = raw.TotalFinancier || 0
  const pla = raw.TotalPlateau   || 0

  if (fin > 0 && pla > 0) {
    // Rechargement + repas au même passage
    const balInter = Math.round((raw.AncienSolde + fin) * 100) / 100
    return [
      { _label: 'RECHARGEMENT', _amount: fin,  _balance: balInter,        _raw: t },
      { _label: t.label || 'SELF', _amount: -pla, _balance: raw.NouveauSolde, _raw: t }
    ]
  }
  if (fin > 0 && pla === 0) {
    // Rechargement pur (parfois étiqueté SELF par l'API)
    return [{ _label: 'RECHARGEMENT', _amount: fin, _balance: raw.NouveauSolde, _raw: t }]
  }
  return [{ _label: t.label, _amount: t.amount, _balance: t.balance, _raw: t }]
}

function renderTickets(tickets) {
  _tickets = tickets ?? []
  const tbody = document.getElementById('tickets-body')
  if (!_tickets.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Aucun ticket sur cette période</td></tr>'
    return
  }
  const rows = _tickets.flatMap((t, i) => expandTicket(t).map(r => ({ ...r, _idx: i })))
  tbody.innerHTML = rows.map((r, ri) => `
    <tr>
      <td>${esc(formatDate(r._raw.date))}</td>
      <td>${esc(r._label) || '—'}</td>
      <td class="${r._amount < 0 ? 'amount-negative' : 'amount-positive'}">${formatAmount(r._amount)}</td>
      <td>${r._balance != null ? r._balance.toFixed(2) + ' €' : '—'}</td>
      <td><button class="btn-ticket" data-ri="${ri}">Voir</button></td>
    </tr>
  `).join('')
  tbody.querySelectorAll('.btn-ticket').forEach(btn =>
    btn.addEventListener('click', () => openTicketModal(_tickets[rows[+btn.dataset.ri]._idx]))
  )
}

async function openTicketModal(t) {
  const raw = t.raw_json ? JSON.parse(t.raw_json) : {}
  const ticketId = raw.IdTicket ?? t.id
  const content = document.getElementById('ticket-receipt-content')
  content.innerHTML = '<p class="ticket-loading">Chargement du ticket…</p>'
  document.getElementById('ticket-dialog').showModal()

  try {
    const { html, error } = await fetch(`/api/ticket/${ticketId}/display`).then(r => r.json())
    if (error) throw new Error(error)
    content.innerHTML = `<div class="ticket-real">${html}</div>`
  } catch {
    // Fallback sur les données locales si l'API n'est pas disponible
    const ancien  = raw.AncienSolde  != null ? raw.AncienSolde.toFixed(2)  + ' €' : '—'
    const nouveau = raw.NouveauSolde != null ? raw.NouveauSolde.toFixed(2) + ' €' : '—'
    const plateau   = raw.TotalPlateau   > 0 ? raw.TotalPlateau.toFixed(2)   + ' €' : null
    const financier = raw.TotalFinancier > 0 ? raw.TotalFinancier.toFixed(2) + ' €' : null
    content.innerHTML = `
      <h3>TICKET CANTINE</h3>
      <div class="ticket-row"><span>Date</span><span>${esc(formatDate(t.date))}</span></div>
      <div class="ticket-row"><span>Activité</span><span>${esc(t.label || raw.Activite || '—')}</span></div>
      <div class="ticket-row"><span>Ticket n°</span><span>${esc(String(ticketId ?? '—'))}</span></div>
      ${plateau   ? `<div class="ticket-row"><span>Plateau</span><span>${plateau}</span></div>`   : ''}
      ${financier ? `<div class="ticket-row"><span>Financier</span><span>${financier}</span></div>` : ''}
      <div class="ticket-row total"><span>Solde avant</span><span>${ancien}</span></div>
      <div class="ticket-row total"><span>Solde après</span><span>${nouveau}</span></div>
    `
  }
}

document.getElementById('dialog-close').addEventListener('click', () =>
  document.getElementById('ticket-dialog').close()
)
document.getElementById('dialog-print').addEventListener('click', () => window.print())
document.getElementById('ticket-dialog').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.close()
})

function renderSummary(s) {
  document.getElementById('stat-count').textContent    = s?.count   ?? '—'
  document.getElementById('stat-total').textContent    = s?.total   != null ? Math.abs(s.total).toFixed(2)   + ' €' : '—'
  document.getElementById('stat-avg').textContent      = s?.average != null ? Math.abs(s.average).toFixed(2) + ' €' : '—'
  document.getElementById('stat-credited').textContent = s?.credited != null ? s.credited.toFixed(2) + ' €' : '—'
  document.getElementById('stat-balance').textContent  = s?.last_balance != null ? s.last_balance.toFixed(2) + ' €' : '—'
}

async function loadCacheStatus() {
  const { cached, total } = await fetch('/api/cache/status').then(r => r.json())
  const el = document.getElementById('cache-status')
  const btn = document.getElementById('btn-warmup')
  el.textContent = `Cache ${cached}/${total}`
  el.title = cached === total
    ? 'Tous les tickets sont en cache — PDF hors-ligne disponible'
    : `${total - cached} ticket(s) non encore mis en cache`
  btn.style.display = cached < total ? 'inline-block' : 'none'
}

document.getElementById('btn-warmup').addEventListener('click', async () => {
  const btn = document.getElementById('btn-warmup')
  btn.disabled = true
  btn.textContent = 'En cours…'
  await fetch('/api/cache/warmup', { method: 'POST' })
  // Polling jusqu'à complétion
  const poll = setInterval(async () => {
    const { cached, total } = await fetch('/api/cache/status').then(r => r.json())
    document.getElementById('cache-status').textContent = `Cache ${cached}/${total}`
    if (cached >= total) {
      clearInterval(poll)
      btn.style.display = 'none'
      btn.disabled = false
      btn.textContent = 'Mettre en cache'
    }
  }, 1500)
})

async function loadSyncStatus() {
  const { last_sync, in_progress } = await fetch('/api/sync/status').then(r => r.json())
  const el = document.getElementById('sync-status')
  if (in_progress) {
    el.textContent = 'Synchro en cours...'
    el.className = ''
  } else if (last_sync) {
    const d = new Date(last_sync.finished_at).toLocaleString('fr-FR')
    const ok = last_sync.status === 'success'
    el.textContent = `Dernière synchro : ${d} ${ok ? '✓' : '✗'}`
    el.className = ok ? 'status-success' : 'status-error'
  } else {
    el.textContent = 'Jamais synchronisé'
    el.className = ''
  }
}

document.getElementById('date-from').addEventListener('change', e => { state.from = e.target.value; loadData() })
document.getElementById('date-to').addEventListener('change',   e => { state.to   = e.target.value; loadData() })

document.querySelectorAll('[data-shortcut]').forEach(btn =>
  btn.addEventListener('click', () => setShortcut(btn.dataset.shortcut))
)

document.getElementById('btn-sync').addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync')
  btn.disabled = true
  btn.textContent = 'En cours...'
  try {
    await fetch('/api/sync/trigger', { method: 'POST' })
    await loadSyncStatus()
    await loadData()
    await loadCacheStatus()
  } finally {
    btn.disabled = false
    btn.textContent = 'Synchroniser'
  }
})

document.getElementById('btn-export').addEventListener('click', () => {
  const params = new URLSearchParams()
  if (state.from) params.set('from', state.from)
  if (state.to)   params.set('to',   state.to)
  window.location.href = `/api/export/csv?${params}`
})

document.getElementById('btn-pdf-year').addEventListener('click', async () => {
  const btn = document.getElementById('btn-pdf-year')
  const year = new Date().getFullYear()
  btn.disabled = true
  btn.textContent = 'Chargement…'

  try {
    const params = new URLSearchParams({ from: `${year}-01-01`, to: `${year}-12-31` })
    const { tickets } = await fetch(`/api/tickets?${params}`).then(r => r.json())
    if (!tickets?.length) { alert('Aucun ticket pour cette année.'); return }

    // Récupérer les vrais tickets en parallèle (5 à la fois)
    const htmls = new Array(tickets.length).fill(null)
    let done = 0
    async function fetchOne(i) {
      const raw = tickets[i].raw_json ? JSON.parse(tickets[i].raw_json) : {}
      const id = raw.IdTicket ?? tickets[i].id
      try {
        const { html } = await fetch(`/api/ticket/${id}/display`).then(r => r.json())
        htmls[i] = html ?? null
      } catch { htmls[i] = null }
      done++
      btn.textContent = `Chargement ${done}/${tickets.length}…`
    }

    // Pool de concurrence 5
    let idx = 0
    async function worker() {
      while (idx < tickets.length) { await fetchOne(idx++) }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker()])

    // Calculer le total dépensé pour la page de couverture
    const totalDepense = tickets
      .filter(t => { const r = t.raw_json ? JSON.parse(t.raw_json) : {}; return r.TotalPlateau > 0 })
      .reduce((s, t) => { const r = JSON.parse(t.raw_json); return s + r.TotalPlateau }, 0)

    // Générer la page d'impression
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html lang="fr"><head>
      <meta charset="UTF-8"><title>Tickets cantine ${year}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 8.5px; background: #e0e0e0; padding: 8mm; }
        .cover { background: white; text-align: center; padding: 3cm 2cm; page-break-after: always; border-radius: 6px; }
        .cover h1 { font-size: 2.2em; font-family: system-ui, sans-serif; margin-bottom: 0.4em; }
        .cover .sub { font-family: system-ui, sans-serif; font-size: 1.1em; color: #555; line-height: 1.8; }
        .cover .montant { font-size: 1.6em; font-weight: bold; color: #dc2626; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
        .ticket-wrap { background: white; border-radius: 3px; overflow: hidden; break-inside: avoid; box-shadow: 0 2px 6px rgba(0,0,0,.18); }
        .ticket-accent { height: 4px; background: #1d4ed8; }
        .ticket-body { padding: 4mm 3.5mm; line-height: 1.5; }
        .ticket-body pre { white-space: pre-wrap; }
        .ticket-fallback { padding: 4mm 3.5mm; color: #666; font-style: italic; }
        @media print {
          body { background: white; padding: 4mm; }
          .grid { gap: 4mm; }
          .ticket-wrap { box-shadow: none; border: 1px solid #bbb; break-inside: avoid; }
          .ticket-accent { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head><body>
      <div class="cover">
        <h1>Tickets cantine — ${year}</h1>
        <div class="sub">
          ${tickets.length} passages<br>
          Total dépensé : <span class="montant">${totalDepense.toFixed(2)} €</span>
        </div>
      </div>
      <div class="grid">
        ${htmls.map((html, i) => {
          if (html) return `<div class="ticket-wrap"><div class="ticket-accent"></div><div class="ticket-body">${html}</div></div>`
          const t = tickets[i]
          const raw = t.raw_json ? JSON.parse(t.raw_json) : {}
          return `<div class="ticket-wrap"><div class="ticket-accent"></div><div class="ticket-fallback">
            ${new Date(t.date).toLocaleString('fr-FR')}<br>
            ${t.label || '—'} &mdash; ${t.amount >= 0 ? '+' : ''}${t.amount.toFixed(2)} €
          </div></div>`
        }).join('')}
      </div>
    </body></html>`)
    win.document.close()
    win.print()
  } finally {
    btn.disabled = false
    btn.textContent = `PDF année ${year}`
  }
})

setShortcut('month')
loadSyncStatus()
loadCacheStatus()
document.getElementById('pdf-year-label').textContent = new Date().getFullYear()
