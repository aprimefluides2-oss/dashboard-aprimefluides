'use client'
import { useEffect, useMemo, useState } from "react"
import AppTabs from "@/components/AppTabs"
import VilleCombobox from "@/components/VilleCombobox"
import { CANAUX_ACQUISITION } from "@/lib/canaux"
import { fmtEUR } from "@/lib/format"

type CanalRow = {
  canal: string
  label: string
  icon: string
  count: number
  ca_ttc: number
  pct: number
}
type VilleRow = { ville: string; code_postal: string; count: number; ca_ttc: number }
type DepartementRow = { departement: string; count: number; ca_ttc: number }
type MoisRow = { mois: string; count: number }

type Stats = {
  total_interventions: number
  total_ca_ttc: number
  par_canal: CanalRow[]
  par_ville: VilleRow[]
  par_departement: DepartementRow[]
  par_mois: MoisRow[]
}

function startOfYear(): string {
  const d = new Date()
  return `${d.getFullYear()}-01-01`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function StatistiquesPage() {
  const [from, setFrom] = useState(startOfYear())
  const [to, setTo] = useState(todayISO())
  const [ville, setVille] = useState('')
  const [departement, setDepartement] = useState('')
  const [canal, setCanal] = useState('')

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (ville) params.set('ville', ville)
      if (departement) params.set('departement', departement)
      if (canal) params.set('canal', canal)
      const res = await fetch(`/api/statistiques?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setStats(data)
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Recharge debouncée quand les filtres changent
  useEffect(() => {
    const t = setTimeout(() => { load() }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, ville, departement, canal])

  function resetFilters() {
    setFrom(startOfYear())
    setTo(todayISO())
    setVille('')
    setDepartement('')
    setCanal('')
  }

  const maxCount = useMemo(() => {
    if (!stats) return 1
    return Math.max(1, ...stats.par_canal.map(c => c.count))
  }, [stats])

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-6xl mx-auto px-4">
          <AppTabs />
        </div>
      </div>

      <nav className="bg-[#0e2a52] text-white px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="font-black text-base sm:text-lg leading-tight">📊 Statistiques d&apos;acquisition</div>
          <div className="text-[11px] opacity-70">Analyse des canaux d&apos;acquisition pour optimiser le budget communication</div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* Filtres */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-[#0e2a52]">Filtres</h2>
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-blue-700 hover:text-blue-900"
            >
              ↺ Réinitialiser
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Du</span>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Au</span>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Ville</span>
              <div className="mt-1">
                <VilleCombobox
                  value={ville}
                  onChange={setVille}
                  onSelect={v => { setVille(v.nom); setDepartement(v.cp.slice(0, 2)) }}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Département</span>
              <input
                type="text"
                value={departement}
                onChange={e => setDepartement(e.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="ex: 83"
                maxLength={2}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Canal</span>
              <select
                value={canal}
                onChange={e => setCanal(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 bg-white"
              >
                <option value="">— Tous —</option>
                {CANAUX_ACQUISITION.map(c => (
                  <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

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

        {!loading && stats && (
          <>
            {/* KPIs globaux */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Interventions" value={stats.total_interventions} icon="🔧" />
              <KpiCard label="CA TTC factures" value={fmtEUR(stats.total_ca_ttc)} icon="💶" />
              <KpiCard
                label="Canaux actifs"
                value={stats.par_canal.filter(c => c.count > 0 && c.canal !== '__none__').length}
                icon="📡"
              />
              <KpiCard
                label="Top canal"
                value={stats.par_canal[0]?.count ? `${stats.par_canal[0].icon} ${stats.par_canal[0].label}` : '—'}
                icon="🏆"
              />
            </div>

            {/* Répartition par canal */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-[#0e2a52]">Répartition par canal d&apos;acquisition</h3>
                <span className="text-xs text-slate-500">{stats.total_interventions} interventions</span>
              </div>
              <div className="p-4 space-y-3">
                {stats.par_canal.map(c => (
                  <div key={c.canal} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{c.icon}</span>
                        <span className="font-semibold text-[#0e2a52] truncate">{c.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        <span className="font-bold text-[#0e2a52]">{c.count}</span>
                        <span className="text-slate-400">·</span>
                        <span>{c.pct.toFixed(1)} %</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-semibold text-emerald-700">{fmtEUR(c.ca_ttc)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          c.canal === '__none__' ? 'bg-slate-300' : 'bg-gradient-to-r from-blue-500 to-blue-700'
                        }`}
                        style={{ width: `${maxCount > 0 ? (c.count / maxCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
                {stats.par_canal.every(c => c.count === 0) && (
                  <p className="text-sm text-slate-500 italic text-center py-6">
                    Aucune intervention sur la période. Renseigne le canal d&apos;acquisition à la création
                    pour voir apparaître les statistiques ici.
                  </p>
                )}
              </div>
            </section>

            {/* Top villes + départements */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-[#0e2a52]">Top villes</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-2 text-left">Ville</th>
                        <th className="px-4 py-2 text-right">Interv.</th>
                        <th className="px-4 py-2 text-right">CA TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.par_ville.map(v => (
                        <tr key={v.ville} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-700">
                            {v.ville}{v.code_postal ? <span className="text-slate-400 font-normal text-xs ml-1">({v.code_postal})</span> : null}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-[#0e2a52] tabular-nums">{v.count}</td>
                          <td className="px-4 py-2 text-right text-emerald-700 tabular-nums">{fmtEUR(v.ca_ttc)}</td>
                        </tr>
                      ))}
                      {stats.par_ville.length === 0 && (
                        <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400 italic">Aucune donnée</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-[#0e2a52]">Par département</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-2 text-left">Dpt</th>
                        <th className="px-4 py-2 text-right">Interv.</th>
                        <th className="px-4 py-2 text-right">CA TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.par_departement.map(d => (
                        <tr key={d.departement} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2 font-bold text-[#0e2a52]">{d.departement}</td>
                          <td className="px-4 py-2 text-right font-bold text-[#0e2a52] tabular-nums">{d.count}</td>
                          <td className="px-4 py-2 text-right text-emerald-700 tabular-nums">{fmtEUR(d.ca_ttc)}</td>
                        </tr>
                      ))}
                      {stats.par_departement.length === 0 && (
                        <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400 italic">Aucune donnée</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Évolution mensuelle */}
            {stats.par_mois.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-[#0e2a52]">Évolution mensuelle</h3>
                </div>
                <div className="p-4">
                  <MonthsBar data={stats.par_mois} />
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function KpiCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
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

function MonthsBar({ data }: { data: MoisRow[] }) {
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div className="flex items-end gap-2 h-40 overflow-x-auto pb-2">
      {data.map(m => {
        const h = (m.count / max) * 100
        return (
          <div key={m.mois} className="flex flex-col items-center gap-1 min-w-[40px]">
            <div className="text-xs font-bold text-[#0e2a52] tabular-nums">{m.count}</div>
            <div className="bg-gradient-to-t from-blue-700 to-blue-400 rounded-t-md w-full transition-all" style={{ height: `${h}%`, minHeight: '4px' }} />
            <div className="text-[10px] text-slate-500 tabular-nums">{m.mois.slice(2)}</div>
          </div>
        )
      })}
    </div>
  )
}
