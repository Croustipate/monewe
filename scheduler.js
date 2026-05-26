import cron from 'node-cron'
import 'dotenv/config'

let syncInProgress = false

export function startScheduler(db, runSync) {
  const hour = process.env.SYNC_HOUR || '2'
  cron.schedule(`0 ${hour} * * *`, async () => {
    if (syncInProgress) return
    syncInProgress = true
    try {
      console.log(`[${new Date().toISOString()}] Synchro automatique démarrée`)
      const result = await runSync(db)
      console.log(`[${new Date().toISOString()}] Synchro terminée — ${result.tickets_new} nouveaux tickets`)
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Erreur synchro:`, err.message)
    } finally {
      syncInProgress = false
    }
  })
  console.log(`Planificateur démarré — synchro quotidienne à ${hour}h00`)
}

export function isSyncInProgress() {
  return syncInProgress
}

export async function triggerSync(db, runSync) {
  if (syncInProgress) throw new Error('Une synchronisation est déjà en cours')
  syncInProgress = true
  try {
    return await runSync(db)
  } finally {
    syncInProgress = false
  }
}
