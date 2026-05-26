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

function renderTickets(tickets) {
  const tbody = document.getElementById('tickets-body')
  if (!tickets?.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Aucun ticket sur cette période</td></tr>'
    return
  }
  tbody.innerHTML = tickets.map(t => `
    <tr>
      <td>${esc(formatDate(t.date))}</td>
      <td>${esc(t.label) || '—'}</td>
      <td class="${t.amount < 0 ? 'amount-negative' : 'amount-positive'}">${formatAmount(t.amount)}</td>
      <td>${t.balance != null ? t.balance.toFixed(2) + ' €' : '—'}</td>
    </tr>
  `).join('')
}

function renderSummary(s) {
  document.getElementById('stat-count').textContent   = s?.count   ?? '—'
  document.getElementById('stat-total').textContent   = s?.total   != null ? Math.abs(s.total).toFixed(2)   + ' €' : '—'
  document.getElementById('stat-avg').textContent     = s?.average != null ? Math.abs(s.average).toFixed(2) + ' €' : '—'
  document.getElementById('stat-balance').textContent = s?.last_balance != null ? s.last_balance.toFixed(2) + ' €' : '—'
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

setShortcut('month')
loadSyncStatus()
