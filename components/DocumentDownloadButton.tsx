'use client'
import React, { useState } from "react"
import { pdfElementToBlob } from "@/lib/pdfToBase64"
import { APRIME_EMETTEUR, aprimeFactureEmetteur } from "@/lib/emetteur"
import { safeFilename } from "@/lib/filename"
import { FactureDocument, type FactureData } from "./FacturePDF"
import { DevisDocument, type DevisData, type ClientData } from "./DevisPDF"
import { AttestationDocument, type AttestationData } from "./AttestationPDF"

export type DocType = 'facture' | 'devis' | 'attestation' | 'rapport'

export interface HistoriqueDocument {
  id: string
  type: DocType
  numero: string | null
  agence: string | null
  payload?: any
  client_nom: string | null
  client_adresse: string | null
  client_code_postal: string | null
  client_ville: string | null
}

async function fetchPayload(id: string): Promise<any> {
  const res = await fetch(`/api/historique/${id}`, { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data?.document?.payload ?? null
}

function buildClientData(d: HistoriqueDocument): ClientData {
  const cp = d.client_code_postal || ''
  const ville = d.client_ville || ''
  return {
    nom: d.client_nom || '—',
    adresseLignes: [
      d.client_adresse || '',
      [cp, ville].filter(Boolean).join(' '),
    ].filter(Boolean),
  }
}

async function buildPdfBlob(doc: HistoriqueDocument): Promise<{ blob: Blob; filename: string } | null> {
  let payload = doc.payload
  if (!payload || typeof payload !== 'object') {
    payload = await fetchPayload(doc.id)
  }
  if (!payload || typeof payload !== 'object') return null

  if (doc.type === 'facture') {
    const facture: FactureData = payload as FactureData
    if (!facture.lignes) return null
    const emetteur = aprimeFactureEmetteur(doc.agence || undefined)
    const element = React.createElement(FactureDocument, {
      emetteur,
      client: buildClientData(doc),
      facture,
      phone: emetteur.telephone,
    })
    const blob = await pdfElementToBlob(element)
    return { blob, filename: safeFilename('facture', facture.numero || doc.numero || doc.id) }
  }

  if (doc.type === 'devis') {
    const devis: DevisData = payload as DevisData
    if (!devis.lignes) return null
    const element = React.createElement(DevisDocument, {
      emetteur: APRIME_EMETTEUR,
      client: buildClientData(doc),
      devis,
      phone: APRIME_EMETTEUR.telephone,
    })
    const blob = await pdfElementToBlob(element)
    return { blob, filename: safeFilename('devis', devis.numero || doc.numero || doc.id) }
  }

  if (doc.type === 'attestation') {
    const data: AttestationData = payload as AttestationData
    if (!data.numero && !doc.numero) return null
    // S'assure des champs critiques (objet/methode/observations/conclusion peuvent être manquants
    // sur de très anciens enregistrements — on remplit à vide pour ne pas crasher le PDF).
    const safe: AttestationData = {
      ...data,
      numero: data.numero || doc.numero || '',
      objet: data.objet || '',
      methode: data.methode || '',
      observations: Array.isArray(data.observations) ? data.observations : [],
      conclusion: data.conclusion || '',
    }
    const element = React.createElement(AttestationDocument, { data: safe, photos: [] })
    const blob = await pdfElementToBlob(element)
    return { blob, filename: safeFilename('attestation', safe.numero || doc.id) }
  }

  return null
}

export default function DocumentDownloadButton({
  doc, className, label,
}: {
  doc: HistoriqueDocument
  className?: string
  label?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const baseClass = className
    || 'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50'

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true); setError('')
    try {
      const built = await buildPdfBlob(doc)
      if (!built) {
        setError('Document indisponible (payload manquant)')
        return
      }
      const url = URL.createObjectURL(built.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = built.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    } catch (err: any) {
      setError(err?.message || 'Erreur génération PDF')
    } finally {
      setLoading(false)
    }
  }

  async function handlePreview(e: React.MouseEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true); setError('')
    try {
      const built = await buildPdfBlob(doc)
      if (!built) {
        setError('Document indisponible (payload manquant)')
        return
      }
      const url = URL.createObjectURL(built.blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err: any) {
      setError(err?.message || 'Erreur génération PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="inline-flex gap-1">
        <button
          type="button"
          onClick={handlePreview}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition disabled:opacity-50"
          title="Visualiser le PDF dans un nouvel onglet"
        >
          👁 Voir
        </button>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={baseClass}
          title="Télécharger le PDF"
        >
          {loading ? '…' : `⬇ ${label || 'PDF'}`}
        </button>
      </div>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  )
}
