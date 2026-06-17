'use client'

import { useState } from "react"
import type { DevisData } from "@/components/DevisPDF"

type Props = {
  devis: DevisData
  clientEmail: string
  onClientEmailChange: (v: string) => void
  clientNom: string
  clientAdresse: string
  clientCP: string
  clientVille: string
  dateDevis: string
  totalHT: number
  totalTTC: number
  tvaTaux: number
  interventionId?: string | null
  onSent?: () => void
}

type Mode = 'now' | 'scheduled'

export default function DevisEnvoiPanel({
  devis,
  clientEmail,
  onClientEmailChange,
  clientNom,
  clientAdresse,
  clientCP,
  clientVille,
  dateDevis,
  totalHT,
  totalTTC,
  tvaTaux,
  interventionId,
  onSent,
}: Props) {
  const [mode, setMode] = useState<Mode>('now')
  const [premierEnvoiDate, setPremierEnvoiDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [premierEnvoiHeure, setPremierEnvoiHeure] = useState('09:00')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSend() {
    if (!clientEmail) {
      setError("Renseigne l'email du client.")
      return
    }
    const missing: string[] = []
    if (!clientNom.trim()) missing.push('nom')
    if (!clientAdresse.trim()) missing.push('adresse')
    if (!clientVille.trim()) missing.push('ville')
    if (missing.length) {
      setError(`Champs client incomplets : ${missing.join(', ')}.`)
      return
    }

    setSending(true)
    setError('')
    setSent(false)

    try {
      let premierEnvoiAt: string | undefined
      if (mode === 'scheduled') {
        premierEnvoiAt = new Date(`${premierEnvoiDate}T${premierEnvoiHeure}:00`).toISOString()
        if (new Date(premierEnvoiAt).getTime() <= Date.now()) {
          setError('Choisis une date et heure dans le futur, ou utilise « Envoyer maintenant ».')
          setSending(false)
          return
        }
      }

      const [{ DevisDocument }, { pdfDocumentToBase64 }, React] = await Promise.all([
        import('@/components/DevisPDF'),
        import('@/lib/pdfToBase64'),
        import('react'),
      ])
      const { APRIME_EMETTEUR } = await import('@/lib/emetteur')
      const client = {
        nom: clientNom || '—',
        adresseLignes: [clientAdresse || '', [clientCP, clientVille].filter(Boolean).join(' ')].filter(Boolean),
      }
      const pdfBase64 = await pdfDocumentToBase64(
        React.createElement(DevisDocument, {
          emetteur: APRIME_EMETTEUR,
          client,
          devis,
          phone: APRIME_EMETTEUR.telephone,
        }),
      )
      const filename = `devis-${devis.numero || 'sans-numero'}.pdf`.replace(/\s+/g, '-')
      const technicienNom = typeof window !== 'undefined' ? localStorage.getItem('ltdb_technicien') || '' : ''

      const res = await fetch('/api/notify-devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail,
          clientNom,
          technicienNom,
          ville: clientVille,
          dateDevis,
          numero: devis.numero,
          totalTTC,
          validiteJours: devis.validite_jours,
          pdfBase64,
          pdfFilename: filename,
          devis,
          totalHT,
          tvaTaux,
          clientAdresse,
          clientCP,
          interventionId: interventionId || undefined,
          planRelances: true,
          premierEnvoiAt,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (data.warning) setError(data.warning)
      else {
        setSent(true)
        onSent?.()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5 space-y-4">
      <div>
        <h2 className="font-bold text-[#0e2a52] text-lg">Envoi du devis au client</h2>
        <p className="text-xs text-slate-500 mt-1">
          3 emails sur 3 semaines : présence dans le secteur (S1–S2), puis <strong>-10 %</strong> si accord immédiat (S3).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('now')}
          className={`p-3 rounded-xl border-2 text-left text-sm font-semibold transition ${
            mode === 'now' ? 'border-amber-500 bg-amber-50 text-[#0e2a52]' : 'border-slate-200 text-slate-600'
          }`}
        >
          ✉ Envoyer maintenant
          <span className="block text-xs font-normal text-slate-500 mt-0.5">PDF + relances J+7 et J+14</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('scheduled')}
          className={`p-3 rounded-xl border-2 text-left text-sm font-semibold transition ${
            mode === 'scheduled' ? 'border-amber-500 bg-amber-50 text-[#0e2a52]' : 'border-slate-200 text-slate-600'
          }`}
        >
          📅 Premier envoi différé
          <span className="block text-xs font-normal text-slate-500 mt-0.5">Puis relances chaque semaine (×3)</span>
        </button>
      </div>

      {mode === 'scheduled' && (
        <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
          <label className="block text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Date</span>
            <input
              type="date"
              value={premierEnvoiDate}
              onChange={(e) => setPremierEnvoiDate(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Heure</span>
            <input
              type="time"
              value={premierEnvoiHeure}
              onChange={(e) => setPremierEnvoiHeure(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 mt-1"
            />
          </label>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={clientEmail}
          onChange={(e) => onClientEmailChange(e.target.value)}
          placeholder="email@client.com"
          className="flex-1 border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-lg px-3 py-2 text-sm"
          disabled={sending}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !clientEmail}
          className="bg-[#0e2a52] text-white font-bold rounded-lg px-5 py-2.5 text-sm hover:bg-[#0a2047] disabled:opacity-50 whitespace-nowrap"
        >
          {sending ? 'Envoi…' : mode === 'now' ? 'Envoyer' : 'Programmer'}
        </button>
      </div>

      {sent && (
        <p className="text-sm text-emerald-700">
          ✓ {mode === 'now' ? 'Devis envoyé' : 'Envoi programmé'} — relances semaines 2 et 3 planifiées.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  )
}
