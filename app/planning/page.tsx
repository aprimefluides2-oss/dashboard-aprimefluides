'use client'
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import AppTabs from "@/components/AppTabs"
import CalendarSubscribePanel from "@/components/CalendarSubscribePanel"
import VilleCombobox from "@/components/VilleCombobox"
import { AGENCES } from "@/lib/agences"
import { CANAUX_ACQUISITION } from "@/lib/canaux"
import { fmtDateFR, fmtEUR } from "@/lib/format"
import { TYPES_INTERVENTION as TYPES } from "@/lib/types-intervention"

type Statut = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

type InterventionRow = {
  id: string
  reference: string | null
  client_id: string | null
  technicien_id: string | null
  agence: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_prevue: string | null
  heure_prevue: string | null
  duree_estimee_min: number | null
  date_realisee: string | null
  urgence: boolean
  statut: Statut
  prix_prevu: number | null
  notes_internes: string | null
  publie_slug: string | null
  created_at: string
  updated_at: string
  client_nom: string | null
  client_email: string | null
  client_telephone: string | null
  technicien_nom: string | null
  technicien_email: string | null
}

type Technicien = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  agence: string | null
  actif: boolean
}

type ClientRow = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

type DateFilter = 'all' | 'today' | 'week'

const STATUT_LABEL: Record<Statut, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
}

const STATUT_BADGE: Record<Statut, string> = {
  planifiee: 'bg-red-100 text-red-700',
  en_cours: 'bg-blue-100 text-blue-700',
  terminee: 'bg-emerald-100 text-emerald-700',
  annulee: 'bg-slate-200 text-slate-600',
}

/** Bordure gauche des cartes kanban : rouge à venir · bleu en cours · vert terminée */
const CARD_STATUT_ACCENT: Record<Statut, string> = {
  planifiee: 'border-l-4 border-l-red-500',
  en_cours: 'border-l-4 border-l-blue-500',
  terminee: 'border-l-4 border-l-emerald-500',
  annulee: 'border-l-4 border-l-slate-400',
}

function fmtHeure(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5)
}

function startOfWeekISO(d: Date): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day // lundi
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

function endOfWeekISO(d: Date): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? 0 : 7 - day // dimanche
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

export default function PlanningPage() {
  const [interventions, setInterventions] = useState<InterventionRow[]>([])
  const [techniciens, setTechniciens] = useState<Technicien[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filterStatut, setFilterStatut] = useState<'all' | Statut>('all')
  const [filterTech, setFilterTech] = useState<string>('all')
  const [filterAgence, setFilterAgence] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<DateFilter>('week')

  const [showForm, setShowForm] = useState(false)
  const [showTechs, setShowTechs] = useState(false)

  async function loadAll() {
    setLoading(true); setError('')
    try {
      const [intRes, techRes] = await Promise.all([
        fetch('/api/interventions', { cache: 'no-store' }),
        fetch('/api/techniciens', { cache: 'no-store' }),
      ])
      const intData = await intRes.json()
      const techData = await techRes.json()
      if (!intRes.ok) throw new Error(intData.error || 'Erreur interventions')
      if (!techRes.ok) throw new Error(techData.error || 'Erreur techniciens')
      setInterventions(intData.interventions || [])
      setTechniciens(techData.techniciens || [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const filtered = useMemo(() => {
    let rows = [...interventions]
    if (filterStatut !== 'all') rows = rows.filter(i => i.statut === filterStatut)
    if (filterTech !== 'all') {
      rows = filterTech === 'none'
        ? rows.filter(i => !i.technicien_id)
        : rows.filter(i => i.technicien_id === filterTech)
    }
    if (filterAgence !== 'all') rows = rows.filter(i => i.agence === filterAgence)
    if (filterDate === 'today') {
      const today = new Date().toISOString().slice(0, 10)
      rows = rows.filter(i => i.date_prevue === today)
    } else if (filterDate === 'week') {
      const now = new Date()
      const start = startOfWeekISO(now)
      const end = endOfWeekISO(now)
      rows = rows.filter(i => {
        // Une intervention compte dans la semaine si SA DATE PREVUE ou SA DATE REALISEE
        // tombe dans la fenêtre. Sans le date_realisee fallback, une intervention finie
        // aujourd'hui mais initialement planifiée la semaine d'avant disparaît du kanban.
        const ref = i.date_prevue || i.date_realisee
        if (!ref) return false
        return ref >= start && ref <= end
      })
    }
    return rows
  }, [interventions, filterStatut, filterTech, filterAgence, filterDate])

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-7xl mx-auto px-4">
          <AppTabs />
        </div>
      </div>

      <nav className="bg-[#0e2a52] text-white px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="font-black text-base sm:text-lg leading-tight">Aprime fluides</div>
            <div className="text-[11px] opacity-70">Planning &amp; dispatch</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTechs(true)}
              className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition"
            >
              👥 Techniciens
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="bg-white text-[#0e2a52] px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-100 transition shadow"
            >
              + Nouvelle intervention
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-4">
        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FilterSelect
            label="Statut"
            value={filterStatut}
            onChange={v => setFilterStatut(v as 'all' | Statut)}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'planifiee', label: 'Planifiée' },
              { value: 'en_cours', label: 'En cours' },
              { value: 'terminee', label: 'Terminée' },
              { value: 'annulee', label: 'Annulée' },
            ]}
          />
          <FilterSelect
            label="Technicien"
            value={filterTech}
            onChange={setFilterTech}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'none', label: 'Non assignée' },
              ...techniciens.map(t => ({ value: t.id, label: t.nom })),
            ]}
          />
          <FilterSelect
            label="Agence"
            value={filterAgence}
            onChange={setFilterAgence}
            options={[
              { value: 'all', label: 'Toutes' },
              ...AGENCES.map(a => ({ value: a, label: a })),
            ]}
          />
          <FilterSelect
            label="Date"
            value={filterDate}
            onChange={v => setFilterDate(v as DateFilter)}
            options={[
              { value: 'week', label: 'Cette semaine' },
              { value: 'today', label: "Aujourd'hui" },
              { value: 'all', label: 'Tout' },
            ]}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}

        {loading && !error && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
            Chargement…
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
            <div className="text-4xl">📅</div>
            <p className="text-slate-700 font-semibold">Aucune intervention pour ces filtres.</p>
            <p className="text-slate-500 text-sm">Crée-en une ou élargis les filtres.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <KanbanBoard
            interventions={filtered}
            filterStatut={filterStatut}
            onRefresh={loadAll}
          />
        )}

        <CalendarSubscribePanel />
      </main>

      {showForm && (
        <NouvelleInterventionModal
          techniciens={techniciens}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); loadAll() }}
        />
      )}

      {showTechs && (
        <TechniciensDrawer
          onClose={() => setShowTechs(false)}
          onChanged={() => { loadAll() }}
        />
      )}
    </div>
  )
}

// ====================================================================
// KanbanBoard — desktop : 3 colonnes (à venir / en cours / terminées)
//                mobile  : sections empilées
// ====================================================================
type ColumnDef = { key: Statut; label: string; emoji: string; accent: string; subAccent: string }

const KANBAN_COLUMNS: ColumnDef[] = [
  { key: 'planifiee', label: 'À venir',    emoji: '📅', accent: 'border-red-200',     subAccent: 'bg-red-50 text-red-700' },
  { key: 'en_cours',  label: 'En cours',   emoji: '⚙',  accent: 'border-blue-200',    subAccent: 'bg-blue-50 text-blue-700' },
  { key: 'terminee',  label: 'Terminées',  emoji: '✅', accent: 'border-emerald-200', subAccent: 'bg-emerald-50 text-emerald-700' },
]

function KanbanBoard({
  interventions, filterStatut, onRefresh,
}: {
  interventions: InterventionRow[]
  filterStatut: 'all' | Statut
  onRefresh: () => void
}) {
  // Quand le filterStatut est sur l'une des 3 colonnes du kanban, on affiche
  // uniquement cette colonne en pleine largeur. Sinon, les 3 (ou 4 avec annulée).
  const visibleColumns: ColumnDef[] = filterStatut === 'all' || filterStatut === 'annulee'
    ? KANBAN_COLUMNS
    : KANBAN_COLUMNS.filter(c => c.key === filterStatut)

  const grouped: Record<Statut, InterventionRow[]> = {
    planifiee: [],
    en_cours: [],
    terminee: [],
    annulee: [],
  }
  for (const i of interventions) grouped[i.statut].push(i)

  // Tri : à venir par date asc, en cours par date asc, terminées par date desc
  grouped.planifiee.sort((a, b) => (a.date_prevue || '').localeCompare(b.date_prevue || ''))
  grouped.en_cours.sort((a, b) => (a.date_prevue || '').localeCompare(b.date_prevue || ''))
  grouped.terminee.sort((a, b) => (b.date_realisee || b.date_prevue || '').localeCompare(a.date_realisee || a.date_prevue || ''))

  // Cas particulier : si filterStatut = 'annulee', on affiche les annulées en colonne unique
  if (filterStatut === 'annulee') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-[#0e2a52]">🚫 Annulées ({grouped.annulee.length})</h3>
          <button onClick={onRefresh} className="text-xs font-bold text-blue-700 hover:text-blue-900">↻ Rafraîchir</button>
        </div>
        <div className="space-y-2">
          {grouped.annulee.map(i => <InterventionCard key={i.id} intervention={i} />)}
          {grouped.annulee.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">Aucune intervention annulée.</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end px-1">
        <button onClick={onRefresh} className="text-xs font-bold text-blue-700 hover:text-blue-900">↻ Rafraîchir</button>
      </div>
      <div className={`grid gap-4 ${
        visibleColumns.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'
      }`}>
        {visibleColumns.map(col => (
          <KanbanColumn key={col.key} col={col} items={grouped[col.key]} />
        ))}
      </div>
    </div>
  )
}

function KanbanColumn({ col, items }: { col: ColumnDef; items: InterventionRow[] }) {
  return (
    <section className={`bg-white rounded-2xl shadow-sm border-2 ${col.accent} overflow-hidden flex flex-col`}>
      <header className={`px-4 py-3 ${col.subAccent} flex items-center justify-between border-b ${col.accent}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{col.emoji}</span>
          <h3 className="font-bold text-sm uppercase tracking-wider">{col.label}</h3>
        </div>
        <span className="bg-white/70 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums">
          {items.length}
        </span>
      </header>
      <div className="flex-1 p-3 space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto bg-slate-50/30">
        {items.length === 0 ? (
          <p className="text-center text-slate-400 text-xs py-8 italic">Aucune intervention</p>
        ) : (
          items.map(i => <InterventionCard key={i.id} intervention={i} compact />)
        )}
      </div>
    </section>
  )
}

function InterventionCard({
  intervention: i, compact,
}: {
  intervention: InterventionRow
  compact?: boolean
}) {
  return (
    <Link
      href={`/intervention/${i.id}`}
      className={`block bg-white rounded-xl border border-slate-200 hover:border-[#0e2a52] hover:shadow-md transition p-3 group ${CARD_STATUT_ACCENT[i.statut]}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {i.urgence && (
              <span className="inline-block text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">URG</span>
            )}
            <span className="font-semibold text-sm text-[#0e2a52] truncate">
              {i.client_nom || 'Client —'}
            </span>
          </div>
          {i.client_telephone && (
            <a
              href={`tel:${i.client_telephone}`}
              onClick={e => e.stopPropagation()}
              className="text-xs text-slate-500 hover:text-blue-600 inline-block"
            >
              📞 {i.client_telephone}
            </a>
          )}
        </div>
        {!compact && (
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${STATUT_BADGE[i.statut]}`}>
            {STATUT_LABEL[i.statut]}
          </span>
        )}
      </div>

      <div className="text-xs text-slate-600 mb-1.5">
        <span className="font-semibold">{i.type_intervention || '—'}</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
        <span>📅 {fmtDateFR(i.date_prevue)}</span>
        {i.heure_prevue && <span>⏰ {fmtHeure(i.heure_prevue)}</span>}
        {i.duree_estimee_min && <span>· {i.duree_estimee_min} min</span>}
      </div>

      {(i.adresse_chantier || i.ville) && (
        <div className="text-xs text-slate-500 mb-1.5 truncate">
          📍 {[i.adresse_chantier, [i.code_postal, i.ville].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
        </div>
      )}

      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
        <span className="text-slate-600 truncate flex-1">
          👷 {i.technicien_nom || <span className="text-slate-400 italic">non assignée</span>}
        </span>
        {typeof i.prix_prevu === 'number' && i.prix_prevu > 0 && (
          <span className="text-[#0e2a52] font-bold tabular-nums whitespace-nowrap ml-2">
            {fmtEUR(i.prix_prevu)}
          </span>
        )}
      </div>

      {i.agence && (
        <div className="text-[10px] text-slate-400 mt-1.5 text-right">{i.agence}</div>
      )}
    </Link>
  )
}

// ====================================================================
// FilterSelect
// ====================================================================
function FilterSelect({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block text-sm">
      <span className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-lg px-2 py-2 mt-1 text-sm bg-white"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

// ====================================================================
// Modal nouvelle intervention
// ====================================================================
function NouvelleInterventionModal({
  techniciens, onClose, onCreated,
}: {
  techniciens: Technicien[]
  onClose: () => void
  onCreated: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Client
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientNom, setClientNom] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientTel, setClientTel] = useState('')
  const [clientAdresse, setClientAdresse] = useState('')
  const [clientCP, setClientCP] = useState('')
  const [clientVille, setClientVille] = useState('')

  // Reconnaissance par téléphone : dès que l'utilisateur saisit un numéro
  // assez long, on cherche un client existant pour proposer de pré-remplir.
  const [phoneMatches, setPhoneMatches] = useState<ClientRow[]>([])
  const [phoneSearching, setPhoneSearching] = useState(false)

  function fillFromClient(c: ClientRow) {
    setClientId(c.id)
    setClientNom(c.nom)
    setClientEmail(c.email || '')
    setClientTel(c.telephone || '')
    setClientAdresse(c.adresse || '')
    setClientCP(c.code_postal || '')
    setClientVille(c.ville || '')
    setPhoneMatches([])
  }

  useEffect(() => {
    // Si un client est déjà sélectionné (autocomplete / fillFromClient), on ne
    // propose plus rien : l'utilisateur a fait son choix.
    if (clientId) {
      setPhoneMatches([])
      return
    }
    const digits = clientTel.replace(/\D/g, '')
    if (digits.length < 6) {
      setPhoneMatches([])
      return
    }
    let cancelled = false
    setPhoneSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?phone=${encodeURIComponent(digits)}&limit=10`, { cache: 'no-store' })
        const data = await res.json()
        if (cancelled) return
        setPhoneMatches((data?.clients || []) as ClientRow[])
      } catch {
        if (!cancelled) setPhoneMatches([])
      } finally {
        if (!cancelled) setPhoneSearching(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [clientTel, clientId])

  // Chantier
  const [chantierIdem, setChantierIdem] = useState(true)
  const [adresseChantier, setAdresseChantier] = useState('')
  const [villeChantier, setVilleChantier] = useState('')
  const [cpChantier, setCpChantier] = useState('')

  // Intervention
  const [typeIntervention, setTypeIntervention] = useState<string>(TYPES[0])
  const today = new Date().toISOString().slice(0, 10)
  const [datePrevue, setDatePrevue] = useState(today)
  const [heurePrevue, setHeurePrevue] = useState('09:00')
  const [dureeMin, setDureeMin] = useState<string>('60')
  const [urgence, setUrgence] = useState(false)
  const [prixPrevu, setPrixPrevu] = useState<string>('')
  const [agence, setAgence] = useState<string>(AGENCES[0])
  const [technicienId, setTechnicienId] = useState<string>('')
  const [canalAcquisition, setCanalAcquisition] = useState<string>('')
  const [notes, setNotes] = useState('')

  async function handleSubmit() {
    if (!clientNom.trim()) { setError('Nom du client requis'); return }
    if (!typeIntervention) { setError("Type d'intervention requis"); return }
    setSubmitting(true); setError('')

    const adresse = chantierIdem ? clientAdresse : adresseChantier
    const ville = chantierIdem ? clientVille : villeChantier
    const cp = chantierIdem ? clientCP : cpChantier

    try {
      const res = await fetch('/api/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            id: clientId || undefined,
            nom: clientNom,
            email: clientEmail || null,
            telephone: clientTel || null,
            adresse: clientAdresse || null,
            code_postal: clientCP || null,
            ville: clientVille || null,
          },
          technicien_id: technicienId || null,
          agence: agence || null,
          type_intervention: typeIntervention,
          adresse_chantier: adresse || null,
          ville: ville || null,
          code_postal: cp || null,
          date_prevue: datePrevue || null,
          heure_prevue: heurePrevue || null,
          duree_estimee_min: dureeMin ? Number(dureeMin) : null,
          urgence,
          prix_prevu: prixPrevu ? Number(prixPrevu) : null,
          canal_acquisition: canalAcquisition || null,
          notes_internes: notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onCreated()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex justify-between items-center rounded-t-2xl">
          <h2 className="text-lg font-black text-[#0e2a52]">Nouvelle intervention</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Client */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Client</h3>
            <SiretLookup
              onFound={(c) => {
                setClientId(null)
                setClientNom(c.nom)
                setClientAdresse(c.adresse)
                setClientCP(c.code_postal)
                setClientVille(c.ville)
              }}
            />
            <ClientAutocomplete
              value={clientNom}
              onTextChange={v => { setClientNom(v); setClientId(null) }}
              onSelect={c => {
                setClientId(c.id)
                setClientNom(c.nom)
                setClientEmail(c.email || '')
                setClientTel(c.telephone || '')
                setClientAdresse(c.adresse || '')
                setClientCP(c.code_postal || '')
                setClientVille(c.ville || '')
              }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Email" type="email" value={clientEmail} onChange={setClientEmail} placeholder="client@exemple.fr" />
              <div>
                <Field label="Téléphone" value={clientTel} onChange={setClientTel} placeholder="06 12 34 56 78" />
                <PhoneMatchHint
                  searching={phoneSearching}
                  matches={phoneMatches}
                  hasClientId={!!clientId}
                  onPick={fillFromClient}
                />
              </div>
              <Field label="Adresse" value={clientAdresse} onChange={setClientAdresse} placeholder="5 rue des Tombades" />
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500">Ville</span>
                <div className="mt-1">
                  <VilleCombobox
                    value={clientVille}
                    onChange={setClientVille}
                    onSelect={v => { setClientVille(v.nom); setClientCP(v.cp) }}
                  />
                </div>
              </label>
              <Field label="Code postal" value={clientCP} onChange={setClientCP} placeholder="95100" />
            </div>
          </section>

          {/* Chantier */}
          <section className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Adresse chantier</h3>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={chantierIdem} onChange={e => setChantierIdem(e.target.checked)} />
              Identique à l&apos;adresse du client
            </label>
            {!chantierIdem && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Adresse chantier" value={adresseChantier} onChange={setAdresseChantier} />
                <label className="block text-sm">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Ville</span>
                  <div className="mt-1">
                    <VilleCombobox
                      value={villeChantier}
                      onChange={setVilleChantier}
                      onSelect={v => { setVilleChantier(v.nom); setCpChantier(v.cp) }}
                    />
                  </div>
                </label>
                <Field label="Code postal" value={cpChantier} onChange={setCpChantier} />
              </div>
            )}
          </section>

          {/* Intervention */}
          <section className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Intervention</h3>

            <div>
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Type</span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeIntervention(t)}
                    className={`p-2.5 rounded-xl border-2 text-left text-sm font-semibold transition-all ${
                      typeIntervention === t
                        ? 'border-blue-500 bg-blue-50 text-[#0e2a52]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Date prévue</span>
                <input type="date" value={datePrevue} onChange={e => setDatePrevue(e.target.value)} className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1" />
              </label>
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Heure</span>
                <input type="time" value={heurePrevue} onChange={e => setHeurePrevue(e.target.value)} className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1" />
              </label>
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Durée (min)</span>
                <input type="number" min="0" step="5" value={dureeMin} onChange={e => setDureeMin(e.target.value)} className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Prix prévu (€)</span>
                <input type="number" min="0" step="0.01" value={prixPrevu} onChange={e => setPrixPrevu(e.target.value)} placeholder="ex: 250" className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1" />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mt-6">
                <input type="checkbox" checked={urgence} onChange={e => setUrgence(e.target.checked)} className="w-5 h-5" />
                🚨 Intervention urgente
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Agence</span>
                <select value={agence} onChange={e => setAgence(e.target.value)} className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 bg-white">
                  {AGENCES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Technicien</span>
                <select value={technicienId} onChange={e => setTechnicienId(e.target.value)} className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 bg-white">
                  <option value="">— non assignée —</option>
                  {techniciens.map(t => (
                    <option key={t.id} value={t.id}>{t.nom}{t.agence ? ` (${t.agence})` : ''}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Canal d&apos;acquisition</span>
              <select
                value={canalAcquisition}
                onChange={e => setCanalAcquisition(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 bg-white"
              >
                <option value="">— non précisé —</option>
                {CANAUX_ACQUISITION.map(c => (
                  <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">D&apos;où vient le client ? Sert à mesurer l&apos;efficacité des canaux de communication.</span>
            </label>

            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Notes internes</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Code d'accès, étage, instructions particulières…" className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 text-sm" />
            </label>
          </section>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#0e2a52] text-white px-4 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-[#0a2047] transition"
          >
            {submitting ? 'Création…' : 'Créer & notifier le tech'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ====================================================================
// Recherche SIRET (entreprise) — appelle /api/siret/[siret] qui proxy
// l'API publique recherche-entreprises.api.gouv.fr.
// ====================================================================
function SiretLookup({ onFound }: {
  onFound: (c: { nom: string; adresse: string; code_postal: string; ville: string }) => void
}) {
  const [siret, setSiret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<{ nom: string; activite: string | null } | null>(null)

  async function lookup(value: string) {
    const cleaned = value.replace(/[\s.-]/g, '')
    if (!/^\d{14}$/.test(cleaned)) return
    setLoading(true); setError(''); setInfo(null)
    try {
      const res = await fetch(`/api/siret/${cleaned}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setInfo({ nom: data.nom, activite: data.activite })
      onFound({
        nom: data.nom,
        adresse: data.adresse,
        code_postal: data.code_postal,
        ville: data.ville,
      })
    } catch (e: any) {
      setError(e?.message || 'Erreur lookup SIRET')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
      <label className="block text-sm">
        <span className="text-xs uppercase tracking-wide text-blue-900 font-bold">🔎 Recherche par SIRET (entreprise)</span>
        <div className="flex gap-2 mt-1.5">
          <input
            inputMode="numeric"
            value={siret}
            onChange={e => {
              const v = e.target.value
              setSiret(v)
              setError('')
              const cleaned = v.replace(/[\s.-]/g, '')
              // Auto-lookup quand on a 14 chiffres
              if (/^\d{14}$/.test(cleaned)) lookup(cleaned)
            }}
            onPaste={e => {
              const pasted = e.clipboardData.getData('text').replace(/[\s.-]/g, '')
              if (/^\d{14}$/.test(pasted)) {
                e.preventDefault()
                setSiret(pasted)
                lookup(pasted)
              }
            }}
            placeholder="14 chiffres — ex: 12345678900012"
            maxLength={20}
            className="flex-1 border-2 border-blue-300 focus:border-blue-600 outline-none rounded-lg px-3 py-2 text-sm font-mono bg-white"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => lookup(siret)}
            disabled={loading || !/^\d{14}$/.test(siret.replace(/[\s.-]/g, ''))}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {loading ? '…' : 'Trouver'}
          </button>
        </div>
      </label>
      {info && (
        <div className="mt-2 p-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs">
          <div className="font-bold text-emerald-900">✓ {info.nom}</div>
          {info.activite && <div className="text-emerald-700 mt-0.5">{info.activite}</div>}
          <div className="text-emerald-700 mt-0.5 italic">Coordonnées remplies automatiquement ci-dessous.</div>
        </div>
      )}
      {error && (
        <div className="mt-2 text-xs text-red-700 font-semibold">⚠ {error}</div>
      )}
      <div className="text-[10px] text-blue-800/70 mt-1.5">
        Source : recherche-entreprises.api.gouv.fr (gratuit, données publiques INSEE).
      </div>
    </div>
  )
}

// ====================================================================
// Autocomplete client (recherche dans clients existants)
// ====================================================================
function ClientAutocomplete({
  value, onTextChange, onSelect,
}: {
  value: string
  onTextChange: (v: string) => void
  onSelect: (c: ClientRow) => void
}) {
  const [results, setResults] = useState<ClientRow[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value.trim() || value.trim().length < 2) { setResults([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?q=${encodeURIComponent(value)}&limit=8`, { signal: ctrl.signal, cache: 'no-store' })
        const data = await res.json()
        if (res.ok) setResults(data.clients || [])
      } catch {
        /* abort */
      }
    }, 250)
    return () => { ctrl.abort(); clearTimeout(t) }
  }, [value])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={wrapRef} className="relative">
      <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Nom du client *</span>
      <input
        value={value}
        onChange={e => { onTextChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="M. Dupont, Mme Jules…"
        className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1"
      />
      {open && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {results.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onSelect(c); setOpen(false) }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0"
            >
              <div className="font-semibold text-sm text-[#0e2a52]">{c.nom}</div>
              <div className="text-xs text-slate-500">
                {[c.email, c.telephone, c.ville].filter(Boolean).join(' · ')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PhoneMatchHint({
  searching, matches, hasClientId, onPick,
}: {
  searching: boolean
  matches: ClientRow[]
  hasClientId: boolean
  onPick: (c: ClientRow) => void
}) {
  if (hasClientId) return null
  if (matches.length === 0) {
    if (!searching) return null
    return (
      <div className="mt-1.5 text-[11px] text-slate-400">Recherche…</div>
    )
  }
  if (matches.length === 1) {
    const c = matches[0]
    const detail = [c.ville, c.email].filter(Boolean).join(' · ')
    return (
      <button
        type="button"
        onClick={() => onPick(c)}
        className="mt-1.5 w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 text-left transition active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>✓ Client existant</span>
              <span className="font-normal opacity-70">— {c.nom}</span>
            </div>
            {detail && <div className="text-[11px] opacity-70 truncate mt-0.5">{detail}</div>}
          </div>
          <span className="text-[10px] font-bold bg-emerald-700 text-white px-2 py-1 rounded-md uppercase tracking-wider whitespace-nowrap">
            Utiliser
          </span>
        </div>
      </button>
    )
  }
  return (
    <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-1.5">
      <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider px-1">
        {matches.length} clients existants — choisis le bon
      </div>
      <ul className="space-y-1">
        {matches.map(c => {
          const detail = [c.ville, c.email].filter(Boolean).join(' · ')
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="w-full bg-white hover:bg-amber-100 border border-amber-200 rounded-md px-2.5 py-1.5 text-left text-xs transition flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{c.nom}</div>
                  {detail && <div className="text-[11px] text-slate-500 truncate">{detail}</div>}
                </div>
                <span className="text-[10px] font-bold text-amber-700 whitespace-nowrap">→</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</span>
      <input
        type={type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1"
      />
    </label>
  )
}

// ====================================================================
// Drawer techniciens
// ====================================================================
function TechniciensDrawer({
  onClose, onChanged,
}: {
  onClose: () => void
  onChanged: () => void
}) {
  const [list, setList] = useState<Technicien[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [agence, setAgence] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/techniciens?all=1', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setList(data.techniciens || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!nom.trim()) { setError('Nom requis'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/techniciens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, email, telephone: tel, agence }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setNom(''); setEmail(''); setTel(''); setAgence('')
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActif(t: Technicien) {
    try {
      const res = await fetch('/api/techniciens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, actif: !t.actif }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch justify-end">
      <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex justify-between items-center">
          <h2 className="text-lg font-black text-[#0e2a52]">👥 Techniciens</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Add form */}
          <section className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
            <h3 className="font-bold text-[#0e2a52] text-sm">Ajouter un technicien</h3>
            <div className="grid grid-cols-1 gap-2">
              <Field label="Nom *" value={nom} onChange={setNom} placeholder="Jean Dupont" />
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="jean@ltdb.fr" />
              <Field label="Téléphone" value={tel} onChange={setTel} placeholder="06 12 34 56 78" />
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Agence</span>
                <select value={agence} onChange={e => setAgence(e.target.value)} className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 bg-white">
                  <option value="">—</option>
                  {AGENCES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            </div>
            <button
              onClick={handleAdd}
              disabled={submitting}
              className="w-full bg-[#0e2a52] text-white px-4 py-2.5 rounded-xl font-bold disabled:opacity-50"
            >
              {submitting ? 'Ajout…' : '+ Ajouter'}
            </button>
          </section>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

          {/* List */}
          <section className="space-y-2">
            <h3 className="font-bold text-[#0e2a52] text-sm">Liste ({list.length})</h3>
            {loading && <div className="text-slate-500 text-sm">Chargement…</div>}
            {!loading && list.length === 0 && <div className="text-slate-500 text-sm">Aucun technicien.</div>}
            {list.map(t => (
              <div key={t.id} className={`border-2 rounded-xl p-3 ${t.actif ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[#0e2a52] truncate">{t.nom}</div>
                    <div className="text-xs text-slate-500 truncate">{t.email || '—'}</div>
                    <div className="text-xs text-slate-500 truncate">{t.telephone || '—'}</div>
                    {t.agence && <div className="text-[10px] text-slate-500 mt-1">{t.agence}</div>}
                  </div>
                  <button
                    onClick={() => toggleActif(t)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full ${t.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {t.actif ? 'Actif' : 'Inactif'}
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
