/**
 * Synchronisation des accords créés hors-ligne.
 * Rejoue la file IndexedDB vers /api/accords ; le serveur déduplique sur
 * `local_id`. À n'importer que côté client.
 */
import {
  listPendingAccords,
  removePendingAccord,
  countPendingAccords,
} from "@/lib/accord/offline-store"

export type SyncResult = {
  synced: number
  failed: number
  remaining: number
}

// Évite deux passes de sync concurrentes (montage + événement `online`).
let running = false

async function safeCount(): Promise<number> {
  try {
    return await countPendingAccords()
  } catch {
    return 0
  }
}

/**
 * Rejoue tous les accords en attente. Un échec réseau garde l'accord dans la
 * file (réessai ultérieur) ; une réponse 2xx ou 409 (déjà présent) le retire.
 */
export async function syncPendingAccords(): Promise<SyncResult> {
  if (running) return { synced: 0, failed: 0, remaining: await safeCount() }
  running = true
  let synced = 0
  let failed = 0
  try {
    const pending = await listPendingAccords()
    for (const item of pending) {
      try {
        const res = await fetch('/api/accords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        })
        // 2xx = créé · 409 = conflit définitif (déjà présent) → on retire.
        if (res.ok || res.status === 409) {
          await removePendingAccord(item.local_id)
          synced++
        } else {
          failed++
        }
      } catch {
        // Réseau indisponible — on conserve l'accord pour un prochain essai.
        failed++
      }
    }
  } finally {
    running = false
  }
  return { synced, failed, remaining: await safeCount() }
}
