'use client'
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import AppTabs from "@/components/AppTabs"
import { fmtDateFR, fmtEUR } from "@/lib/format"

const DocumentDownloadButton = dynamic(() => import("@/components/DocumentDownloadButton"), { ssr: false })
const ResendEmailButton = dynamic(() => import("@/components/ResendEmailButton"), { ssr: false })
const RequestReviewButton = dynamic(() => import("@/components/RequestReviewButton"), { ssr: false })
const InterventionRapportDownloadButton = dynamic(() => import("@/components/InterventionRapportDownloadButton"), { ssr: false })

type Intervention = {
  id: string
  reference: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_realisee: string | null
  date_prevue: string | null
  statut: string
  agence: string | null
  publie_slug: string | null
  created_at: string
  client_id: string | null
  client_nom: string | null
  client_email: string | null
  client_adresse: string | null
  client_code_postal: string | null
  client_ville: string | null
  technicien_nom: string | null
  rapport_json: any
  photos_urls: string[] | null
  has_rapport: boolean
}

type Document = {
  id: string
  type: 'facture' | 'devis' | 'attestation' | 'rapport'
  numero: string | null
  agence: string | null
  date_emission: string
  statut: string
  montant_ht: number | null
  montant_ttc: number | null
  envoye_email: string | null
  envoye_at: string | null
  intervention_id: string | null
  client_id: string | null
  client_nom: string | null
  client_adresse: string | null
  client_code_postal: string | null
  client_ville: string | null
  payload?: any
  pdf_url: string | null
  created_at: string
}

const TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'interventions', label: 'Interventions' },
  { key: 'facture', label: 'Factures' },
  { key: 'devis', label: 'Devis' },
  { key: 'attestation', label: 'Attestations' },
] as const

const STATUT_BADGE: Record<string, string> = {
  planifiee: 'bg-blue-100 text-blue-700',
  en_cours: 'bg-amber-100 text-amber-700',
  terminee: 'bg-emerald-100 text-emerald-700',
  annulee: 'bg-slate-200 text-slate-600',
  brouillon: 'bg-slate-200 text-slate-600',
  envoye: 'bg-blue-100 text-blue-700',
  paye: 'bg-emerald-100 text-emerald-700',
  accepte: 'bg-emerald-100 text-emerald-700',
  refuse: 'bg-red-100 text-red-700',
  expire: 'bg-amber-100 text-amber-700',
  annule: 'bg-slate-200 text-slate-600',
}

const TYPE_ICON: Record<string, string> = {
  rapport: '📄',
  facture: '🧾',
  devis: '📝',
  attestation: '✅',
}

export default function HistoriquePage() {
  const [tab, setTab] = useState<typeof TABS[number]['key']>('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/historique?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setInterventions(data.interventions || [])
      setDocuments(data.documents || [])
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDeleteDoc(d: Document) {
    const label = d.type === 'facture' ? 'cette facture' : `ce ${d.type}`
    const ref = d.numero ? ` ${d.numero}` : ''
    const cascadeNote = d.intervention_id
      ? '\n\n⚠ Le document est lié à une intervention : tout est effacé (intervention, rapport, autres factures/devis liés, photos).'
      : ''
    if (!confirm(`Supprimer ${label}${ref} ?${cascadeNote}\n\nAction irréversible.`)) return
    setDeletingId(d.id); setError('')
    try {
      const res = await fetch(`/api/historique/${d.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || (data.warnings ? data.warnings.join('; ') : `HTTP ${res.status}`))
      // Recharge depuis le serveur : en cascade, l'intervention liée et les
      // autres documents disparaissent aussi — un simple filtre client laisserait
      // des fantômes affichés jusqu'au prochain reload.
      await load()
    } catch (e: any) {
      setError(`Erreur suppression : ${e.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteIntervention(i: Intervention) {
    const label = i.reference ? `l'intervention ${i.reference}` : 'cette intervention'
    if (!confirm(
      `Supprimer ${label} ?\n\n` +
      `Cela efface aussi : rapport, facture(s), devis, attestation(s) et photos liés.\n\n` +
      `Action irréversible.`
    )) return
    setDeletingId(i.id); setError('')
    try {
      const res = await fetch(`/api/interventions/${i.id}?hard=1`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || (data.warnings ? data.warnings.join('; ') : `HTTP ${res.status}`))
      await load()
    } catch (e: any) {
      setError(`Erreur suppression intervention : ${e.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  // Recherche debouncée
  useEffect(() => {
    const t = setTimeout(() => { load() }, 300)
    return () => clearTimeout(t)
  }, [q])

  const filteredDocuments = useMemo(() => {
    if (tab === 'all' || tab === 'interventions') return documents
    return documents.filter(d => d.type === tab)
  }, [documents, tab])

  const showInterventions = tab === 'all' || tab === 'interventions'
  const showDocuments = tab !== 'interventions'

  // Stats agrégées (header)
  const stats = useMemo(() => {
    const totalCA = documents
      .filter(d => d.type === 'facture' && d.statut !== 'annule')
      .reduce((sum, d) => sum + (d.montant_ttc || 0), 0)
    return {
      interventions: interventions.length,
      factures: documents.filter(d => d.type === 'facture').length,
      devis: documents.filter(d => d.type === 'devis').length,
      attestations: documents.filter(d => d.type === 'attestation').length,
      ca: totalCA,
    }
  }, [interventions, documents])

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-6xl mx-auto px-4">
          <AppTabs />
        </div>
      </div>

      <nav className="bg-[#0e2a52] text-white px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="font-black text-base sm:text-lg leading-tight">Aprime fluides</div>
          <div className="text-[11px] opacity-70">Historique CRM</div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Interventions" value={stats.interventions} icon="🔧" />
          <StatCard label="Factures" value={stats.factures} icon="🧾" />
          <StatCard label="Devis" value={stats.devis} icon="📝" />
          <StatCard label="Attestations" value={stats.attestations} icon="✅" />
          <StatCard label="CA total TTC" value={fmtEUR(stats.ca)} icon="💶" />
        </div>

        {/* Recherche + onglets */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher : nom client, ville, n° facture, référence…"
            className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors"
          />
          <div className="flex flex-wrap gap-2">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                  tab === t.key
                    ? 'bg-[#0e2a52] text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button onClick={load} className="ml-auto px-4 py-2 rounded-full text-sm font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
              ↻ Rafraîchir
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {loading && !error && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
            Chargement…
          </div>
        )}

        {!loading && !error && interventions.length === 0 && documents.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
            <div className="text-4xl">📭</div>
            <p className="text-slate-700 font-semibold">Aucune donnée pour le moment.</p>
            <p className="text-slate-500 text-sm">Génère un rapport, une facture, un devis ou une attestation — il apparaîtra ici.</p>
          </div>
        )}

        {/* Interventions */}
        {!loading && showInterventions && interventions.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-[#0e2a52]">🔧 Interventions ({interventions.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Référence</th>
                    <th className="px-4 py-2 text-left">Client</th>
                    <th className="px-4 py-2 text-left">Ville</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Statut</th>
                    <th className="px-4 py-2 text-left">Page</th>
                    <th className="px-4 py-2 text-right">Rapport</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {interventions.map(i => (
                    <tr key={i.id} className={`border-t border-slate-100 hover:bg-slate-50 ${deletingId === i.id ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 text-slate-600">{fmtDateFR(i.date_realisee || i.date_prevue || i.created_at)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#0e2a52] font-bold">{i.reference || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{i.client_nom || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{i.ville || '—'} {i.code_postal ? `(${i.code_postal})` : ''}</td>
                      <td className="px-4 py-3 text-slate-600">{i.type_intervention || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUT_BADGE[i.statut] || 'bg-slate-100 text-slate-600'}`}>
                          {i.statut}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {i.publie_slug ? (
                          <a href={`https://www.aprime-fluide.fr/nos-realisations/${i.publie_slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold text-xs">
                            voir →
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-col items-end gap-1">
                          {i.has_rapport && (
                            <InterventionRapportDownloadButton intervention={i} />
                          )}
                          <RequestReviewButton
                            clientEmail={i.client_email}
                            clientNom={i.client_nom}
                            ville={i.ville || i.client_ville}
                          />
                          {!i.has_rapport && (
                            <span className="text-slate-400 text-xs">— pas de rapport</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteIntervention(i)}
                          disabled={deletingId === i.id}
                          className="text-slate-400 hover:text-red-600 text-lg leading-none px-1 disabled:opacity-30 disabled:cursor-wait"
                          aria-label={`Supprimer intervention ${i.reference || ''}`}
                          title="Supprimer l'intervention"
                        >{deletingId === i.id ? '…' : '×'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Documents */}
        {!loading && showDocuments && filteredDocuments.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-[#0e2a52]">
                Documents ({filteredDocuments.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">N°</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Client</th>
                    <th className="px-4 py-2 text-left">Agence</th>
                    <th className="px-4 py-2 text-right">HT</th>
                    <th className="px-4 py-2 text-right">TTC</th>
                    <th className="px-4 py-2 text-left">Statut</th>
                    <th className="px-4 py-2 text-left">Envoyé à</th>
                    <th className="px-4 py-2 text-right">Document</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map(d => (
                    <tr key={d.id} className={`border-t border-slate-100 hover:bg-slate-50 ${deletingId === d.id ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="text-base mr-1">{TYPE_ICON[d.type] || '📄'}</span>
                        <span className="text-xs font-bold text-[#0e2a52] uppercase">{d.type}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{d.numero || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDateFR(d.date_emission)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{d.client_nom || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{d.agence || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{fmtEUR(d.montant_ht)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#0e2a52] tabular-nums">{fmtEUR(d.montant_ttc)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUT_BADGE[d.statut] || 'bg-slate-100 text-slate-600'}`}>
                          {d.statut}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{d.envoye_email || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap gap-1 justify-end">
                          {d.pdf_url ? (
                            <a
                              href={d.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
                              title="Ouvrir le PDF stocké"
                            >
                              ⬇ PDF
                            </a>
                          ) : (
                            <DocumentDownloadButton doc={d} />
                          )}
                          {(d.type === 'facture' || d.type === 'devis' || d.type === 'attestation') && (
                            <ResendEmailButton doc={d} />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(d)}
                          disabled={deletingId === d.id}
                          className="text-slate-400 hover:text-red-600 text-lg leading-none px-1 disabled:opacity-30 disabled:cursor-wait"
                          aria-label={`Supprimer ${d.type} ${d.numero || ''}`}
                          title="Supprimer"
                        >{deletingId === d.id ? '…' : '×'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <div className="flex justify-between items-start">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</div>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-black text-[#0e2a52] mt-1">{value}</div>
    </div>
  )
}
