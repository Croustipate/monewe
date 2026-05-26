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
  if (raw.TotalFinancier > 0 && raw.TotalPlateau > 0) {
    const balApres = raw.NouveauSolde
    const balInter = Math.round((raw.AncienSolde + raw.TotalFinancier) * 100) / 100
    return [
      { _label: 'RECHARGEMENT', _amount: raw.TotalFinancier,  _balance: balInter, _raw: t },
      { _label: t.label || 'SELF', _amount: -raw.TotalPlateau, _balance: balApres, _raw: t }
    ]
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
  const year = new Date().getFullYear()
  document.getElementById('pdf-year-label').textContent = year
  const params = new URLSearchParams({ from: `${year}-01-01`, to: `${year}-12-31` })
  const { tickets } = await fetch(`/api/tickets?${params}`).then(r => r.json())
  if (!tickets?.length) { alert('Aucun ticket pour cette année.'); return }
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8"><title>Tickets ${year}</title>
    <style>
      body { font-family: monospace; font-size: 12px; margin: 2cm; }
      h1 { text-align: center; margin-bottom: 1em; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #999; padding: 4px 8px; }
      th { background: #eee; }
      .neg { color: #c00; }
      .pos { color: #070; }
      @media print { body { margin: 1cm; } }
    </style>
  </head><body>
    <h1>Tickets cantine — ${year}</h1>
    <table>
      <thead><tr><th>Date</th><th>Activité</th><th>Montant</th><th>Solde</th></tr></thead>
      <tbody>
        ${tickets.map(t => `<tr>
          <td>${new Date(t.date).toLocaleString('fr-FR')}</td>
          <td>${t.label || '—'}</td>
          <td class="${t.amount < 0 ? 'neg' : 'pos'}">${(t.amount >= 0 ? '+' : '') + t.amount.toFixed(2)} €</td>
          <td>${t.balance != null ? t.balance.toFixed(2) + ' €' : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </body></html>`)
  win.document.close()
  win.print()
})

setShortcut('month')
loadSyncStatus()
document.getElementById('pdf-year-label').textContent = new Date().getFullYear()
