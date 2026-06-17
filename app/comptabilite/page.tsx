'use client'
import { useEffect, useMemo, useState } from "react"
import AppTabs from "@/components/AppTabs"
import { AGENCES } from "@/lib/agences"
import { fmtDateFR, fmtEUR } from "@/lib/format"

// =====================================================================
// Types
// =====================================================================

type Recette = {
  id: string
  numero: string | null
  date_emission: string
  statut: string
  montant_ht: number | null
  montant_ttc: number | null
  tva_taux: number | null
  agence: string | null
  client_id: string | null
  client_nom: string | null
}

type Depense = {
  id: string
  fournisseur: string
  numero: string | null
  date_facture: string
  montant_ht: number
  tva: number
  montant_ttc: number
  categorie: string | null
  description: string | null
  agence: string | null
  pdf_url: string | null
  created_at: string
}

type SubTab = 'dashboard' | 'recettes' | 'depenses' | 'export'

const SUBTABS: { key: SubTab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: '📊' },
  { key: 'recettes',  label: 'Recettes (clients)', icon: '💶' },
  { key: 'depenses',  label: 'Dépenses (fournisseurs)', icon: '🧾' },
  { key: 'export',    label: 'Export', icon: '📤' },
]

const CATEGORIES = [
  { value: 'carburant',      label: 'Carburant' },
  { value: 'materiel',       label: 'Matériel' },
  { value: 'sous_traitance', label: 'Sous-traitance' },
  { value: 'assurance',      label: 'Assurance' },
  { value: 'telecom',        label: 'Télécom' },
  { value: 'locaux',         label: 'Locaux' },
  { value: 'autre',          label: 'Autre' },
] as const

const CAT_COLORS: Record<string, string> = {
  carburant:      '#0ea5e9',
  materiel:       '#8b5cf6',
  sous_traitance: '#f59e0b',
  assurance:      '#ef4444',
  telecom:        '#10b981',
  locaux:         '#6366f1',
  autre:          '#64748b',
}

const STATUT_BADGE: Record<string, string> = {
  brouillon: 'bg-slate-200 text-slate-600',
  envoye: 'bg-blue-100 text-blue-700',
  paye: 'bg-emerald-100 text-emerald-700',
  annule: 'bg-slate-200 text-slate-600',
}

// =====================================================================
// Helpers période & format
// =====================================================================

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n) }
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function presetThisMonth(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: ymd(from), to: ymd(to) }
}
function presetThisQuarter(): { from: string; to: string } {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  const from = new Date(now.getFullYear(), q * 3, 1)
  const to = new Date(now.getFullYear(), q * 3 + 3, 0)
  return { from: ymd(from), to: ymd(to) }
}
function presetThisYear(): { from: string; to: string } {
  const now = new Date()
  return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(1).replace('.', ',')} %`
}

// =====================================================================
// Page
// =====================================================================

export default function ComptabilitePage() {
  const [subtab, setSubtab] = useState<SubTab>('dashboard')

  // Période globale (utilisée par toutes les sections sauf modal)
  const initial = presetThisMonth()
  const [from, setFrom] = useState<string>(initial.from)
  const [to, setTo] = useState<string>(initial.to)

  // Filtres
  const [agenceRecettes, setAgenceRecettes] = useState<string>('')
  const [statutRecettes, setStatutRecettes] = useState<string>('')
  const [agenceDepenses, setAgenceDepenses] = useState<string>('')
  const [categorieDepenses, setCategorieDepenses] = useState<string>('')

  // Données
  const [loadingRec, setLoadingRec] = useState(false)
  const [loadingDep, setLoadingDep] = useState(false)
  const [error, setError] = useState('')
  const [recettes, setRecettes] = useState<Recette[]>([])
  const [depenses, setDepenses] = useState<Depense[]>([])

  // Modal dépense
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Depense | null>(null)

  async function loadRecettes() {
    setLoadingRec(true); setError('')
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (agenceRecettes) params.set('agence', agenceRecettes)
      if (statutRecettes) params.set('statut', statutRecettes)
      const res = await fetch(`/api/comptabilite/recettes?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setRecettes((data.recettes || []) as Recette[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoadingRec(false)
    }
  }

  async function loadDepenses() {
    setLoadingDep(true); setError('')
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (agenceDepenses) params.set('agence', agenceDepenses)
      if (categorieDepenses) params.set('categorie', categorieDepenses)
      const res = await fetch(`/api/factures-fournisseurs?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDepenses((data.factures || []) as Depense[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoadingDep(false)
    }
  }

  useEffect(() => { loadRecettes() }, [from, to, agenceRecettes, statutRecettes])
  useEffect(() => { loadDepenses() }, [from, to, agenceDepenses, categorieDepenses])

  // KPI
  const kpis = useMemo(() => {
    const recettesActives = recettes.filter(r => r.statut !== 'annule')
    const ca_ht  = recettesActives.reduce((s, r) => s + (r.montant_ht || 0), 0)
    const ca_ttc = recettesActives.reduce((s, r) => s + (r.montant_ttc || 0), 0)
    const tva_collectee = ca_ttc - ca_ht

    const dep_ht  = depenses.reduce((s, d) => s + (d.montant_ht || 0), 0)
    const dep_ttc = depenses.reduce((s, d) => s + (d.montant_ttc || 0), 0)
    const tva_deductible = depenses.reduce((s, d) => s + (d.tva || 0), 0)

    const resultat_brut_ht = ca_ht - dep_ht
    const marge = ca_ht > 0 ? (resultat_brut_ht / ca_ht) * 100 : 0

    return {
      ca_ht, ca_ttc, tva_collectee,
      dep_ht, dep_ttc, tva_deductible,
      resultat_brut_ht, marge,
    }
  }, [recettes, depenses])

  // Données graphique : 12 derniers mois (recettes vs dépenses HT)
  const monthlyChart = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string; rec: number; dep: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
      months.push({
        key,
        label: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
        rec: 0, dep: 0,
      })
    }
    const idx = (k: string) => months.findIndex(m => m.key === k)
    for (const r of recettes) {
      if (r.statut === 'annule') continue
      const k = (r.date_emission || '').slice(0, 7)
      const i = idx(k)
      if (i >= 0) months[i].rec += r.montant_ht || 0
    }
    for (const d of depenses) {
      const k = (d.date_facture || '').slice(0, 7)
      const i = idx(k)
      if (i >= 0) months[i].dep += d.montant_ht || 0
    }
    const max = Math.max(1, ...months.flatMap(m => [m.rec, m.dep]))
    return { months, max }
  }, [recettes, depenses])

  // Camembert dépenses par catégorie
  const pieDepenses = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const d of depenses) {
      const c = d.categorie || 'autre'
      totals[c] = (totals[c] || 0) + (d.montant_ht || 0)
    }
    const entries = Object.entries(totals).filter(([, v]) => v > 0)
    const total = entries.reduce((s, [, v]) => s + v, 0)
    return { entries, total }
  }, [depenses])

  // ===== Render =====
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
          <div className="text-[11px] opacity-70">Comptabilité</div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* Sous-onglets */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-wrap gap-2">
          {SUBTABS.map(t => (
            <button
              key={t.key}
              onClick={() => setSubtab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                subtab === t.key
                  ? 'bg-[#0e2a52] text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Sélecteur période (commun à dashboard / recettes / depenses) */}
        {subtab !== 'export' && (
          <PeriodPicker from={from} to={to} setFrom={setFrom} setTo={setTo} />
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {subtab === 'dashboard' && (
          <DashboardTab
            kpis={kpis}
            monthlyChart={monthlyChart}
            pieDepenses={pieDepenses}
            loading={loadingRec || loadingDep}
          />
        )}

        {subtab === 'recettes' && (
          <RecettesTab
            recettes={recettes}
            loading={loadingRec}
            agence={agenceRecettes}
            setAgence={setAgenceRecettes}
            statut={statutRecettes}
            setStatut={setStatutRecettes}
          />
        )}

        {subtab === 'depenses' && (
          <DepensesTab
            depenses={depenses}
            loading={loadingDep}
            agence={agenceDepenses}
            setAgence={setAgenceDepenses}
            categorie={categorieDepenses}
            setCategorie={setCategorieDepenses}
            onAdd={() => { setEditing(null); setModalOpen(true) }}
            onEdit={(d) => { setEditing(d); setModalOpen(true) }}
            onDeleted={(id) => setDepenses(prev => prev.filter(d => d.id !== id))}
          />
        )}

        {subtab === 'export' && (
          <ExportTab from={from} to={to} setFrom={setFrom} setTo={setTo} />
        )}
      </main>

      {modalOpen && (
        <DepenseModal
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); loadDepenses() }}
        />
      )}
    </div>
  )
}

// =====================================================================
// PeriodPicker
// =====================================================================

function PeriodPicker({
  from, to, setFrom, setTo,
}: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  function applyPreset(p: 'mois' | 'trimestre' | 'annee') {
    const r = p === 'mois' ? presetThisMonth() : p === 'trimestre' ? presetThisQuarter() : presetThisYear()
    setFrom(r.from); setTo(r.to)
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Du</label>
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Au</label>
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => applyPreset('mois')} className="px-3 py-2 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">Ce mois</button>
        <button onClick={() => applyPreset('trimestre')} className="px-3 py-2 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">Trimestre</button>
        <button onClick={() => applyPreset('annee')} className="px-3 py-2 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">Année</button>
      </div>
    </div>
  )
}

// =====================================================================
// Dashboard
// =====================================================================

type Kpis = {
  ca_ht: number; ca_ttc: number; tva_collectee: number
  dep_ht: number; dep_ttc: number; tva_deductible: number
  resultat_brut_ht: number; marge: number
}

function DashboardTab({
  kpis, monthlyChart, pieDepenses, loading,
}: {
  kpis: Kpis
  monthlyChart: { months: { key: string; label: string; rec: number; dep: number }[]; max: number }
  pieDepenses: { entries: [string, number][]; total: number }
  loading: boolean
}) {
  const positif = kpis.resultat_brut_ht >= 0
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="CA HT"           value={fmtEUR(kpis.ca_ht)}  icon="💶" tone="blue" />
        <KpiCard label="CA TTC"          value={fmtEUR(kpis.ca_ttc)} icon="💰" tone="blue" />
        <KpiCard label="TVA collectée"   value={fmtEUR(kpis.tva_collectee)} icon="🧾" tone="slate" />
        <KpiCard label="Marge brute"     value={fmtPct(kpis.marge)}  icon="📈" tone={positif ? 'green' : 'red'} />

        <KpiCard label="Dépenses HT"     value={fmtEUR(kpis.dep_ht)}  icon="🛒" tone="amber" />
        <KpiCard label="Dépenses TTC"    value={fmtEUR(kpis.dep_ttc)} icon="📦" tone="amber" />
        <KpiCard label="TVA déductible"  value={fmtEUR(kpis.tva_deductible)} icon="📤" tone="slate" />
        <KpiCard
          label="Résultat brut HT"
          value={fmtEUR(kpis.resultat_brut_ht)}
          icon={positif ? '✅' : '⚠️'}
          tone={positif ? 'green' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Barres mensuelles */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-bold text-[#0e2a52] mb-4">Recettes vs Dépenses (12 derniers mois, HT)</h3>
          <div className="space-y-2">
            {monthlyChart.months.map(m => {
              const wRec = (m.rec / monthlyChart.max) * 100
              const wDep = (m.dep / monthlyChart.max) * 100
              return (
                <div key={m.key} className="text-xs">
                  <div className="flex items-center gap-2 text-slate-500 mb-0.5">
                    <span className="w-12 font-semibold">{m.label}</span>
                    <span className="ml-auto tabular-nums text-emerald-600">{fmtEUR(m.rec)}</span>
                    <span className="text-slate-400">/</span>
                    <span className="tabular-nums text-rose-600">{fmtEUR(m.dep)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 ml-12">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${wRec}%` }} />
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500" style={{ width: `${wDep}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 mt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Recettes HT</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" />Dépenses HT</span>
          </div>
        </div>

        {/* Camembert dépenses par catégorie */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-bold text-[#0e2a52] mb-4">Dépenses par catégorie (HT)</h3>
          {pieDepenses.entries.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune dépense sur la période.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <PieChart entries={pieDepenses.entries} total={pieDepenses.total} />
              <ul className="flex-1 space-y-2 text-sm w-full">
                {pieDepenses.entries.map(([cat, val]) => {
                  const pct = pieDepenses.total > 0 ? (val / pieDepenses.total) * 100 : 0
                  return (
                    <li key={cat} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm" style={{ background: CAT_COLORS[cat] || '#64748b' }} />
                      <span className="capitalize text-slate-700 font-semibold">{cat.replace('_', ' ')}</span>
                      <span className="ml-auto tabular-nums text-slate-600">{fmtEUR(val)}</span>
                      <span className="tabular-nums text-slate-400 text-xs w-12 text-right">{fmtPct(pct)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-500 text-sm">
          Chargement…
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, icon, tone }: {
  label: string; value: string; icon: string;
  tone: 'blue' | 'green' | 'red' | 'amber' | 'slate'
}) {
  const tones: Record<string, string> = {
    blue:  'text-[#0e2a52]',
    green: 'text-emerald-600',
    red:   'text-rose-600',
    amber: 'text-amber-600',
    slate: 'text-slate-700',
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <div className="flex justify-between items-start">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</div>
        <span className="text-xl">{icon}</span>
      </div>
      <div className={`text-2xl font-black mt-1 ${tones[tone]}`}>{value}</div>
    </div>
  )
}

function PieChart({ entries, total }: { entries: [string, number][]; total: number }) {
  const size = 160
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4

  if (total <= 0) return null

  let acc = 0
  const slices = entries.map(([cat, val]) => {
    const start = acc / total
    acc += val
    const end = acc / total
    return { cat, val, start, end }
  })

  function arcPath(start: number, end: number): string {
    if (end - start >= 0.9999) {
      // cercle complet — split en 2 demi-cercles
      const mid = start + 0.5
      return arcPath(start, mid) + ' ' + arcPath(mid, end)
    }
    const a0 = start * 2 * Math.PI - Math.PI / 2
    const a1 = end * 2 * Math.PI - Math.PI / 2
    const x0 = cx + r * Math.cos(a0)
    const y0 = cy + r * Math.sin(a0)
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const large = end - start > 0.5 ? 1 : 0
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {slices.map(s => (
        <path
          key={s.cat}
          d={arcPath(s.start, s.end)}
          fill={CAT_COLORS[s.cat] || '#64748b'}
          stroke="white"
          strokeWidth={2}
        />
      ))}
    </svg>
  )
}

// =====================================================================
// Recettes
// =====================================================================

function RecettesTab({
  recettes, loading, agence, setAgence, statut, setStatut,
}: {
  recettes: Recette[]; loading: boolean
  agence: string; setAgence: (v: string) => void
  statut: string; setStatut: (v: string) => void
}) {
  const totals = useMemo(() => {
    let ht = 0, ttc = 0
    for (const r of recettes) {
      if (r.statut === 'annule') continue
      ht += r.montant_ht || 0
      ttc += r.montant_ttc || 0
    }
    return { ht, ttc, tva: ttc - ht, count: recettes.length }
  }, [recettes])

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-wrap gap-2 items-end">
        <SelectField label="Agence" value={agence} onChange={setAgence} options={[{ value: '', label: 'Toutes' }, ...AGENCES.map(a => ({ value: a, label: a }))]} />
        <SelectField label="Statut" value={statut} onChange={setStatut} options={[
          { value: '', label: 'Tous' },
          { value: 'envoye', label: 'Envoyé' },
          { value: 'paye', label: 'Payé' },
          { value: 'brouillon', label: 'Brouillon' },
          { value: 'annule', label: 'Annulé' },
        ]} />
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-[#0e2a52]">Recettes ({recettes.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">N°</th>
                <th className="px-4 py-2 text-left">Client</th>
                <th className="px-4 py-2 text-left">Agence</th>
                <th className="px-4 py-2 text-right">HT</th>
                <th className="px-4 py-2 text-right">TVA</th>
                <th className="px-4 py-2 text-right">TTC</th>
                <th className="px-4 py-2 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={8}>Chargement…</td></tr>
              )}
              {!loading && recettes.length === 0 && (
                <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={8}>Aucune facture cliente sur la période.</td></tr>
              )}
              {!loading && recettes.map(r => {
                const tva = (r.montant_ttc || 0) - (r.montant_ht || 0)
                return (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{fmtDateFR(r.date_emission)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.numero || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{r.client_nom || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{r.agence || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{fmtEUR(r.montant_ht)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{fmtEUR(tva)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-[#0e2a52]">{fmtEUR(r.montant_ttc)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUT_BADGE[r.statut] || 'bg-slate-100 text-slate-600'}`}>
                        {r.statut}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {recettes.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-4 py-3 font-bold text-[#0e2a52]" colSpan={4}>TOTAL ({totals.count} factures, hors annulées)</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-700">{fmtEUR(totals.ht)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-600">{fmtEUR(totals.tva)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-black text-[#0e2a52]">{fmtEUR(totals.ttc)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  )
}

// =====================================================================
// Dépenses
// =====================================================================

function DepensesTab({
  depenses, loading, agence, setAgence, categorie, setCategorie, onAdd, onEdit, onDeleted,
}: {
  depenses: Depense[]; loading: boolean
  agence: string; setAgence: (v: string) => void
  categorie: string; setCategorie: (v: string) => void
  onAdd: () => void
  onEdit: (d: Depense) => void
  onDeleted: (id: string) => void
}) {
  const totals = useMemo(() => {
    let ht = 0, tva = 0, ttc = 0
    for (const d of depenses) { ht += d.montant_ht || 0; tva += d.tva || 0; ttc += d.montant_ttc || 0 }
    return { ht, tva, ttc, count: depenses.length }
  }, [depenses])

  async function handleDelete(d: Depense) {
    if (!confirm(`Supprimer la facture ${d.fournisseur} ${d.numero || ''} ?`)) return
    try {
      const res = await fetch(`/api/factures-fournisseurs/${d.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onDeleted(d.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur de suppression')
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-wrap gap-2 items-end">
        <SelectField label="Catégorie" value={categorie} onChange={setCategorie} options={[
          { value: '', label: 'Toutes' },
          ...CATEGORIES.map(c => ({ value: c.value, label: c.label })),
        ]} />
        <SelectField label="Agence" value={agence} onChange={setAgence} options={[{ value: '', label: 'Toutes' }, ...AGENCES.map(a => ({ value: a, label: a }))]} />
        <button
          onClick={onAdd}
          className="ml-auto bg-[#0e2a52] text-white px-4 py-3 rounded-xl font-bold hover:opacity-90"
        >
          + Nouvelle dépense
        </button>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-[#0e2a52]">Dépenses ({depenses.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Fournisseur</th>
                <th className="px-4 py-2 text-left">N°</th>
                <th className="px-4 py-2 text-left">Catégorie</th>
                <th className="px-4 py-2 text-right">HT</th>
                <th className="px-4 py-2 text-right">TVA</th>
                <th className="px-4 py-2 text-right">TTC</th>
                <th className="px-4 py-2 text-left">Agence</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={9}>Chargement…</td></tr>
              )}
              {!loading && depenses.length === 0 && (
                <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={9}>Aucune dépense sur la période.</td></tr>
              )}
              {!loading && depenses.map(d => (
                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{fmtDateFR(d.date_facture)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{d.fournisseur}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{d.numero || '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {d.categorie ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold text-white"
                        style={{ background: CAT_COLORS[d.categorie] || '#64748b' }}
                      >
                        {d.categorie.replace('_', ' ')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{fmtEUR(d.montant_ht)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{fmtEUR(d.tva)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-[#0e2a52]">{fmtEUR(d.montant_ttc)}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{d.agence || '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => onEdit(d)} className="text-blue-600 hover:text-blue-800 mr-2" title="Éditer" aria-label="Éditer">✏️</button>
                    <button onClick={() => handleDelete(d)} className="text-rose-600 hover:text-rose-800" title="Supprimer" aria-label="Supprimer">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {depenses.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-4 py-3 font-bold text-[#0e2a52]" colSpan={4}>TOTAL ({totals.count} factures)</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-700">{fmtEUR(totals.ht)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-600">{fmtEUR(totals.tva)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-black text-[#0e2a52]">{fmtEUR(totals.ttc)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  )
}

// =====================================================================
// Modal Dépense
// =====================================================================

function DepenseModal({
  editing, onClose, onSaved,
}: { editing: Depense | null; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [fournisseur, setFournisseur] = useState(editing?.fournisseur || '')
  const [numero, setNumero] = useState(editing?.numero || '')
  const [dateFacture, setDateFacture] = useState(editing?.date_facture || today)
  const [ht, setHt] = useState<string>(editing ? String(editing.montant_ht).replace('.', ',') : '')
  const [tva, setTva] = useState<string>(editing ? String(editing.tva).replace('.', ',') : '')
  const [ttc, setTtc] = useState<string>(editing ? String(editing.montant_ttc).replace('.', ',') : '')
  const [ttcManuel, setTtcManuel] = useState(false)
  const [categorie, setCategorie] = useState<string>(editing?.categorie || '')
  const [description, setDescription] = useState(editing?.description || '')
  const [agence, setAgence] = useState<string>(editing?.agence || '')
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  function parseNum(s: string): number {
    if (!s) return 0
    const n = Number(s.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  // Calcul auto TTC = HT + TVA si TTC pas encore édité manuellement
  useEffect(() => {
    if (ttcManuel) return
    const sum = parseNum(ht) + parseNum(tva)
    if (sum > 0) setTtc(sum.toFixed(2).replace('.', ','))
  }, [ht, tva, ttcManuel])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrMsg('')

    if (!fournisseur.trim()) { setErrMsg('Le fournisseur est requis.'); return }
    if (!dateFacture) { setErrMsg('La date est requise.'); return }

    const payload = {
      fournisseur: fournisseur.trim(),
      numero: numero.trim() || null,
      date_facture: dateFacture,
      montant_ht: parseNum(ht),
      tva: parseNum(tva),
      montant_ttc: parseNum(ttc),
      categorie: categorie || null,
      description: description.trim() || null,
      agence: agence || null,
    }

    setSaving(true)
    try {
      const url = editing ? `/api/factures-fournisseurs/${editing.id}` : '/api/factures-fournisseurs'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onSaved()
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Erreur d’enregistrement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-auto">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-black text-[#0e2a52] text-lg">
            {editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-xl leading-none" aria-label="Fermer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Fournisseur *">
              <input
                type="text"
                value={fournisseur}
                onChange={e => setFournisseur(e.target.value)}
                required
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2"
              />
            </Field>
            <Field label="N° de facture">
              <input
                type="text"
                value={numero}
                onChange={e => setNumero(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2"
              />
            </Field>
            <Field label="Date facture *">
              <input
                type="date"
                value={dateFacture}
                onChange={e => setDateFacture(e.target.value)}
                required
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2"
              />
            </Field>
            <Field label="Catégorie">
              <select
                value={categorie}
                onChange={e => setCategorie(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 bg-white"
              >
                <option value="">— Aucune —</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>

            <Field label="Montant HT (€)">
              <input
                type="text"
                inputMode="decimal"
                value={ht}
                onChange={e => setHt(e.target.value)}
                placeholder="0,00"
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 tabular-nums"
              />
            </Field>
            <Field label="TVA (€)">
              <input
                type="text"
                inputMode="decimal"
                value={tva}
                onChange={e => setTva(e.target.value)}
                placeholder="0,00"
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 tabular-nums"
              />
            </Field>
            <Field label="Montant TTC (€)">
              <input
                type="text"
                inputMode="decimal"
                value={ttc}
                onChange={e => { setTtc(e.target.value); setTtcManuel(true) }}
                placeholder="0,00"
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 tabular-nums"
              />
              <p className="text-[11px] text-slate-400 mt-1">{ttcManuel ? 'Édité manuellement' : 'Calculé auto = HT + TVA'}</p>
            </Field>
            <Field label="Agence">
              <select
                value={agence}
                onChange={e => setAgence(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 bg-white"
              >
                <option value="">— Aucune —</option>
                {AGENCES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2"
            />
          </Field>

          {errMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
              {errMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-3 rounded-xl font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">Annuler</button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#0e2a52] text-white px-4 py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : (editing ? 'Mettre à jour' : 'Créer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =====================================================================
// Export
// =====================================================================

function ExportTab({
  from, to, setFrom, setTo,
}: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  function buildUrl(base: string, extra: Record<string, string> = {}): string {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v)
    }
    return `${base}?${params.toString()}`
  }
  return (
    <div className="space-y-4">
      <PeriodPicker from={from} to={to} setFrom={setFrom} setTo={setTo} />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h3 className="font-bold text-[#0e2a52] mb-2">Exports comptables</h3>
        <p className="text-sm text-slate-500">
          Les exports respectent la période sélectionnée. Le FEC suit le format légal français
          (arrêté du 29 juillet 2013) et peut être transmis à un expert-comptable ou à
          l’administration fiscale.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <a
            href={buildUrl('/api/export/csv', { type: 'recettes' })}
            className="block bg-[#0e2a52] text-white px-4 py-3 rounded-xl font-bold text-center hover:opacity-90"
            download
          >
            📥 CSV recettes
          </a>
          <a
            href={buildUrl('/api/export/csv', { type: 'depenses' })}
            className="block bg-[#0e2a52] text-white px-4 py-3 rounded-xl font-bold text-center hover:opacity-90"
            download
          >
            📥 CSV dépenses
          </a>
          <a
            href={buildUrl('/api/export/fec')}
            className="block bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold text-center hover:opacity-90"
            download
          >
            📥 Export FEC (.txt)
          </a>
        </div>

        <div className="text-xs text-slate-500 pt-3 border-t border-slate-100 space-y-1">
          <p><strong>CSV :</strong> séparateur point-virgule, encodage UTF-8 avec BOM (compatible Excel FR).</p>
          <p><strong>FEC :</strong> 18 colonnes, séparateur tabulation, virgule décimale, comptes français standards (411/706/44571 ventes, 401/44566/6X achats).</p>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// Petits composants utilitaires
// =====================================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 text-sm bg-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
