'use client'
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

type Client = {
  id: string | null
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

type Intervention = {
  id: string
  reference: string | null
  type_intervention: string | null
  adresse_chantier: string | null
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

type DocRow = {
  id: string
  type: string
  numero: string | null
  agence: string | null
  date_emission: string | null
  echeance: string | null
  statut: string | null
  montant_ht: number | null
  montant_ttc: number | null
  pdf_url: string | null
  envoye_email: string | null
  envoye_at: string | null
  intervention_id: string | null
  client_id: string | null
  created_at: string
  client_nom: string | null
  client_email: string | null
  client_ville: string | null
}

type ClientDossier = {
  key: string
  client: Client
  interventions: Intervention[]
  documents: DocRow[]
  caTotal: number
  caPaye: number
  lastDate: string | null
}

const TYPE_LABEL: Record<string, string> = {
  facture: 'Facture',
  devis: 'Devis',
  attestation: 'Attestation',
  rapport: 'Rapport',
}

function fmtMontant(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v).replace(/\r?\n/g, ' ')
  if (s.includes(';') || s.includes('"') || s.includes(',')) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const BOM = '﻿'
  const csv = BOM + rows.map(r => r.map(csvCell).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function clientKey(c: { id: string | null; nom: string; email: string | null }): string {
  if (c.id) return `id:${c.id}`
  return `noid:${(c.nom || '').toLowerCase().trim()}|${(c.email || '').toLowerCase().trim()}`
}

export default function ClientsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allClients, setAllClients] = useState<Client[]>([])
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [documents, setDocuments] = useState<DocRow[]>([])

  const [search, setSearch] = useState('')
  const [filterVille, setFilterVille] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [sendModal, setSendModal] = useState<{ open: boolean; dossier: ClientDossier | null; email: string; sending: boolean; status: string | null }>({
    open: false, dossier: null, email: '', sending: false, status: null,
  })

  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [editModal, setEditModal] = useState<{
    open: boolean
    id: string | null
    form: { nom: string; email: string; telephone: string; adresse: string; code_postal: string; ville: string }
    saving: boolean
    error: string | null
  }>({
    open: false, id: null,
    form: { nom: '', email: '', telephone: '', adresse: '', code_postal: '', ville: '' },
    saving: false, error: null,
  })

  function openEditModal(d: ClientDossier) {
    if (!d.client.id) {
      setDeleteError(`"${d.client.nom}" n'est pas une fiche client enregistrée — rien à modifier. Crée d'abord une intervention liée pour qu'une fiche existe.`)
      return
    }
    setEditModal({
      open: true,
      id: d.client.id,
      form: {
        nom: d.client.nom || '',
        email: d.client.email || '',
        telephone: d.client.telephone || '',
        adresse: d.client.adresse || '',
        code_postal: d.client.code_postal || '',
        ville: d.client.ville || '',
      },
      saving: false, error: null,
    })
  }

  async function saveEditClient() {
    if (!editModal.id) return
    const nom = editModal.form.nom.trim()
    if (!nom) {
      setEditModal(s => ({ ...s, error: 'Le nom est obligatoire.' }))
      return
    }
    setEditModal(s => ({ ...s, saving: true, error: null }))
    try {
      const res = await fetch(`/api/clients/${editModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom,
          email: editModal.form.email,
          telephone: editModal.form.telephone,
          adresse: editModal.form.adresse,
          code_postal: editModal.form.code_postal,
          ville: editModal.form.ville,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      const updated = body?.client as Client | undefined
      if (updated) {
        setAllClients(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
      }
      setEditModal(s => ({ ...s, open: false, saving: false }))
    } catch (e) {
      setEditModal(s => ({ ...s, saving: false, error: e instanceof Error ? e.message : 'Échec' }))
    }
  }

  async function handleDeleteClient(d: ClientDossier) {
    setDeleteError(null)
    const id = d.client.id
    if (!id) {
      setDeleteError(`"${d.client.nom}" n'est pas un client enregistré en base (agrégé depuis des interventions sans fiche client) — rien à supprimer.`)
      return
    }
    if (d.interventions.length > 0 || d.documents.length > 0) {
      const parts: string[] = []
      if (d.interventions.length > 0) parts.push(`${d.interventions.length} intervention(s)`)
      if (d.documents.length > 0) parts.push(`${d.documents.length} document(s)`)
      setDeleteError(`Impossible de supprimer "${d.client.nom}" : ${parts.join(' et ')} y ${d.interventions.length + d.documents.length > 1 ? 'sont' : 'est'} rattaché(s). Supprime-les d'abord depuis l'historique.`)
      return
    }
    if (!confirm(`Supprimer définitivement le client "${d.client.nom}" ? Cette action est irréversible.`)) return
    setDeletingKey(d.key)
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      setAllClients(prev => prev.filter(c => c.id !== id))
      setExpanded(s => { const next = { ...s }; delete next[d.key]; return next })
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Suppression échouée')
    } finally {
      setDeletingKey(null)
    }
  }

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true); setError(null)
      try {
        const [hRes, cRes] = await Promise.all([
          fetch('/api/historique?limit=500', { cache: 'no-store' }),
          fetch('/api/clients?limit=1000', { cache: 'no-store' }),
        ])
        const hJson = await hRes.json()
        const cJson = await cRes.json()
        if (!alive) return
        if (hJson.error) throw new Error(hJson.error)
        if (cJson.error) throw new Error(cJson.error)
        setInterventions(hJson.interventions || [])
        setDocuments(hJson.documents || [])
        setAllClients(cJson.clients || [])
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

  const dossiers = useMemo<ClientDossier[]>(() => {
    const map = new Map<string, ClientDossier>()

    const ensure = (c: Client): ClientDossier => {
      const k = clientKey(c)
      const existing = map.get(k)
      if (existing) {
        if (!existing.client.email && c.email) existing.client.email = c.email
        if (!existing.client.telephone && c.telephone) existing.client.telephone = c.telephone
        if (!existing.client.adresse && c.adresse) existing.client.adresse = c.adresse
        if (!existing.client.code_postal && c.code_postal) existing.client.code_postal = c.code_postal
        if (!existing.client.ville && c.ville) existing.client.ville = c.ville
        return existing
      }
      const fresh: ClientDossier = {
        key: k,
        client: { ...c },
        interventions: [],
        documents: [],
        caTotal: 0,
        caPaye: 0,
        lastDate: null,
      }
      map.set(k, fresh)
      return fresh
    }

    for (const c of allClients) ensure(c)

    for (const i of interventions) {
      const c: Client = {
        id: i.client_id,
        nom: i.client_nom || 'Client sans nom',
        email: i.client_email,
        telephone: null,
        adresse: null,
        code_postal: null,
        ville: i.client_ville || i.ville,
      }
      const d = ensure(c)
      d.interventions.push(i)
      const dt = i.date_realisee || i.date_prevue || i.created_at
      if (dt && (!d.lastDate || dt > d.lastDate)) d.lastDate = dt
    }

    for (const doc of documents) {
      const c: Client = {
        id: doc.client_id,
        nom: doc.client_nom || 'Client sans nom',
        email: doc.client_email,
        telephone: null,
        adresse: null,
        code_postal: null,
        ville: doc.client_ville,
      }
      const d = ensure(c)
      d.documents.push(doc)
      if (doc.type === 'facture' && typeof doc.montant_ttc === 'number') {
        d.caTotal += doc.montant_ttc
        if (doc.statut === 'paye') d.caPaye += doc.montant_ttc
      }
      const dt = doc.date_emission || doc.created_at
      if (dt && (!d.lastDate || dt > d.lastDate)) d.lastDate = dt
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate)
      if (a.lastDate) return -1
      if (b.lastDate) return 1
      return a.client.nom.localeCompare(b.client.nom, 'fr')
    })
  }, [allClients, interventions, documents])

  const villes = useMemo(() => {
    const set = new Set<string>()
    for (const d of dossiers) {
      if (d.client.ville) set.add(d.client.ville)
      for (const i of d.interventions) if (i.ville) set.add(i.ville)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [dossiers])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return dossiers.filter(d => {
      if (s) {
        const blob = [
          d.client.nom, d.client.email, d.client.ville, d.client.telephone,
          ...d.interventions.map(i => `${i.reference || ''} ${i.ville || ''} ${i.type_intervention || ''}`),
          ...d.documents.map(doc => `${doc.numero || ''} ${doc.type || ''}`),
        ].join(' ').toLowerCase()
        if (!blob.includes(s)) return false
      }
      if (filterVille) {
        const villesD = new Set<string>([
          ...(d.client.ville ? [d.client.ville] : []),
          ...d.interventions.map(i => i.ville || '').filter(Boolean),
        ])
        if (!villesD.has(filterVille)) return false
      }
      if (filterType) {
        const hasType = d.documents.some(doc => doc.type === filterType)
        if (!hasType) return false
      }
      if (from || to) {
        const inRange = (iso: string | null | undefined) => {
          if (!iso) return false
          const ymd = iso.slice(0, 10)
          if (from && ymd < from) return false
          if (to && ymd > to) return false
          return true
        }
        const anyMatch = d.interventions.some(i => inRange(i.date_realisee || i.date_prevue || i.created_at))
          || d.documents.some(doc => inRange(doc.date_emission || doc.created_at))
        if (!anyMatch) return false
      }
      return true
    })
  }, [dossiers, search, filterVille, filterType, from, to])

  const totalCa = filtered.reduce((s, d) => s + d.caTotal, 0)
  const totalInterv = filtered.reduce((s, d) => s + d.interventions.length, 0)
  const totalDocs = filtered.reduce((s, d) => s + d.documents.length, 0)

  function exportClientCsv(d: ClientDossier) {
    const safeName = (d.client.nom || 'client').replace(/[^\w\-]+/g, '_').toLowerCase()
    const rows: (string | number | null | undefined)[][] = []
    rows.push(['Type', 'Date', 'Référence/N°', 'Objet', 'Ville', 'Statut', 'Montant TTC', 'Lien PDF'])
    for (const i of d.interventions) {
      rows.push([
        'Intervention',
        fmtDate(i.date_realisee || i.date_prevue || i.created_at),
        i.reference || '',
        i.type_intervention || '',
        i.ville || '',
        i.statut || '',
        '',
        i.pdf_rapport_url || '',
      ])
    }
    for (const doc of d.documents) {
      rows.push([
        TYPE_LABEL[doc.type] || doc.type,
        fmtDate(doc.date_emission || doc.created_at),
        doc.numero || '',
        '',
        '',
        doc.statut || '',
        doc.montant_ttc !== null && doc.montant_ttc !== undefined
          ? doc.montant_ttc.toFixed(2).replace('.', ',') : '',
        doc.pdf_url || '',
      ])
    }
    downloadCsv(`ltdb-client-${safeName}.csv`, rows)
  }

  function exportAllCsv() {
    const rows: (string | number | null | undefined)[][] = []
    rows.push(['Client', 'Email', 'Téléphone', 'Ville', 'Nb interventions', 'Nb documents', 'CA total TTC', 'CA payé TTC', 'Dernière activité'])
    for (const d of filtered) {
      rows.push([
        d.client.nom,
        d.client.email || '',
        d.client.telephone || '',
        d.client.ville || '',
        d.interventions.length,
        d.documents.length,
        d.caTotal.toFixed(2).replace('.', ','),
        d.caPaye.toFixed(2).replace('.', ','),
        fmtDate(d.lastDate),
      ])
    }
    downloadCsv('ltdb-clients.csv', rows)
  }

  function openSendModal(d: ClientDossier) {
    setSendModal({ open: true, dossier: d, email: d.client.email || '', sending: false, status: null })
  }

  async function submitSend() {
    if (!sendModal.dossier) return
    if (!sendModal.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(sendModal.email)) {
      setSendModal(s => ({ ...s, status: 'Email invalide' }))
      return
    }
    setSendModal(s => ({ ...s, sending: true, status: null }))
    try {
      const d = sendModal.dossier
      const res = await fetch('/api/clients/send-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sendModal.email,
          clientNom: d.client.nom,
          ville: d.client.ville || '',
          interventions: d.interventions.map(i => ({
            reference: i.reference,
            date: i.date_realisee || i.date_prevue,
            type: i.type_intervention,
            ville: i.ville,
            statut: i.statut,
          })),
          documents: d.documents.map(doc => ({
            type: doc.type,
            numero: doc.numero,
            date: doc.date_emission,
            montant_ttc: doc.montant_ttc,
            statut: doc.statut,
            pdf_url: doc.pdf_url,
          })),
          caTotal: d.caTotal,
          caPaye: d.caPaye,
        }),
      })
      const j = await res.json()
      if (!res.ok || j.error) {
        setSendModal(s => ({ ...s, sending: false, status: j.error || 'Erreur envoi' }))
        return
      }
      setSendModal(s => ({ ...s, sending: false, status: 'Envoyé ✓' }))
      setTimeout(() => setSendModal({ open: false, dossier: null, email: '', sending: false, status: null }), 1500)
    } catch (e) {
      setSendModal(s => ({ ...s, sending: false, status: e instanceof Error ? e.message : 'Erreur' }))
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="text-xl font-black tracking-tight hover:opacity-80">Aprime fluides</Link>
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-semibold">Clients</span>
          </div>
          <Link href="/" className="text-xs text-white/70 hover:text-white">← Accueil</Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Stats résumé */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Clients" value={String(filtered.length)} />
          <Stat label="Interventions" value={String(totalInterv)} />
          <Stat label="Documents" value={String(totalDocs)} />
          <Stat label="CA total" value={fmtMontant(totalCa)} />
        </div>

        {/* Filtres */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Rechercher (nom, email, ville, n°…)"
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
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            >
              <option value="">Tout type doc</option>
              <option value="facture">Facture</option>
              <option value="devis">Devis</option>
              <option value="attestation">Attestation</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs" />
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs" />
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-slate-500">{filtered.length} client{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}</div>
            <div className="flex gap-2">
              {(search || filterVille || filterType || from || to) && (
                <button
                  onClick={() => { setSearch(''); setFilterVille(''); setFilterType(''); setFrom(''); setTo('') }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50"
                >Réinitialiser</button>
              )}
              <button
                onClick={exportAllCsv}
                disabled={filtered.length === 0}
                className="px-3 py-1.5 text-xs rounded-lg bg-[#0e2a52] text-white hover:bg-[#0a1f3d] disabled:opacity-40"
              >📥 Exporter CSV</button>
            </div>
          </div>
        </div>

        {/* Liste */}
        {loading && <div className="text-center py-12 text-slate-500 text-sm">Chargement…</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>}
        {deleteError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex items-start justify-between gap-3 mb-3">
            <span>⚠ {deleteError}</span>
            <button onClick={() => setDeleteError(null)} className="text-amber-600 hover:text-amber-900 font-bold shrink-0">✕</button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">Aucun client ne correspond aux filtres.</div>
        )}

        <div className="space-y-3">
          {filtered.map(d => {
            const isOpen = !!expanded[d.key]
            return (
              <div key={d.key} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-stretch">
                  <button
                    onClick={() => setExpanded(s => ({ ...s, [d.key]: !s[d.key] }))}
                    className="flex-1 min-w-0 px-4 sm:px-5 py-4 flex items-center gap-4 hover:bg-slate-50 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {(d.client.nom || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm sm:text-base truncate">{d.client.nom}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {[d.client.email, d.client.telephone, d.client.ville].filter(Boolean).join(' · ') || 'Aucun contact'}
                      </div>
                    </div>
                    <div className="hidden sm:flex gap-3 text-xs text-slate-600">
                      <Pill>{d.interventions.length} interv.</Pill>
                      <Pill>{d.documents.length} doc.</Pill>
                      {d.caTotal > 0 && <Pill className="bg-emerald-50 text-emerald-700 border-emerald-100">{fmtMontant(d.caTotal)}</Pill>}
                    </div>
                    <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  <button
                    onClick={() => handleDeleteClient(d)}
                    disabled={deletingKey === d.key}
                    title={d.interventions.length > 0 || d.documents.length > 0
                      ? 'Ce client a des interventions/documents — supprime-les d\'abord'
                      : 'Supprimer ce client'}
                    className="px-3 sm:px-4 flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50 border-l border-slate-100 transition-colors disabled:opacity-40"
                  >
                    {deletingKey === d.key ? '⏳' : '🗑'}
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openEditModal(d)}
                        disabled={!d.client.id}
                        title={d.client.id ? 'Modifier les coordonnées' : 'Pas de fiche enregistrée'}
                        className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                      >✏️ Modifier</button>
                      <button
                        onClick={() => exportClientCsv(d)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 hover:bg-slate-100"
                      >📥 Exporter ce client (CSV)</button>
                      <button
                        onClick={() => openSendModal(d)}
                        disabled={!d.client.email && !d.documents.length && !d.interventions.length}
                        className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                      >✉ Envoyer le récap</button>
                      <button
                        onClick={() => handleDeleteClient(d)}
                        disabled={deletingKey === d.key}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >{deletingKey === d.key ? '⏳ Suppression…' : '🗑 Supprimer ce client'}</button>
                    </div>
                    {(d.interventions.length > 0 || d.documents.length > 0) && (
                      <p className="text-[11px] text-slate-500">
                        ⚠ Ce client a {d.interventions.length} intervention(s) et {d.documents.length} document(s) liés.
                        Sa suppression est bloquée tant qu'ils existent.
                      </p>
                    )}

                    {(() => {
                      const rapports = d.interventions.filter(i => i.has_rapport)
                      const interventionsSansRapport = d.interventions.filter(i => !i.has_rapport)
                      const factures = d.documents.filter(doc => doc.type === 'facture')
                      const devis = d.documents.filter(doc => doc.type === 'devis')
                      const attestations = d.documents.filter(doc => doc.type === 'attestation')
                      return (
                        <>
                          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                            <Pill className="bg-indigo-50 text-indigo-700 border-indigo-100">📝 {rapports.length} rapport{rapports.length > 1 ? 's' : ''}</Pill>
                            <Pill className="bg-emerald-50 text-emerald-700 border-emerald-100">🧾 {factures.length} facture{factures.length > 1 ? 's' : ''}</Pill>
                            <Pill className="bg-amber-50 text-amber-700 border-amber-100">📋 {devis.length} devis</Pill>
                            <Pill className="bg-stone-50 text-stone-700 border-stone-100">✅ {attestations.length} attestation{attestations.length > 1 ? 's' : ''}</Pill>
                          </div>

                          <DocSection title="📝 Rapports d'intervention" count={rapports.length} accent="indigo">
                            {rapports.map(i => (
                              <div
                                key={i.id}
                                className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">{i.reference || i.id.slice(0, 8)}</span>
                                  {i.type_intervention && <span className="text-slate-500"> · {i.type_intervention}</span>}
                                  {i.ville && <span className="text-slate-500"> · {i.ville}</span>}
                                </div>
                                <div className="text-xs text-slate-600 shrink-0 flex items-center gap-3">
                                  <span className="text-slate-500">{fmtDate(i.date_realisee || i.date_prevue || i.created_at)}</span>
                                  {i.pdf_rapport_url && (
                                    <a href={i.pdf_rapport_url} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-[11px]">📄 PDF</a>
                                  )}
                                  <Link href={`/intervention/${i.id}`} className="text-[#0e2a52] hover:underline">Voir →</Link>
                                </div>
                              </div>
                            ))}
                          </DocSection>

                          <DocSection title="🧾 Factures" count={factures.length} accent="emerald">
                            {factures.map(doc => (
                              <DocRowView key={doc.id} doc={doc} />
                            ))}
                          </DocSection>

                          <DocSection title="📋 Devis" count={devis.length} accent="amber">
                            {devis.map(doc => (
                              <DocRowView key={doc.id} doc={doc} />
                            ))}
                          </DocSection>

                          <DocSection title="✅ Attestations" count={attestations.length} accent="stone">
                            {attestations.map(doc => (
                              <DocRowView key={doc.id} doc={doc} />
                            ))}
                          </DocSection>

                          {interventionsSansRapport.length > 0 && (
                            <DocSection title="📅 Interventions sans rapport" count={interventionsSansRapport.length} accent="slate">
                              {interventionsSansRapport.map(i => (
                                <Link
                                  key={i.id}
                                  href={`/intervention/${i.id}`}
                                  className="block bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-[#0e2a52] hover:bg-slate-50"
                                >
                                  <div className="flex items-center justify-between gap-3 text-sm">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium">{i.reference || i.id.slice(0, 8)}</span>
                                      {i.type_intervention && <span className="text-slate-500"> · {i.type_intervention}</span>}
                                      {i.ville && <span className="text-slate-500"> · {i.ville}</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 shrink-0">
                                      {fmtDate(i.date_realisee || i.date_prevue || i.created_at)}
                                      {i.statut && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase ${statutClass(i.statut)}`}>{i.statut}</span>}
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </DocSection>
                          )}

                          {d.interventions.length === 0 && d.documents.length === 0 && (
                            <div className="text-xs text-slate-500 italic">Aucune intervention ni document pour ce client.</div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modale envoi récap */}
      {sendModal.open && sendModal.dossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Envoyer le récap au client</h3>
              <button onClick={() => setSendModal({ open: false, dossier: null, email: '', sending: false, status: null })} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Récap pour <strong>{sendModal.dossier.client.nom}</strong> : {sendModal.dossier.interventions.length} intervention(s) et {sendModal.dossier.documents.length} document(s).
            </p>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email destinataire</label>
            <input
              type="email"
              value={sendModal.email}
              onChange={e => setSendModal(s => ({ ...s, email: e.target.value, status: null }))}
              placeholder="client@exemple.fr"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            />
            {sendModal.status && (
              <div className={`mt-3 text-sm ${sendModal.status === 'Envoyé ✓' ? 'text-emerald-600' : 'text-red-600'}`}>{sendModal.status}</div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setSendModal({ open: false, dossier: null, email: '', sending: false, status: null })} className="px-3 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50">Annuler</button>
              <button onClick={submitSend} disabled={sendModal.sending} className="px-3 py-2 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {sendModal.sending ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale édition fiche client */}
      {editModal.open && editModal.id && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => !editModal.saving && setEditModal(s => ({ ...s, open: false }))}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#0e2a52]">Modifier la fiche client</h3>
              <button
                onClick={() => setEditModal(s => ({ ...s, open: false }))}
                disabled={editModal.saving}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >×</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className="block text-xs font-medium text-slate-600 mb-1">Nom *</span>
                <input
                  type="text"
                  value={editModal.form.nom}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, nom: e.target.value }, error: null }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
                <input
                  type="email"
                  value={editModal.form.email}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, email: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Téléphone</span>
                <input
                  type="tel"
                  value={editModal.form.telephone}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, telephone: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="block text-xs font-medium text-slate-600 mb-1">Adresse</span>
                <input
                  type="text"
                  value={editModal.form.adresse}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, adresse: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Code postal</span>
                <input
                  type="text"
                  value={editModal.form.code_postal}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, code_postal: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Ville</span>
                <input
                  type="text"
                  value={editModal.form.ville}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, ville: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
            </div>

            {editModal.error && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                ⚠ {editModal.error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setEditModal(s => ({ ...s, open: false }))}
                disabled={editModal.saving}
                className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >Annuler</button>
              <button
                onClick={saveEditClient}
                disabled={editModal.saving || !editModal.form.nom.trim()}
                className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >{editModal.saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-xl sm:text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-100 ${className}`}>{children}</span>
  )
}

function statutClass(s: string): string {
  switch (s) {
    case 'planifiee': return 'bg-blue-100 text-blue-700'
    case 'en_cours': return 'bg-amber-100 text-amber-700'
    case 'terminee': return 'bg-emerald-100 text-emerald-700'
    case 'annulee': return 'bg-slate-200 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}

type Accent = 'indigo' | 'emerald' | 'amber' | 'stone' | 'slate'

const ACCENT_CLASSES: Record<Accent, string> = {
  indigo: 'text-indigo-700 border-indigo-100 bg-indigo-50/50',
  emerald: 'text-emerald-700 border-emerald-100 bg-emerald-50/50',
  amber: 'text-amber-700 border-amber-100 bg-amber-50/50',
  stone: 'text-stone-700 border-stone-100 bg-stone-50/50',
  slate: 'text-slate-700 border-slate-100 bg-slate-50/50',
}

function DocSection({ title, count, accent, children }: { title: string; count: number; accent: Accent; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <div>
      <div className={`text-[11px] uppercase tracking-wider font-semibold mb-2 px-2 py-1 inline-block rounded border ${ACCENT_CLASSES[accent]}`}>
        {title} ({count})
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function DocRowView({ doc }: { doc: DocRow }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
      <div className="flex-1 min-w-0">
        <span className="font-medium">{doc.numero || (TYPE_LABEL[doc.type] || doc.type)}</span>
        {doc.statut && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase ${docStatutClass(doc.statut)}`}>{doc.statut}</span>}
      </div>
      <div className="text-xs text-slate-600 shrink-0 flex items-center gap-3">
        {typeof doc.montant_ttc === 'number' && <span className="font-medium">{fmtMontant(doc.montant_ttc)}</span>}
        <span className="text-slate-500">{fmtDate(doc.date_emission || doc.created_at)}</span>
        {doc.pdf_url && (
          <a href={doc.pdf_url} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-[#0e2a52] text-white hover:bg-[#0a1f3d] text-[11px]">📄 PDF</a>
        )}
      </div>
    </div>
  )
}

function docStatutClass(s: string): string {
  switch (s) {
    case 'paye': return 'bg-emerald-100 text-emerald-700'
    case 'envoye': return 'bg-blue-100 text-blue-700'
    case 'brouillon': return 'bg-slate-100 text-slate-600'
    case 'relance': return 'bg-amber-100 text-amber-700'
    case 'impaye': return 'bg-red-100 text-red-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}
