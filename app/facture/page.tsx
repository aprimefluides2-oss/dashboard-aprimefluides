'use client'
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import AppTabs from "@/components/AppTabs"
import { fmtDateFR, fmtEUR, fmtDateISOtoFR } from "@/lib/format"
import { parseEcheance } from "@/lib/echeance"
import { AGENCES } from "@/lib/agences"
import { aprimeFactureEmetteur } from "@/lib/emetteur"
import type { FactureData } from "@/components/FacturePDF"
import {
  PlusIcon, CheckIcon, EnvelopeIcon, ArrowDownTrayIcon, NoSymbolIcon,
  TrashIcon, ArrowRefreshIcon, CalendarIcon, ReceiptIcon, ClockIcon,
  ExclamationIcon,
} from "@/components/Icons"

const DocumentDownloadButton = dynamic(() => import("@/components/DocumentDownloadButton"), { ssr: false })
const ResendEmailButton = dynamic(() => import("@/components/ResendEmailButton"), { ssr: false })
const RequestReviewButton = dynamic(() => import("@/components/RequestReviewButton"), { ssr: false })

type FactureRow = {
  id: string
  type: 'facture'
  numero: string | null
  agence: string | null
  date_emission: string
  echeance: string | null
  statut: string
  montant_ht: number | null
  montant_ttc: number | null
  tva_taux: number | null
  envoye_email: string | null
  envoye_at: string | null
  pdf_url: string | null
  payload?: any
  intervention_id: string | null
  client_id: string | null
  client_nom: string | null
  client_email: string | null
  client_adresse: string | null
  client_code_postal: string | null
  client_ville: string | null
  created_at: string
}

type StatutFiltre = 'all' | 'brouillon' | 'envoye' | 'paye' | 'retard' | 'annule'

const STATUT_FILTRES: { key: StatutFiltre; label: string }[] = [
  { key: 'all',       label: 'Toutes' },
  { key: 'retard',    label: 'En retard' },
  { key: 'envoye',    label: 'En attente' },
  { key: 'brouillon', label: 'Brouillons' },
  { key: 'paye',      label: 'Payées' },
  { key: 'annule',    label: 'Annulées' },
]

const STATUT_LABEL: Record<string, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyée',
  paye: 'Payée',
  annule: 'Annulée',
}

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

export default function FactureConsolePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [factures, setFactures] = useState<FactureRow[]>([])
  const [statutFiltre, setStatutFiltre] = useState<StatutFiltre>('all')
  const [agence, setAgence] = useState<string>('')
  const [search, setSearch] = useState('')
  const initial = presetThisMonth()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [periodeOuverte, setPeriodeOuverte] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(''); setInfo('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      params.set('limit', '500')
      const res = await fetch(`/api/historique?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const onlyFactures: FactureRow[] = (data.documents || [])
        .filter((d: any) => d.type === 'facture')
      setFactures(onlyFactures)
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const t = setTimeout(() => { load() }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Décoration : calcule échéance + retard pour chaque facture
  const decorated = useMemo(() => {
    return factures.map(f => {
      const eche = parseEcheance(f.echeance, f.date_emission)
      const inPeriod = (!from || f.date_emission >= from) && (!to || f.date_emission <= to)
      const matchAgence = !agence || f.agence === agence
      const isOverdue = f.statut === 'envoye' && (eche.daysOverdue ?? 0) > 0
      return { ...f, _eche: eche, _inPeriod: inPeriod, _matchAgence: matchAgence, _isOverdue: isOverdue }
    })
  }, [factures, from, to, agence])

  // Filtrage final
  const filtered = useMemo(() => {
    return decorated.filter(f => {
      if (!f._inPeriod || !f._matchAgence) return false
      if (statutFiltre === 'all') return true
      if (statutFiltre === 'retard') return f._isOverdue
      return f.statut === statutFiltre
    })
  }, [decorated, statutFiltre])

  // KPI : on agrège sur la période/agence (tous statuts), pas sur le filtre statut
  const kpi = useMemo(() => {
    const inScope = decorated.filter(f => f._inPeriod && f._matchAgence)
    const sum = (rows: typeof inScope) => rows.reduce((s, r) => s + (r.montant_ttc || 0), 0)
    const facturesActives = inScope.filter(f => f.statut !== 'annule')
    return {
      total: sum(facturesActives),
      totalCount: facturesActives.length,
      paye: sum(facturesActives.filter(f => f.statut === 'paye')),
      attente: sum(facturesActives.filter(f => f.statut === 'envoye' && !f._isOverdue)),
      retard: sum(facturesActives.filter(f => f._isOverdue)),
      retardCount: facturesActives.filter(f => f._isOverdue).length,
      brouillon: sum(facturesActives.filter(f => f.statut === 'brouillon')),
    }
  }, [decorated])

  async function handleMarquerPaye(f: FactureRow) {
    if (!confirm(`Marquer la facture ${f.numero || ''} comme payée ?`)) return
    setPendingId(f.id); setError(''); setInfo('')
    try {
      const res = await fetch(`/api/historique/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'paye' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setFactures(prev => prev.map(x => x.id === f.id ? { ...x, statut: 'paye' } : x))
      setInfo(`Facture ${f.numero || ''} marquée comme payée.`)
    } catch (e: any) {
      setError(`Erreur : ${e.message}`)
    } finally {
      setPendingId(null)
    }
  }

  async function handleAnnuler(f: FactureRow) {
    if (!confirm(`Annuler la facture ${f.numero || ''} ? (elle ne sera plus comptabilisée mais reste consultable dans l'historique)`)) return
    setPendingId(f.id); setError(''); setInfo('')
    try {
      const res = await fetch(`/api/historique/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'annule' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setInfo(`Facture ${f.numero || ''} annulée.`)
      await load()
    } catch (e: any) {
      setError(`Erreur : ${e.message}`)
    } finally {
      setPendingId(null)
    }
  }

  async function handleSupprimer(f: FactureRow) {
    const cascadeNote = f.intervention_id
      ? '\n\n⚠ La facture est liée à une intervention : tout est effacé (intervention, rapport, devis, autres documents liés, photos).'
      : ''
    if (!confirm(`Supprimer définitivement la facture ${f.numero || ''} ?${cascadeNote}\n\nAction irréversible.`)) return
    setPendingId(f.id); setError(''); setInfo('')
    try {
      const res = await fetch(`/api/historique/${f.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setInfo(`Facture ${f.numero || ''} supprimée.`)
      await load()
    } catch (e: any) {
      setError(`Erreur suppression : ${e.message}`)
    } finally {
      setPendingId(null)
    }
  }

  async function handleRelancer(f: FactureRow) {
    const email = f.client_email || prompt(`Email du client pour la relance ?`)
    if (!email) return
    if (!confirm(`Envoyer une relance à ${email} pour la facture ${f.numero || ''} ?`)) return
    setPendingId(f.id); setError(''); setInfo('')
    try {
      const eche = parseEcheance(f.echeance, f.date_emission)
      // Le payload n'est plus retourné par /api/historique (retiré pour ne pas
      // tronquer la response) — on le fetch à la demande via /api/historique/[id].
      let facturePayload = f.payload as FactureData | undefined
      if (!facturePayload || !Array.isArray(facturePayload.lignes)) {
        const r = await fetch(`/api/historique/${f.id}`, { cache: 'no-store' })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
        facturePayload = d?.document?.payload as FactureData | undefined
      }
      if (!facturePayload || !Array.isArray(facturePayload.lignes)) {
        throw new Error("Données facture incomplètes (payload manquant ou invalide)")
      }
      // Régénération du PDF côté client (même logique que le wizard /facture/nouvelle)
      const [{ FactureDocument }, { pdfDocumentToBase64 }, React] = await Promise.all([
        import('@/components/FacturePDF'),
        import('@/lib/pdfToBase64'),
        import('react'),
      ])
      const emetteur = aprimeFactureEmetteur(f.agence || undefined)
      const client = {
        nom: f.client_nom || '—',
        adresseLignes: [
          f.client_adresse || '',
          [f.client_code_postal, f.client_ville].filter(Boolean).join(' '),
        ].filter(Boolean),
      }
      const pdfBase64 = await pdfDocumentToBase64(
        React.createElement(FactureDocument, {
          emetteur,
          client,
          facture: facturePayload,
          phone: emetteur.telephone,
        })
      )
      const filename = `facture-${f.numero || 'sans-numero'}.pdf`.replace(/\s+/g, '-')
      const technicienNom = typeof window !== 'undefined' ? (localStorage.getItem('ltdb_technicien') || '') : ''

      const res = await fetch('/api/notify-facture/relance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: f.id,
          clientEmail: email,
          clientNom: f.client_nom,
          technicienNom,
          ville: f.client_ville,
          dateFacture: fmtDateISOtoFR(f.date_emission),
          numero: f.numero,
          totalTTC: f.montant_ttc,
          echeance: f.echeance,
          agence: f.agence,
          pdfBase64,
          pdfFilename: filename,
          daysOverdue: eche.daysOverdue,
          dueDate: eche.dueDate,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setFactures(prev => prev.map(x => x.id === f.id ? { ...x, envoye_at: new Date().toISOString(), envoye_email: email } : x))
      setInfo(`Relance envoyée à ${email}.`)
    } catch (e: any) {
      setError(`Erreur relance : ${e.message}`)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-7xl mx-auto px-4">
          <AppTabs />
        </div>
      </div>

      <nav className="bg-white border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ReceiptIcon className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-bold text-base sm:text-lg leading-tight tracking-tight text-slate-900">Facturation</div>
              <div className="text-[11px] text-slate-500">Suivi, paiements & relances</div>
            </div>
          </div>
          <Link
            href="/facture/nouvelle"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0e2a52] hover:bg-[#0a1f3d] text-white font-semibold text-sm transition active:scale-[0.98]"
          >
            <PlusIcon className="w-4 h-4" strokeWidth={2.25} />
            <span>Nouvelle facture</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Total émis"
            value={fmtEUR(kpi.total)}
            sub={`${kpi.totalCount} facture${kpi.totalCount > 1 ? 's' : ''}`}
            tone="slate"
          />
          <KpiCard
            label="Encaissé"
            value={fmtEUR(kpi.paye)}
            sub="payées"
            tone="emerald"
          />
          <KpiCard
            label="En attente"
            value={fmtEUR(kpi.attente)}
            sub="à recevoir"
            tone="blue"
          />
          <KpiCard
            label="En retard"
            value={fmtEUR(kpi.retard)}
            sub={`${kpi.retardCount} facture${kpi.retardCount > 1 ? 's' : ''} · à relancer`}
            tone="red"
          />
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            {STATUT_FILTRES.map(t => {
              const count = t.key === 'all'
                ? decorated.filter(f => f._inPeriod && f._matchAgence && f.statut !== 'annule').length
                : t.key === 'retard'
                  ? decorated.filter(f => f._inPeriod && f._matchAgence && f._isOverdue).length
                  : decorated.filter(f => f._inPeriod && f._matchAgence && f.statut === t.key).length
              const active = statutFiltre === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setStatutFiltre(t.key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? t.key === 'retard' ? 'bg-red-600 text-white shadow-sm' : 'bg-[#0e2a52] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.key === 'retard' && (
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-red-500'}`} aria-hidden />
                  )}
                  <span>{t.label}</span>
                  <span className={`tabular-nums ${active ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher : N° facture, client, ville…"
              className="flex-1 min-w-[200px] border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 text-sm transition-colors"
            />
            <select
              value={agence}
              onChange={e => setAgence(e.target.value)}
              className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="">Toutes les agences</option>
              {AGENCES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setPeriodeOuverte(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>{fmtDateFR(from)} → {fmtDateFR(to)}</span>
            </button>
            <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
              <ArrowRefreshIcon className="w-4 h-4" />
              <span>Rafraîchir</span>
            </button>
          </div>

          {periodeOuverte && (
            <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-200">
              <label className="text-xs text-slate-600 font-bold">Du</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="border-2 border-slate-200 rounded-lg px-2 py-1 text-sm" />
              <label className="text-xs text-slate-600 font-bold">Au</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="border-2 border-slate-200 rounded-lg px-2 py-1 text-sm" />
              <button
                type="button"
                onClick={() => { const p = presetThisMonth(); setFrom(p.from); setTo(p.to) }}
                className="px-2 py-1 rounded-lg text-xs bg-slate-100 hover:bg-slate-200"
              >Ce mois</button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date()
                  setFrom(`${now.getFullYear()}-01-01`); setTo(`${now.getFullYear()}-12-31`)
                }}
                className="px-2 py-1 rounded-lg text-xs bg-slate-100 hover:bg-slate-200"
              >Cette année</button>
              <button
                type="button"
                onClick={() => { setFrom(''); setTo('') }}
                className="px-2 py-1 rounded-lg text-xs bg-slate-100 hover:bg-slate-200"
              >Tout</button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}
        {info && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm">{info}</div>
        )}

        {loading && !error && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
            Chargement…
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <ReceiptIcon className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-700 font-semibold">Aucune facture pour ce filtre.</p>
            <p className="text-slate-500 text-sm">
              {factures.length === 0
                ? 'Crée ta première facture avec le bouton « Nouvelle facture ».'
                : 'Élargis la période ou change le filtre.'}
            </p>
          </div>
        )}

        {/* Tableau */}
        {!loading && filtered.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">N°</th>
                    <th className="px-3 py-2 text-left">Émise</th>
                    <th className="px-3 py-2 text-left">Échéance</th>
                    <th className="px-3 py-2 text-left">Client</th>
                    <th className="px-3 py-2 text-left">Ville</th>
                    <th className="px-3 py-2 text-right">TTC</th>
                    <th className="px-3 py-2 text-left">Statut</th>
                    <th className="px-3 py-2 text-left">Dernier envoi</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => {
                    const isPending = pendingId === f.id
                    const isPaid = f.statut === 'paye'
                    const isCancelled = f.statut === 'annule'
                    const canMarkPaid = !isPaid && !isCancelled
                    const canCancel = !isCancelled
                    const canRelancer = f.statut === 'envoye'
                    return (
                      <tr key={f.id} className={`border-t border-slate-100 hover:bg-slate-50 ${isPending ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-3 font-mono text-xs text-[#0e2a52] font-bold">{f.numero || '—'}</td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{fmtDateFR(f.date_emission)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {f._eche.isRegleeText ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                              <CheckIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                              Réglée
                            </span>
                          ) : f._eche.dueDate ? (
                            <div className="flex flex-col">
                              <span className="text-slate-700">{fmtDateFR(f._eche.dueDate)}</span>
                              {f._isOverdue && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-semibold mt-0.5">
                                  <ClockIcon className="w-3 h-3" />
                                  +{f._eche.daysOverdue} j de retard
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">{f.echeance || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-700">{f.client_nom || '—'}</td>
                        <td className="px-3 py-3 text-slate-600">
                          {f.client_ville || '—'}
                          {f.client_code_postal ? <span className="text-xs text-slate-400 ml-1">({f.client_code_postal})</span> : null}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-[#0e2a52] tabular-nums whitespace-nowrap">{fmtEUR(f.montant_ttc)}</td>
                        <td className="px-3 py-3">
                          <StatutBadge statut={f.statut} isOverdue={f._isOverdue} />
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {f.envoye_at
                            ? <span title={f.envoye_email || ''}>{fmtDateFR(f.envoye_at.slice(0, 10))}</span>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <div className="inline-flex flex-wrap gap-1 justify-end">
                            {canMarkPaid && (
                              <button
                                type="button"
                                onClick={() => handleMarquerPaye(f)}
                                disabled={isPending}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 text-[11px] font-semibold transition disabled:opacity-50 border border-slate-200 hover:border-emerald-200"
                                title="Marquer comme payée"
                                aria-label="Marquer comme payée"
                              >
                                <CheckIcon className="w-3.5 h-3.5" strokeWidth={2.25} />
                                <span>Payée</span>
                              </button>
                            )}
                            {canRelancer && (
                              <button
                                type="button"
                                onClick={() => handleRelancer(f)}
                                disabled={isPending}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition disabled:opacity-50 border ${
                                  f._isOverdue
                                    ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                                    : 'bg-white hover:bg-amber-50 text-amber-700 border-slate-200 hover:border-amber-200'
                                }`}
                                title="Envoyer une relance"
                                aria-label="Envoyer une relance"
                              >
                                <EnvelopeIcon className="w-3.5 h-3.5" />
                                <span>Relancer</span>
                              </button>
                            )}
                            {f.pdf_url ? (
                              <a
                                href={f.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition border border-slate-200 hover:border-slate-300"
                                title="Ouvrir le PDF"
                                aria-label="Ouvrir le PDF"
                              >
                                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                                <span>PDF</span>
                              </a>
                            ) : (
                              <DocumentDownloadButton doc={f as any} />
                            )}
                            <ResendEmailButton doc={f as any} />
                            <RequestReviewButton
                              clientEmail={f.client_email}
                              clientNom={f.client_nom}
                              ville={f.client_ville}
                            />
                            {f.intervention_id && (
                              <Link
                                href={`/intervention/${f.intervention_id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-semibold transition border border-slate-200 hover:border-blue-200"
                                title="Voir l'intervention et le rapport associés"
                              >
                                📄 Rapport
                              </Link>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => handleAnnuler(f)}
                                disabled={isPending}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white hover:bg-slate-50 text-slate-500 transition disabled:opacity-50 border border-slate-200 hover:border-slate-300"
                                title="Annuler la facture"
                                aria-label="Annuler la facture"
                              >
                                <NoSymbolIcon className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSupprimer(f)}
                              disabled={isPending}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white hover:bg-red-50 hover:text-red-600 text-slate-400 transition disabled:opacity-50 border border-slate-200 hover:border-red-200"
                              title="Supprimer définitivement"
                              aria-label="Supprimer définitivement"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
              {filtered.length} facture{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function KpiCard({ label, value, sub, tone }: {
  label: string; value: string; sub?: string;
  tone: 'slate' | 'emerald' | 'blue' | 'red'
}) {
  const dotTones: Record<string, string> = {
    slate: 'bg-slate-400',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
  }
  const valueTones: Record<string, string> = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    blue: 'text-slate-900',
    red: 'text-red-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.18em]">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotTones[tone]}`} aria-hidden />
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold mt-1.5 tabular-nums tracking-tight ${valueTones[tone]}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function StatutBadge({ statut, isOverdue }: { statut: string; isOverdue: boolean }) {
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600" aria-hidden />
        En retard
      </span>
    )
  }
  const styles: Record<string, string> = {
    brouillon: 'bg-slate-200 text-slate-600',
    envoye: 'bg-blue-100 text-blue-700',
    paye: 'bg-emerald-100 text-emerald-700',
    annule: 'bg-slate-200 text-slate-500 line-through',
  }
  const label = STATUT_LABEL[statut] || statut
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[statut] || 'bg-slate-100 text-slate-600'}`}>{label}</span>
}
