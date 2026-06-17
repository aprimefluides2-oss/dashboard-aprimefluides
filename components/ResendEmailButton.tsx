'use client'
import React, { useState } from "react"
import { pdfDocumentToBase64 } from "@/lib/pdfToBase64"
import { APRIME_EMETTEUR, aprimeFactureEmetteur } from "@/lib/emetteur"
import { fmtDateISOtoFR } from "@/lib/format"
import { safeFilename } from "@/lib/filename"
import { FactureDocument, type FactureData } from "./FacturePDF"
import { DevisDocument, type DevisData, type ClientData } from "./DevisPDF"
import { AttestationDocument, type AttestationData } from "./AttestationPDF"
import type { HistoriqueDocument } from "./DocumentDownloadButton"

type DocWithEmail = HistoriqueDocument & { envoye_email?: string | null }

async function fetchPayload(id: string) {
  const res = await fetch(`/api/historique/${id}`, { cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data?.document?.payload ?? null
}

function buildClientData(d: HistoriqueDocument): ClientData {
  return {
    nom: d.client_nom || '—',
    adresseLignes: [
      d.client_adresse || '',
      [d.client_code_postal, d.client_ville].filter(Boolean).join(' '),
    ].filter(Boolean),
  }
}

function getTechnicien(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('ltdb_technicien') || ''
}

async function buildSendBody(
  doc: HistoriqueDocument,
  payload: any,
  clientEmail: string,
): Promise<{ endpoint: string; body: any } | null> {
  const technicienNom = getTechnicien()

  if (doc.type === 'facture') {
    const facture = payload as FactureData
    if (!facture?.lignes) throw new Error('Payload facture invalide')
    const emetteur = aprimeFactureEmetteur(doc.agence || undefined)
    const element = React.createElement(FactureDocument, {
      emetteur, client: buildClientData(doc), facture, phone: emetteur.telephone,
    })
    const pdfBase64 = await pdfDocumentToBase64(element)
    const totalHT = facture.lignes.reduce(
      (s, l) => l.inclus ? s : s + (Number(l.pu_ht) || 0) * (Number(l.qte) || 0),
      0,
    )
    const tvaTaux = facture.tva_taux ?? 10
    const totalTTC = totalHT * (1 + tvaTaux / 100)
    return {
      endpoint: '/api/notify-facture',
      body: {
        clientEmail,
        clientNom: doc.client_nom,
        technicienNom,
        ville: doc.client_ville,
        dateFacture: fmtDateISOtoFR(facture.date_facture),
        numero: facture.numero || doc.numero,
        totalTTC,
        echeance: facture.echeance,
        agence: doc.agence,
        pdfBase64,
        pdfFilename: safeFilename('facture', facture.numero || doc.numero || doc.id),
        facture,
        totalHT,
        tvaTaux,
        clientAdresse: doc.client_adresse,
        clientCP: doc.client_code_postal,
      },
    }
  }

  if (doc.type === 'devis') {
    const devis = payload as DevisData
    if (!devis?.lignes) throw new Error('Payload devis invalide')
    const element = React.createElement(DevisDocument, {
      emetteur: APRIME_EMETTEUR, client: buildClientData(doc), devis, phone: APRIME_EMETTEUR.telephone,
    })
    const pdfBase64 = await pdfDocumentToBase64(element)
    const totalHT = devis.lignes.reduce(
      (s, l) => s + (Number(l.pu_ht) || 0) * (Number(l.qte) || 0),
      0,
    )
    const tvaTaux = devis.tva_taux ?? 10
    const totalTTC = totalHT * (1 + tvaTaux / 100)
    return {
      endpoint: '/api/notify-devis',
      body: {
        clientEmail,
        clientNom: doc.client_nom,
        technicienNom,
        ville: doc.client_ville,
        dateDevis: fmtDateISOtoFR(devis.date_devis),
        numero: devis.numero || doc.numero,
        totalTTC,
        validiteJours: devis.validite_jours,
        agence: doc.agence,
        pdfBase64,
        pdfFilename: safeFilename('devis', devis.numero || doc.numero || doc.id),
        devis,
        totalHT,
        tvaTaux,
        clientAdresse: doc.client_adresse,
        clientCP: doc.client_code_postal,
      },
    }
  }

  if (doc.type === 'attestation') {
    const data = payload as AttestationData
    const safe: AttestationData = {
      ...data,
      numero: data.numero || doc.numero || '',
      objet: data.objet || '',
      methode: data.methode || '',
      observations: Array.isArray(data.observations) ? data.observations : [],
      conclusion: data.conclusion || '',
    }
    const element = React.createElement(AttestationDocument, { data: safe, photos: [] })
    const pdfBase64 = await pdfDocumentToBase64(element)
    return {
      endpoint: '/api/notify-attestation',
      body: {
        clientEmail,
        clientNom: doc.client_nom,
        technicienNom: getTechnicien(),
        ville: doc.client_ville,
        dateAttestation: fmtDateISOtoFR(safe.date),
        numero: safe.numero,
        variante: safe.variante,
        agence: doc.agence,
        pdfBase64,
        pdfFilename: safeFilename('attestation', safe.numero || doc.id),
        attestation: safe,
        clientAdresse: doc.client_adresse,
        clientCP: doc.client_code_postal,
      },
    }
  }

  return null
}

export default function ResendEmailButton({ doc }: { doc: DocWithEmail }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(doc.envoye_email || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  if (doc.type !== 'facture' && doc.type !== 'devis' && doc.type !== 'attestation') {
    return null
  }

  async function handleSend() {
    if (!email.trim()) { setError('Email obligatoire'); return }
    setSending(true); setError(''); setSent(false)
    try {
      const payload = await fetchPayload(doc.id)
      if (!payload) throw new Error('Document indisponible (payload manquant)')
      const built = await buildSendBody(doc, payload, email.trim())
      if (!built) throw new Error('Type non supporté')

      const res = await fetch(built.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.body),
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

  const typeLabel = doc.type === 'facture' ? 'la facture'
    : doc.type === 'devis' ? 'le devis' : 'l\'attestation'

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(''); setSent(false) }}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
        title={`Renvoyer ${typeLabel} par email`}
      >
        ✉ Renvoyer
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
              Renvoyer {typeLabel}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {doc.type.toUpperCase()} {doc.numero || ''}
              {doc.client_nom ? ` — ${doc.client_nom}` : ''}
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
                className="flex-1 bg-emerald-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
              >
                {sending ? 'Envoi…' : sent ? '✓ Envoyé' : '✉ Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
