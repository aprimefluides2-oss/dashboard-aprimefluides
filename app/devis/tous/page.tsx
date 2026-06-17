'use client'
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import AppTabs from "@/components/AppTabs"
import DevisTabs from "@/components/DevisTabs"
import { fmtDateFR } from "@/lib/format"

type DevisRow = {
  id: string
  type: string
  numero: string | null
  agence: string | null
  date_emission: string | null
  statut: string | null
  montant_ht: number | null
  montant_ttc: number | null
  envoye_email: string | null
  envoye_at: string | null
  intervention_id: string | null
  client_id: string | null
  client_nom: string | null
  client_ville: string | null
  client_email: string | null
  pdf_url: string | null
  created_at: string
}

export default function TousLesDevisPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [devis, setDevis] = useState<DevisRow[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterVille, setFilterVille] = useState<string>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  async function reload() {
    const res = await fetch('/api/historique?limit=500', { cache: 'no-store' })
    const json = await res.json()
    if (json.error) throw new Error(json.error)
    const rows: DevisRow[] = (json.documents || []).filter((d: DevisRow) => d.type === 'devis')
    setDevis(rows)
  }

  async function handleSupprimer(d: DevisRow) {
    const ref = d.numero || d.id.slice(0, 8)
    const cascadeNote = d.intervention_id
      ? '\n\nLe devis est lié à une intervention : la suppression cascade aussi sur l\'intervention, le rapport, la facture et les photos.'
      : ''
    if (!confirm(`Supprimer le devis ${ref} ?${cascadeNote}\n\nAction irréversible.`)) return
    setDeletingId(d.id); setError(null)
    try {
      const res = await fetch(`/api/historique/${d.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || (data.warnings ? data.warnings.join('; ') : `HTTP ${res.status}`))
      await reload()
    } catch (e) {
      setError(`Erreur suppression : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch('/api/historique?limit=500', { cache: 'no-store' })
        const json = await res.json()
        if (!alive) return
        if (json.error) throw new Error(json.error)
        const rows: DevisRow[] = (json.documents || []).filter((d: DevisRow) => d.type === 'devis')
        setDevis(rows)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Erreur de chargement')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const villes = useMemo(() => {
    const set = new Set<string>()
    for (const d of devis) if (d.client_ville) set.add(d.client_ville)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [devis])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return devis.filter(d => {
      if (s) {
        const blob = [d.numero, d.client_nom, d.client_ville, d.client_email, d.agence]
          .filter(Boolean).join(' ').toLowerCase()
        if (!blob.includes(s)) return false
      }
      if (filterVille && d.client_ville !== filterVille) return false
      if (from) {
        const dateRef = d.date_emission || d.created_at
        if (dateRef < from) return false
      }
      if (to) {
        const dateRef = d.date_emission || d.created_at
        if (dateRef > to + 'T23:59:59') return false
      }
      return true
    })
  }, [devis, search, filterVille, from, to])

  const totalHT = useMemo(() => filtered.reduce((s, d) => s + (d.montant_ht || 0), 0), [filtered])
  const totalTTC = useMemo(() => filtered.reduce((s, d) => s + (d.montant_ttc || 0), 0), [filtered])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Chargement…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <AppTabs />
        </div>
      </header>
      <DevisTabs current="liste" />

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par n°, client, ville…"
              className="flex-1 min-w-[200px] border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={filterVille}
              onChange={e => setFilterVille(e.target.value)}
              className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Toutes les villes</option>
              {villes.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm"
              title="Depuis"
            />
            <span className="text-slate-400 text-sm">→</span>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm"
              title="Jusqu'à"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Devis trouvés" value={filtered.length} />
          <StatCard label="Total HT" value={`${totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`} />
          <StatCard label="Total TTC" value={`${totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}

        {/* Tableau */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">N°</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right hidden md:table-cell">Montant TTC</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">PDF</th>
                  <th className="px-2 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      Aucun devis trouvé
                    </td>
                  </tr>
                ) : (
                  filtered.map(d => (
                    <tr key={d.id} className={`hover:bg-slate-50 transition-colors ${deletingId === d.id ? 'opacity-50' : ''}`}>
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
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          d.statut === 'envoye' ? 'bg-emerald-100 text-emerald-700' :
                          d.statut === 'brouillon' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {d.statut === 'envoye' ? 'Envoyé' : d.statut === 'brouillon' ? 'Brouillon' : d.statut || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700 hidden md:table-cell whitespace-nowrap">
                        {d.montant_ttc ? `${d.montant_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {d.pdf_url ? (
                          <a
                            href={d.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
                          >
                            📄 PDF
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleSupprimer(d)}
                          disabled={deletingId === d.id}
                          className="text-slate-400 hover:text-red-600 text-lg leading-none px-1 disabled:opacity-30 disabled:cursor-wait"
                          aria-label={`Supprimer devis ${d.numero || ''}`}
                          title="Supprimer (cascade : intervention, rapport, facture, photos)"
                        >{deletingId === d.id ? '…' : '×'}</button>
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-black mt-1 text-slate-800">{value}</div>
    </div>
  )
}
