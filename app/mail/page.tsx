'use client'
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import AppTabs from "@/components/AppTabs"
import { fmtDateFR } from "@/lib/format"

const ResendEmailButton = dynamic(() => import("@/components/ResendEmailButton"), { ssr: false })

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
  pdf_url: string | null
  created_at: string
}

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'devis', label: 'Devis' },
  { key: 'facture', label: 'Factures' },
  { key: 'rapport', label: 'Rapports' },
  { key: 'attestation', label: 'Attestations' },
] as const

const TYPE_BADGE: Record<string, string> = {
  devis: 'bg-amber-100 text-amber-700',
  facture: 'bg-emerald-100 text-emerald-700',
  rapport: 'bg-slate-200 text-slate-700',
  attestation: 'bg-[#a18249]/15 text-[#6e5530]',
}

export default function MailPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/historique', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDocuments(data.documents || [])
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return documents
    return documents.filter(d => d.type === filter)
  }, [documents, filter])

  const stats = useMemo(() => {
    const envoyes = documents.filter(d => d.envoye_at)
    return {
      total: documents.length,
      envoyes: envoyes.length,
      nonEnvoyes: documents.length - envoyes.length,
    }
  }, [documents])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Chargement…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <nav className="bg-[#0e2a52] text-white px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <span className="inline-flex items-center rounded-lg bg-white px-2 py-1 shadow-sm ring-1 ring-black/5 mb-1"><img src="/logo.png" alt="Aprime Fluides" className="h-7 w-auto" /></span>
          <div className="text-[11px] opacity-70">Emails envoyés</div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 pt-3">
        <AppTabs />
      </div>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap gap-2 items-center">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                  filter === f.key
                    ? 'bg-[#0e2a52] text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
            <button onClick={load} className="ml-auto px-4 py-2 rounded-full text-sm font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
              ↻ Rafraîchir
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total docs" value={stats.total} color="bg-slate-600" />
          <StatCard label="Envoyés" value={stats.envoyes} color="bg-emerald-600" />
          <StatCard label="Non envoyés" value={stats.nonEnvoyes} color="bg-amber-500" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Tableau */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">N°</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut envoi</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Destinataire</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      Aucun document trouvé
                    </td>
                  </tr>
                ) : (
                  filtered.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${TYPE_BADGE[d.type] || 'bg-slate-100 text-slate-600'}`}>
                          {d.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                        {d.numero || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-medium">{d.client_nom || '—'}</div>
                        {d.client_ville && (
                          <div className="text-xs text-slate-400">{d.client_ville}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell whitespace-nowrap">
                        {d.date_emission ? fmtDateFR(d.date_emission.slice(0, 10)) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {d.envoye_at ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            ✓ Envoyé le {fmtDateFR(d.envoye_at.slice(0, 10))}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            Non envoyé
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell max-w-[180px] truncate">
                        {d.envoye_email || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap gap-1 justify-end">
                          {(d.type === 'facture' || d.type === 'devis' || d.type === 'attestation') && (
                            <ResendEmailButton doc={d} />
                          )}
                          {d.type === 'rapport' && d.intervention_id && (
                            <a
                              href={`/intervention/${d.intervention_id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition"
                            >
                              📧 Envoyer rapport
                            </a>
                          )}
                          {d.type === 'rapport' && !d.intervention_id && (
                            <span className="text-xs text-slate-400 italic">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-black mt-1 ${color.replace('bg-', 'text-')}`}>{value}</div>
    </div>
  )
}
