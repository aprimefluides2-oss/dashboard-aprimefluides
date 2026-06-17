'use client'
import React, { useState } from "react"
import { pdfElementToBlob } from "@/lib/pdfToBase64"
import { safeFilename } from "@/lib/filename"
import { RealisationDocument, type RapportData } from "./RealisationPDF"

export interface HistoriqueIntervention {
  id: string
  reference: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_realisee: string | null
  date_prevue: string | null
  rapport_json: any
  photos_urls: string[] | null
  client_nom: string | null
  client_adresse: string | null
  client_code_postal: string | null
  client_ville: string | null
  technicien_nom: string | null
}

async function buildPdfBlob(i: HistoriqueIntervention): Promise<{ blob: Blob; filename: string } | null> {
  const rapport = i.rapport_json as RapportData | null
  if (!rapport || typeof rapport !== 'object') return null

  const dateIntervention = i.date_realisee || i.date_prevue || new Date().toISOString().slice(0, 10)
  const adresse = i.adresse_chantier || i.client_adresse || ''
  const ville = i.ville || i.client_ville || ''
  const codePostal = i.code_postal || i.client_code_postal || ''
  const photos = (i.photos_urls || [])
    .filter(u => typeof u === 'string' && u.trim())
    .map(url => ({ url, legende: '' }))

  const element = React.createElement(RealisationDocument, {
    clientNom: i.client_nom || '—',
    adresse,
    ville,
    codePostal,
    dateIntervention,
    typeIntervention: i.type_intervention || 'Intervention',
    technicienNom: i.technicien_nom || '',
    rapport,
    photos,
    reference: i.reference || rapport.reference || undefined,
  })

  const blob = await pdfElementToBlob(element)
  return { blob, filename: safeFilename('rapport', i.reference || ville || i.id) }
}

export default function InterventionRapportDownloadButton({
  intervention,
}: {
  intervention: HistoriqueIntervention
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function trigger(action: 'download' | 'preview') {
    if (loading) return
    setLoading(true); setError('')
    try {
      const built = await buildPdfBlob(intervention)
      if (!built) {
        setError('Rapport non disponible')
        return
      }
      const url = URL.createObjectURL(built.blob)
      if (action === 'download') {
        const a = document.createElement('a')
        a.href = url
        a.download = built.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1500)
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur génération PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1.5">
      <div className="inline-flex gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => trigger('preview')}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition disabled:opacity-50"
          title="Visualiser le rapport dans un nouvel onglet"
        >
          <span aria-hidden>👁</span>
          <span>Aperçu</span>
        </button>
        <button
          type="button"
          onClick={() => trigger('download')}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e2a52] hover:bg-[#0a1f3d] text-white text-xs font-semibold transition disabled:opacity-50"
          title="Télécharger le rapport PDF"
        >
          <span aria-hidden>{loading ? '⏳' : '⬇'}</span>
          <span>{loading ? 'Génération...' : 'Rapport PDF'}</span>
        </button>
      </div>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  )
}
