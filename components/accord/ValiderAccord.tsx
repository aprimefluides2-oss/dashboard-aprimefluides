'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"
import { pdfElementToBlob } from "@/lib/pdfToBase64"
import { AccordDocument } from "@/components/accord/AccordPDF"
import SignatureCanvas from "@/components/accord/SignatureCanvas"
import type { AccordIntervention, LigneDevis } from "@/lib/supabase"
import type { EmetteurInfo } from "@/components/accord/ApercuAccord"

type Props = {
  accord: AccordIntervention
  lignes: LigneDevis[]
  emetteur: EmetteurInfo
  telephone: string
}

/**
 * Validation sur place : signature tactile + consentements (demande expresse,
 * renonciation), ou refus client. À la validation, le PDF signé est régénéré
 * et archivé (signature embarquée en data URL — pas de problème de CORS).
 */
export default function ValiderAccord({ accord, lignes, emetteur, telephone }: Props) {
  const router = useRouter()
  const [signature, setSignature] = useState<string | null>(null)
  const [demandeExpresse, setDemandeExpresse] = useState(false)
  const [renonciation, setRenonciation] = useState(false)
  const [busy, setBusy] = useState<'valider' | 'refuser' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refusOpen, setRefusOpen] = useState(false)
  const [motif, setMotif] = useState('')

  const peutValider = !!signature && demandeExpresse && renonciation && busy === null

  async function regenererPdfSigne(signatureDataUrl: string, valideAt: string) {
    const accordSigne: AccordIntervention = {
      ...accord,
      statut: 'VALIDE',
      valide_at: valideAt,
      canal_validation: 'SIGNATURE',
      signature_image: signatureDataUrl, // data URL → react-pdf l'embarque sans CORS
      demande_expresse: true,
      renonciation_retractation: true,
    }
    const blob = await pdfElementToBlob(
      <AccordDocument accord={accordSigne} lignes={lignes} emetteur={emetteur} telephone={telephone} />,
    )
    const fd = new FormData()
    fd.append('pdf', new File([blob], `accord-${accord.reference || accord.id}.pdf`, { type: 'application/pdf' }))
    await fetch(`/api/accords/${accord.id}/pdf`, { method: 'POST', body: fd })
  }

  async function valider() {
    if (!signature) return
    setBusy('valider')
    setError(null)
    try {
      const res = await fetch(`/api/accords/${accord.id}/valider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature,
          demande_expresse: true,
          renonciation_retractation: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      // PDF signé — best-effort : un échec ici ne remet pas en cause la validation.
      try {
        await regenererPdfSigne(signature, data.valide_at as string)
      } catch (e) {
        console.error('[ValiderAccord] régénération PDF', e)
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(null)
    }
  }

  async function refuser() {
    setBusy('refuser')
    setError(null)
    try {
      const res = await fetch(`/api/accords/${accord.id}/refus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif: motif.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(null)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Validation sur place
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Faire relire le document au client, puis recueillir sa signature.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* Consentements */}
      <div className="space-y-2">
        <label className="flex gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={demandeExpresse}
            onChange={e => setDemandeExpresse(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-red-600 shrink-0"
          />
          <span>
            Le client <strong>sollicite expressément</strong> cette intervention de dépannage en
            urgence à son domicile (bloc A).
          </span>
        </label>
        <label className="flex gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={renonciation}
            onChange={e => setRenonciation(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-red-600 shrink-0"
          />
          <span>
            Le client <strong>renonce à son droit de rétractation</strong> pour les travaux urgents
            et en demande l&apos;exécution immédiate (bloc C).
          </span>
        </label>
      </div>

      {/* Signature */}
      <SignatureCanvas onChange={setSignature} />

      <button
        onClick={valider}
        disabled={!peutValider}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-sm disabled:opacity-50 transition"
      >
        {busy === 'valider' ? 'Validation…' : '✓ Valider l’accord'}
      </button>
      {!peutValider && busy === null && (
        <p className="text-[11px] text-slate-400 -mt-2">
          Coche les deux cases et fais signer le client pour activer la validation.
        </p>
      )}

      {/* Refus */}
      <div className="border-t border-slate-100 pt-3">
        {!refusOpen ? (
          <button
            onClick={() => setRefusOpen(true)}
            className="text-xs font-semibold text-slate-500 hover:text-red-600"
          >
            Le client refuse de valider →
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              Motif du refus (optionnel)
            </label>
            <textarea
              value={motif}
              onChange={e => setMotif(e.target.value)}
              rows={2}
              className="w-full border-2 border-slate-200 focus:border-red-500 outline-none rounded-lg px-3 py-2 text-sm resize-y"
              placeholder="Ex. le client souhaite un autre devis…"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRefusOpen(false)}
                disabled={busy !== null}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={refuser}
                disabled={busy !== null}
                className="flex-1 bg-white border-2 border-red-300 text-red-700 hover:bg-red-50 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition"
              >
                {busy === 'refuser' ? 'Enregistrement…' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
