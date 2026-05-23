import { test } from 'node:test'
import assert from 'node:assert'
import { initDb, insertTicket, getTickets, getSummary, logSync, getLastSync } from '../db.js'

test('initDb crée les tables tickets et sync_log', () => {
  const db = initDb(':memory:')
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
  const names = tables.map(t => t.name)
  assert.ok(names.includes('tickets'))
  assert.ok(names.includes('sync_log'))
})

test('insertTicket insère un ticket et retourne changes=1', () => {
  const db = initDb(':memory:')
  const ticket = {
    id: 'T001', date: '2026-05-23T12:00:00', amount: -5.50,
    label: 'Menu du jour', location: 'Cantine A', balance: 100.00, raw_json: '{"id":"T001"}'
  }
  const result = insertTicket(db, ticket)
  assert.strictEqual(result.changes, 1)
})

test('insertTicket ignore les doublons (changes=0)', () => {
  const db = initDb(':memory:')
  const ticket = {
    id: 'T001', date: '2026-05-23T12:00:00', amount: -5.50,
    label: 'Menu', location: 'A', balance: 100.00, raw_json: '{}'
  }
  insertTicket(db, ticket)
  const result = insertTicket(db, ticket)
  assert.strictEqual(result.changes, 0)
  const tickets = getTickets(db, {})
  assert.strictEqual(tickets.length, 1)
})

test('getTickets filtre par période et trie par date décroissante', () => {
  const db = initDb(':memory:')
  insertTicket(db, { id: 'T001', date: '2026-04-15T12:00:00', amount: -5.50, label: '', location: '', balance: 100, raw_json: '{}' })
  insertTicket(db, { id: 'T002', date: '2026-05-10T12:00:00', amount: -6.00, label: '', location: '', balance: 94, raw_json: '{}' })
  insertTicket(db, { id: 'T003', date: '2026-05-20T12:00:00', amount: -5.80, label: '', location: '', balance: 88, raw_json: '{}' })
  const result = getTickets(db, { from: '2026-05-01', to: '2026-05-31' })
  assert.strictEqual(result.length, 2)
  assert.strictEqual(result[0].id, 'T003')
})

test('getSummary calcule count, total et average', () => {
  const db = initDb(':memory:')
  insertTicket(db, { id: 'T001', date: '2026-05-10T12:00:00', amount: -5.50, label: '', location: '', balance: 100, raw_json: '{}' })
  insertTicket(db, { id: 'T002', date: '2026-05-20T12:00:00', amount: -6.00, label: '', location: '', balance: 94.50, raw_json: '{}' })
  const summary = getSummary(db, { from: '2026-05-01', to: '2026-05-31' })
  assert.strictEqual(summary.count, 2)
  assert.ok(Math.abs(summary.total - (-11.50)) < 0.001)
  assert.ok(Math.abs(summary.average - (-5.75)) < 0.001)
})

test('logSync et getLastSync fonctionnent', () => {
  const db = initDb(':memory:')
  logSync(db, {
    started_at: '2026-05-23T02:00:00.000Z',
    finished_at: '2026-05-23T02:00:05.000Z',
    status: 'success',
    tickets_new: 3,
    error_msg: null
  })
  const last = getLastSync(db)
  assert.strictEqual(last.status, 'success')
  assert.strictEqual(last.tickets_new, 3)
})
