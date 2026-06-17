'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"
import { fmtDateFR } from "@/lib/format"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Props = {
  accordId: string
  clientEmail: string | null
  pdfUrl: string | null
  copieEnvoyeeAt: string | null
}

/** Envoie au client la copie PDF de l'accord par email. */
export default function EnvoyerCopieButton({ accordId, clientEmail, pdfUrl, copieEnvoyeeAt }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState(clientEmail || '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!pdfUrl) {
    return (
      <p className="text-xs text-slate-400">
        Génère d&apos;abord le PDF ci-dessus pour pouvoir l&apos;envoyer au client.
      </p>
    )
  }

  async function envoyer() {
    setError(null)
    setStatus(null)
    if (!EMAIL_RE.test(email.trim())) {
      setError('Adresse email invalide.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/accords/${accordId}/envoyer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setStatus(data.warning || 'Copie envoyée au client ✓')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {copieEnvoyeeAt && !status && (
        <p className="text-[11px] text-emerald-700">
          ✓ Copie déjà envoyée le {fmtDateFR(copieEnvoyeeAt)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="email@client.fr"
          className="flex-1 min-w-[180px] border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={envoyer}
          disabled={busy}
          className="bg-[#0e2a52] hover:bg-[#0a2047] text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-60 transition shrink-0"
        >
          {busy ? 'Envoi…' : '📧 Envoyer la copie'}
        </button>
      </div>
      {status && <p className="text-xs text-emerald-700 font-semibold">{status}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
