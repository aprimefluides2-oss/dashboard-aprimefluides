'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"

/** Annule un accord en brouillon (statut → ANNULE). */
export default function AnnulerAccordButton({ accordId }: { accordId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function annuler() {
    if (!confirm("Annuler cet accord ? Il restera dans l'historique avec le statut « Annulé ».")) {
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/accords/${accordId}/annuler`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || `Erreur (HTTP ${res.status})`)
        setBusy(false)
        return
      }
      router.refresh()
    } catch {
      alert('Erreur réseau — réessaie.')
      setBusy(false)
    }
  }

  return (
    <button
      onClick={annuler}
      disabled={busy}
      className="text-xs font-semibold text-slate-400 hover:text-red-600 disabled:opacity-50"
    >
      {busy ? 'Annulation…' : 'Annuler cet accord'}
    </button>
  )
}
