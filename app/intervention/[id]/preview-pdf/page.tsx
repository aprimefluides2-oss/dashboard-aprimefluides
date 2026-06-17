'use client'
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import React from "react"
import { proxyImageUrl } from "@/lib/proxyImageUrl"

const TerrainPdfViewer = dynamic(
  () => import('@/components/terrain/TerrainPdfViewer'),
  { ssr: false, loading: () => <div className="p-10 text-center text-slate-500">Chargement du viewer PDF…</div> },
)

type Intervention = any
type FactureDoc = any

export default function PreviewPdfPage({ params }: { params: { id: string } }) {
  const [type, setType] = useState<'rapport' | 'facture'>('rapport')
  const [interv, setInterv] = useState<Intervention | null>(null)
  const [client, setClient] = useState<any>(null)
  const [technicien, setTechnicien] = useState<any>(null)
  const [facture, setFacture] = useState<FactureDoc | null>(null)
  const [doc, setDoc] = useState<React.ReactElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Charge les données
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [intRes, factRes] = await Promise.all([
          fetch(`/api/interventions/${params.id}`, { cache: 'no-store' }),
          fetch(`/api/interventions/${params.id}/facture`, { cache: 'no-store' }),
        ])
        const intData = await intRes.json()
        const factData = await factRes.json()
        if (!intRes.ok) throw new Error(intData.error || 'Intervention introuvable')
        if (cancelled) return
        setInterv(intData.intervention)
        setClient(intData.client)
        setTechnicien(intData.technicien)
        setFacture(factData.facture || null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [params.id])

  // Construit le document à afficher
  useEffect(() => {
    let cancelled = false
    async function build() {
      if (!interv) return
      try {
        if (type === 'rapport') {
          if (!interv.rapport_json) {
            setError('Aucun rapport pour cette intervention')
            setDoc(null)
            return
          }
          const { RealisationDocument } = await import('@/components/RealisationPDF')
          if (cancelled) return
          setDoc(
            React.createElement(RealisationDocument, {
              clientNom: client?.nom || 'Client',
              adresse: interv.adresse_chantier || '',
              ville: interv.ville || '',
              codePostal: interv.code_postal || '',
              dateIntervention: interv.date_realisee || interv.date_prevue || '',
              typeIntervention: interv.type_intervention || '',
              technicienNom: technicien?.nom || 'Technicien',
              rapport: interv.rapport_json,
              reference: interv.reference || undefined,
              photos: (interv.photos_urls || []).map((u: string, i: number) => ({
                url: proxyImageUrl(u),
                legende: interv.photos_legendes?.[i] || `Photo ${i + 1}`,
              })),
            }),
          )
          setError('')
        } else {
          if (!facture?.payload) {
            setError('Aucune facture pour cette intervention')
            setDoc(null)
            return
          }
          const [{ FactureDocument }, { aprimeFactureEmetteur }] = await Promise.all([
            import('@/components/FacturePDF'),
            import('@/lib/emetteur'),
          ])
          if (cancelled) return
          const clientAdresseLignes: string[] = []
          if (interv.adresse_chantier) clientAdresseLignes.push(interv.adresse_chantier)
          if (interv.code_postal || interv.ville) {
            clientAdresseLignes.push([interv.code_postal, interv.ville].filter(Boolean).join(' '))
          }
          setDoc(
            React.createElement(FactureDocument, {
              emetteur: aprimeFactureEmetteur(interv.agence || undefined),
              client: {
                nom: client?.nom || 'Client',
                adresseLignes: clientAdresseLignes.length > 0 ? clientAdresseLignes : ['—'],
              },
              facture: facture.payload,
            }),
          )
          setError('')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    build()
    return () => { cancelled = true }
  }, [type, interv, client, technicien, facture])

  if (loading) return <div className="p-10 text-center text-slate-500">Chargement…</div>

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-[#0e2a52] text-white px-4 py-3 shadow-lg flex items-center gap-3 flex-shrink-0">
        <Link href={`/intervention/${params.id}`} className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg">
          ← Retour fiche
        </Link>
        <span className="font-bold text-base">Aperçu PDF</span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setType('rapport')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition ${type === 'rapport' ? 'bg-white text-[#0e2a52]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            📄 Rapport
          </button>
          <button
            type="button"
            onClick={() => setType('facture')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition ${type === 'facture' ? 'bg-white text-[#0e2a52]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            🧾 Facture
          </button>
        </div>
      </nav>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 m-4 rounded-xl font-semibold">
          ⚠ {error}
        </div>
      )}

      <div className="flex-1 p-4">
        {doc ? (
          <TerrainPdfViewer doc={doc} />
        ) : !error ? (
          <div className="text-center text-slate-500 p-10">Préparation du PDF…</div>
        ) : null}
      </div>
    </div>
  )
}
