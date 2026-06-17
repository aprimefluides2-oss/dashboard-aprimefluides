'use client'
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import RapportTabs from "@/components/RapportTabs"

type RapportRow = {
  id: string
  reference: string | null
  type_intervention: string | null
  ville: string | null
  code_postal: string | null
  date_realisee: string | null
  date_prevue: string | null
  statut: string | null
  agence: string | null
  publie_slug: string | null
  pdf_rapport_url: string | null
  created_at: string
  client_id: string | null
  technicien_nom: string | null
  has_rapport: boolean
  client_nom: string | null
  client_email: string | null
  client_ville: string | null
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function statutClass(s: string | null): string {
  switch (s) {
    case 'planifiee': return 'bg-blue-100 text-blue-700'
    case 'en_cours': return 'bg-amber-100 text-amber-700'
    case 'terminee': return 'bg-emerald-100 text-emerald-700'
    case 'annulee': return 'bg-slate-200 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}

export default function RapportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rapports, setRapports] = useState<RapportRow[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterVille, setFilterVille] = useState<string>('')
  const [filterStatut, setFilterStatut] = useState<string>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch('/api/historique?limit=500', { cache: 'no-store' })
        const json = await res.json()
        if (!alive) return
        if (json.error) throw new Error(json.error)
        const rows: RapportRow[] = (json.interventions || []).filter((i: RapportRow) => i.has_rapport)
        setRapports(rows)
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
    for (const r of rapports) if (r.ville) set.add(r.ville)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [rapports])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return rapports.filter(r => {
      if (s) {
        const blob = [
          r.reference, r.client_nom, r.client_email, r.ville, r.client_ville,
          r.type_intervention, r.agence, r.technicien_nom, r.publie_slug,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!blob.includes(s)) return false
      }
      if (filterVille && r.ville !== filterVille) return false
      if (filterStatut && r.statut !== filterStatut) return false
      if (from || to) {
        const ymd = (r.date_realisee || r.date_prevue || r.created_at || '').slice(0, 10)
        if (from && ymd < from) return false
        if (to && ymd > to) return false
      }
      return true
    }).sort((a, b) => {
      const da = a.date_realisee || a.date_prevue || a.created_at
      const db = b.date_realisee || b.date_prevue || b.created_at
      return (db || '').localeCompare(da || '')
    })
  }, [rapports, search, filterVille, filterStatut, from, to])

  function modifierRapport(id: string) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ltdb_load_rapport_id', id)
    }
    router.push('/nouveau')
  }

  async function reload() {
    const res = await fetch('/api/historique?limit=500', { cache: 'no-store' })
    const json = await res.json()
    if (json.error) throw new Error(json.error)
    const rows: RapportRow[] = (json.interventions || []).filter((i: RapportRow) => i.has_rapport)
    setRapports(rows)
  }

  async function supprimerRapport(r: RapportRow) {
    const label = r.reference ? `l'intervention ${r.reference}` : `cette intervention (${r.client_nom || 'sans client'})`
    const ok = confirm(
      `Supprimer ${label} ?\n\n` +
      `Cela efface aussi : rapport, facture(s), devis, attestation(s) et photos liés.\n\n` +
      `Action irréversible.`
    )
    if (!ok) return
    setDeletingId(r.id); setError(null)
    try {
      const res = await fetch(`/api/interventions/${r.id}?hard=1`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || (data.warnings ? data.warnings.join('; ') : `HTTP ${res.status}`))
      // Recharge depuis le serveur — garantit que la ligne n'est pas un fantôme
      // côté UI si le cascade a échoué silencieusement.
      await reload()
    } catch (e) {
      setError(`Erreur suppression : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="text-xl font-black tracking-tight hover:opacity-80">Aprime fluides</Link>
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-semibold">Rapports</span>
          </div>
          <Link href="/" className="text-xs text-white/70 hover:text-white">← Accueil</Link>
        </div>
      </header>

      <RapportTabs current="liste" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Filtres */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Rechercher (client, n°, ville, type…)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="lg:col-span-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            />
            <select
              value={filterVille}
              onChange={e => setFilterVille(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            >
              <option value="">Toutes villes</option>
              {villes.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select
              value={filterStatut}
              onChange={e => setFilterStatut(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            >
              <option value="">Tout statut</option>
              <option value="planifiee">Planifiée</option>
              <option value="en_cours">En cours</option>
              <option value="terminee">Terminée</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs" />
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs" />
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-slate-500">{filtered.length} rapport{filtered.length > 1 ? 's' : ''}</div>
            {(search || filterVille || filterStatut || from || to) && (
              <button
                onClick={() => { setSearch(''); setFilterVille(''); setFilterStatut(''); setFrom(''); setTo('') }}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50"
              >Réinitialiser</button>
            )}
          </div>
        </div>

        {/* Liste */}
        {loading && <div className="text-center py-12 text-slate-500 text-sm">Chargement…</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">Aucun rapport ne correspond aux filtres.</div>
        )}

        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm sm:text-base">{r.client_nom || 'Client sans nom'}</span>
                    {r.statut && (
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${statutClass(r.statut)}`}>{r.statut}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {[r.reference, r.type_intervention, r.ville, fmtDate(r.date_realisee || r.date_prevue || r.created_at)].filter(Boolean).join(' · ')}
                  </div>
                  {r.technicien_nom && (
                    <div className="text-[11px] text-slate-400 mt-0.5">par {r.technicien_nom}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.pdf_rapport_url && (
                    <a
                      href={r.pdf_rapport_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                    >📄 PDF</a>
                  )}
                  <Link
                    href={`/intervention/${r.id}`}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50"
                  >Voir →</Link>
                  <button
                    onClick={() => modifierRapport(r.id)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#0e2a52] text-white hover:bg-[#0a1f3d]"
                  >✏️ Modifier</button>
                  <button
                    onClick={() => supprimerRapport(r)}
                    disabled={deletingId === r.id}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Supprimer ${r.reference || 'cette intervention'}`}
                    title="Supprimer (cascade : rapport, facture, devis, photos)"
                  >{deletingId === r.id ? '…' : '🗑'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

