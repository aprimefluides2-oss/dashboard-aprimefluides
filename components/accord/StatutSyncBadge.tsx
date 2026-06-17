'use client'
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { countPendingAccords } from "@/lib/accord/offline-store"
import { syncPendingAccords } from "@/lib/accord/sync"

/**
 * Badge du hub /accord : nombre d'accords en attente de synchronisation.
 * Tente une synchro au montage et à chaque retour du réseau (`online`).
 */
export default function StatutSyncBadge() {
  const router = useRouter()
  const [count, setCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const runSync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        setCount(await countPendingAccords())
      } catch {
        /* IndexedDB indisponible */
      }
      return
    }
    setSyncing(true)
    try {
      const r = await syncPendingAccords()
      setCount(r.remaining)
      if (r.synced > 0) {
        const s = r.synced > 1 ? 's' : ''
        setFlash(`${r.synced} accord${s} synchronisé${s}`)
        router.refresh()
        setTimeout(() => setFlash(null), 4000)
      }
    } finally {
      setSyncing(false)
    }
  }, [router])

  useEffect(() => {
    let alive = true
    countPendingAccords()
      .then(c => {
        if (alive) setCount(c)
      })
      .catch(() => {})
      .finally(() => {
        void runSync()
      })
    function onOnline() {
      void runSync()
    }
    window.addEventListener('online', onOnline)
    return () => {
      alive = false
      window.removeEventListener('online', onOnline)
    }
  }, [runSync])

  if (count === 0 && !flash) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
      <div className="text-sm text-amber-800">
        {flash ? (
          <span className="font-semibold text-emerald-700">✓ {flash}</span>
        ) : (
          <>
            <span className="font-bold">{count}</span> accord{count > 1 ? 's' : ''} en attente de
            synchronisation
          </>
        )}
      </div>
      {count > 0 && (
        <button
          onClick={() => void runSync()}
          disabled={syncing}
          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-60 transition shrink-0"
        >
          {syncing ? 'Synchro…' : 'Synchroniser'}
        </button>
      )}
    </div>
  )
}
