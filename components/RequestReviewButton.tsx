'use client'
import { useState } from "react"

export default function RequestReviewButton({
  clientEmail, clientNom, ville,
}: {
  clientEmail: string | null
  clientNom: string | null
  ville: string | null
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(clientEmail || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSend() {
    if (!email.trim()) { setError('Email obligatoire'); return }
    setSending(true); setError(''); setSent(false)
    try {
      const technicienNom = typeof window !== 'undefined'
        ? (localStorage.getItem('ltdb_technicien') || '') : ''
      const res = await fetch('/api/notify-client/review-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: email.trim(),
          clientNom,
          ville,
          technicienNom,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setSent(true)
      setTimeout(() => { setOpen(false); setSent(false) }, 1500)
    } catch (e: any) {
      setError(e?.message || 'Erreur envoi')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(''); setSent(false); setEmail(clientEmail || '') }}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition"
        title="Demander un avis Google au client"
      >
        ⭐ Avis
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !sending && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-[#0e2a52] text-lg mb-1">
              Demander un avis Google
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {clientNom || 'Client'}{ville ? ` — ${ville}` : ''}
              <br />
              <span className="text-xs">Un seul email sera envoyé (pas de relance auto).</span>
            </p>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Email du destinataire
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@client.com"
              autoFocus
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2.5 text-base"
              disabled={sending || sent}
            />
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mt-3">
                ⚠ {error}
              </div>
            )}
            {sent && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2 text-sm mt-3">
                ✓ Email envoyé à <strong>{email}</strong>
              </div>
            )}
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={sending}
                className="flex-1 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || sent || !email.trim()}
                className="flex-1 bg-amber-500 text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-amber-600 disabled:opacity-50"
              >
                {sending ? 'Envoi…' : sent ? '✓ Envoyé' : '⭐ Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
