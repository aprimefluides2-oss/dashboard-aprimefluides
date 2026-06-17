'use client'
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import AppTabs from "@/components/AppTabs"
import VilleCombobox from "@/components/VilleCombobox"
import { fmtDateFR, fmtEUR } from "@/lib/format"
import { CANAUX_ACQUISITION, canalIcon, canalLabel } from "@/lib/canaux"
import { TYPES_INTERVENTION, isDevisIntervention } from "@/lib/types-intervention"

const InterventionMap = dynamic(() => import('@/components/InterventionMap'), { ssr: false })
const InterventionRapportDownloadButton = dynamic(
  () => import('@/components/InterventionRapportDownloadButton'),
  { ssr: false },
)
const CreateFactureFromRapportButton = dynamic(
  () => import('@/components/CreateFactureFromRapportButton'),
  { ssr: false },
)
const InterventionActionsHub = dynamic(
  () => import('@/components/InterventionActionsHub'),
  { ssr: false },
)
const GenerateVideoButton = dynamic(
  () => import('@/components/GenerateVideoButton'),
  { ssr: false },
)

type Statut = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

type InterventionDetail = {
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
  rapport_json: any
  photos_urls: string[] | null
  canal_acquisition: string | null
  video_urls: Partial<Record<'vertical' | 'horizontal' | 'square', string>> | null
  video_status: 'idle' | 'rendering' | 'ready' | 'failed' | 'uploading' | 'published' | null
  video_error: string | null
  video_youtube_id: string | null
  video_youtube_url: string | null
  terrain_step: number | null
  heure_debut_reelle: string | null
  heure_fin_reelle: string | null
  mail_envoye_at: string | null
  avis_relance_at: string | null
  avis_recu: boolean | null
  photos_legendes: string[] | null
  created_at: string
  updated_at: string
}

type ClientDetail = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

type TechnicienDetail = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  agence: string | null
}

const STATUT_LABEL: Record<Statut, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
}

const STATUT_BADGE: Record<Statut, string> = {
  planifiee: 'bg-blue-100 text-blue-700',
  en_cours: 'bg-amber-100 text-amber-700',
  terminee: 'bg-emerald-100 text-emerald-700',
  annulee: 'bg-slate-200 text-slate-600',
}

export default function InterventionDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [intervention, setIntervention] = useState<InterventionDetail | null>(null)
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [technicien, setTechnicien] = useState<TechnicienDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionInProgress, setActionInProgress] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  // Mode édition
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [techniciens, setTechniciens] = useState<TechnicienDetail[]>([])
  const [techniciensError, setTechniciensError] = useState('')
  const [hasFacture, setHasFacture] = useState(false)
  const [hasDevis, setHasDevis] = useState(false)
  const [form, setForm] = useState<Partial<InterventionDetail>>({})
  const [clientForm, setClientForm] = useState<Partial<ClientDetail>>({})

  function startEdit() {
    if (!intervention) return
    setForm({
      type_intervention: intervention.type_intervention,
      date_prevue: intervention.date_prevue,
      heure_prevue: intervention.heure_prevue ? intervention.heure_prevue.slice(0, 5) : null,
      duree_estimee_min: intervention.duree_estimee_min,
      urgence: intervention.urgence,
      prix_prevu: intervention.prix_prevu,
      adresse_chantier: intervention.adresse_chantier,
      ville: intervention.ville,
      code_postal: intervention.code_postal,
      technicien_id: intervention.technicien_id,
      agence: intervention.agence,
      notes_internes: intervention.notes_internes,
    })
    setClientForm(
      client
        ? {
            nom: client.nom,
            telephone: client.telephone,
            email: client.email,
            adresse: client.adresse,
            code_postal: client.code_postal,
            ville: client.ville,
          }
        : {},
    )
    setActionMsg(''); setError('')
    setEditing(true)
    if (techniciens.length === 0) {
      setTechniciensError('')
      fetch('/api/techniciens?all=1', { cache: 'no-store' })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then(d => setTechniciens(d.techniciens || []))
        .catch((e: any) => {
          setTechniciensError(`Impossible de charger la liste des techniciens (${e?.message || 'erreur réseau'}).`)
        })
    }
  }

  function cancelEdit() { setEditing(false); setForm({}); setClientForm({}) }

  async function saveEdit() {
    if (!intervention) return
    setSaving(true); setError(''); setActionMsg('')
    try {
      // Diff intervention
      const payload: Record<string, unknown> = {}
      const original: any = intervention
      for (const [k, v] of Object.entries(form)) {
        const orig = k === 'heure_prevue' ? (original[k] ? String(original[k]).slice(0, 5) : null) : original[k]
        if (v !== orig) payload[k] = v === '' ? null : v
      }

      // Diff coordonnées client (modifiables depuis la fiche intervention :
      // le tel/mail manque souvent à la prise de RDV).
      const clientPatch: Record<string, unknown> = {}
      if (client) {
        const origClient: any = client
        for (const [k, v] of Object.entries(clientForm)) {
          const norm = typeof v === 'string' && v.trim() !== '' ? v.trim() : null
          const orig = origClient[k] ?? null
          if (norm !== orig) clientPatch[k] = norm
        }
      }

      const nbIntervention = Object.keys(payload).length
      const nbClient = Object.keys(clientPatch).length
      if (nbIntervention === 0 && nbClient === 0) {
        setEditing(false); setSaving(false); return
      }

      if (nbIntervention > 0) {
        const res = await fetch(`/api/interventions/${intervention.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        setIntervention(data.intervention)
      }

      if (nbClient > 0 && client) {
        const res = await fetch(`/api/clients/${client.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientPatch),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        setClient(data.client)
      }

      setActionMsg('Modifications enregistrées')
      setEditing(false)
      // recharge le client/technicien si technicien changé
      if ('technicien_id' in payload) await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/interventions/${params.id}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setIntervention(data.intervention)
      setClient(data.client)
      setTechnicien(data.technicien)
      setHasDevis(!!data.has_devis)
      // Vérifie l'existence d'une facture liée via l'endpoint dédié (filtre côté
      // DB par intervention_id). Avant on listait /api/historique?limit=500 mais
      // le SELECT à 16 colonnes peut sauter une ligne sur Vercel (bug
      // PostgREST/supabase-js déjà documenté), ce qui faisait croire qu'aucune
      // facture n'existait alors qu'elle était bien là.
      try {
        const factRes = await fetch(`/api/interventions/${params.id}/facture`, { cache: 'no-store' })
        const factJson = await factRes.json()
        setHasFacture(!!factJson?.facture)
      } catch {
        // best-effort
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [params.id])

  // Intervention « Devis » : pas de mode terrain → génération devis directe
  useEffect(() => {
    if (!intervention || loading) return
    if (!isDevisIntervention(intervention.type_intervention)) return
    if (hasDevis) return
    if (intervention.statut === 'annulee' || intervention.statut === 'terminee') return
    const key = `ltdb_devis_redirect_${intervention.id}`
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key) === '1') return
    sessionStorage.setItem(key, '1')
    router.replace(`/devis?intervention=${intervention.id}`)
  }, [intervention, loading, hasDevis, router, params.id])

  // Recharge la fiche quand l'onglet redevient visible ou prend le focus.
  // Garantit que hasFacture est à jour après suppression d'une facture
  // dans un autre onglet/page (ex: /historique).
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  async function updateStatut(statut: Statut) {
    if (!intervention) return
    setActionInProgress(true); setError(''); setActionMsg('')
    try {
      const res = await fetch(`/api/interventions/${intervention.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setIntervention(data.intervention)
      setActionMsg(`Statut mis à jour : ${STATUT_LABEL[statut]}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionInProgress(false)
    }
  }

  async function hardDelete() {
    if (!intervention) return
    const confirm1 = confirm('Supprimer DÉFINITIVEMENT cette intervention ? Cette action est irréversible.')
    if (!confirm1) return
    const confirm2 = prompt('Tape SUPPRIMER pour confirmer la suppression définitive.')
    if (confirm2 !== 'SUPPRIMER') return
    setActionInProgress(true); setError('')
    try {
      const res = await fetch(`/api/interventions/${intervention.id}?hard=1`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      router.push('/planning')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setActionInProgress(false)
    }
  }

  function goToRapport() {
    if (!intervention) return
    const hasRapport = !!intervention.rapport_json && Object.keys(intervention.rapport_json || {}).length > 0
    if (typeof window !== 'undefined') {
      if (hasRapport) {
        // Demande à /nouveau de charger le rapport existant pour édition.
        sessionStorage.setItem('ltdb_load_rapport_id', intervention.id)
        sessionStorage.removeItem('ltdb_intervention_prefill')
      } else {
        const prefill = {
          intervention_id: intervention.id,
          clientNom: client?.nom || '',
          clientEmail: client?.email || '',
          adresse: intervention.adresse_chantier || client?.adresse || '',
          ville: intervention.ville || client?.ville || '',
          codePostal: intervention.code_postal || client?.code_postal || '',
          dateIntervention: intervention.date_prevue || new Date().toISOString().slice(0, 10),
          typeIntervention: intervention.type_intervention || '',
          technicienNom: technicien?.nom || '',
        }
        sessionStorage.setItem('ltdb_intervention_prefill', JSON.stringify(prefill))
        sessionStorage.removeItem('ltdb_load_rapport_id')
      }
    }
    router.push('/nouveau')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 py-2">
          <div className="max-w-4xl mx-auto px-4"><AppTabs /></div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-10 text-center text-slate-500">Chargement…</div>
      </div>
    )
  }

  if (error || !intervention) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 py-2">
          <div className="max-w-4xl mx-auto px-4"><AppTabs /></div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
            {error || 'Intervention introuvable'}
          </div>
          <Link href="/planning" className="inline-block mt-4 text-blue-600 hover:underline font-semibold">← Retour au planning</Link>
        </div>
      </div>
    )
  }

  const adresseComplete = [
    intervention.adresse_chantier,
    [intervention.code_postal, intervention.ville].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-4xl mx-auto px-4"><AppTabs /></div>
      </div>

      <nav className="bg-[#0e2a52] text-white px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-base sm:text-lg leading-tight">{intervention.type_intervention || 'Intervention'}</span>
              {intervention.urgence && <span className="text-[10px] font-bold bg-red-500 px-2 py-0.5 rounded-full">🚨 URG</span>}
            </div>
            <div className="text-[11px] opacity-70 truncate">
              {intervention.reference || intervention.id.slice(0, 8)}
              {intervention.agence ? ` · ${intervention.agence}` : ''}
            </div>
          </div>
          <Link href="/planning" className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition">
            ← Planning
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {actionMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm">{actionMsg}</div>
        )}

        {/* Mode Terrain — masqué pour les interventions de type Devis */}
        {intervention.statut !== 'annulee'
          && !isDevisIntervention(intervention.type_intervention)
          && (intervention.terrain_step ?? 0) < 8 && (
          <Link
            href={`/intervention/${intervention.id}/terrain`}
            className="block bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl p-5 shadow-lg transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-black text-lg">🚀 Mode Terrain</div>
                <div className="text-xs opacity-90 mt-1">
                  {(intervention.terrain_step ?? 0) === 0
                    ? 'Wizard guidé : photo avant → travaux → photo après → rapport → facture → devis (option) → envoi'
                    : `Reprise à l'étape ${(intervention.terrain_step ?? 0) + 1}/8`}
                </div>
              </div>
              <div className="text-2xl">→</div>
            </div>
          </Link>
        )}

        {isDevisIntervention(intervention.type_intervention) && intervention.statut !== 'annulee' && (
          <Link
            href={`/devis?intervention=${intervention.id}`}
            className="block bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl p-5 shadow-lg transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-black text-lg">📋 {hasDevis ? 'Modifier / renvoyer le devis' : 'Générer le devis'}</div>
                <div className="text-xs opacity-90 mt-1">
                  Pas de mode terrain — établir le devis, envoi immédiat ou relances sur 3 semaines (-10 % semaine 3)
                </div>
              </div>
              <div className="text-2xl">→</div>
            </div>
          </Link>
        )}

        {/* Statut & actions */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Statut</div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${STATUT_BADGE[intervention.statut]}`}>
                {STATUT_LABEL[intervention.statut]}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {intervention.statut !== 'annulee' && (
                <Link
                  href={`/accord/nouveau?intervention=${intervention.id}`}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition"
                  title="Devis + accord signé à faire valider avant les travaux"
                >
                  🤝 Créer l&apos;accord
                </Link>
              )}
              {intervention.statut !== 'annulee' && (
                <button
                  onClick={goToRapport}
                  className="bg-[#0e2a52] hover:bg-[#0a2047] text-white px-4 py-2.5 rounded-xl font-bold text-sm transition"
                >
                  {intervention.rapport_json && Object.keys(intervention.rapport_json || {}).length > 0
                    ? '📄 Modifier le rapport'
                    : '📄 Aller au rapport'}
                </button>
              )}
              {!editing && (
                <button
                  onClick={startEdit}
                  disabled={actionInProgress}
                  className="bg-white border-2 border-blue-300 text-blue-700 hover:bg-blue-50 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition"
                  title="Modifier les informations de l'intervention"
                >
                  ✏ Modifier
                </button>
              )}
              {intervention.statut !== 'annulee' && intervention.statut !== 'terminee' && (
                <button
                  onClick={() => {
                    if (confirm('Annuler cette intervention ? (statut → annulée, conservée dans l\'historique)')) updateStatut('annulee')
                  }}
                  disabled={actionInProgress}
                  className="bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition"
                >
                  ✕ Annuler
                </button>
              )}
              <button
                onClick={hardDelete}
                disabled={actionInProgress}
                className="bg-white border-2 border-red-300 text-red-700 hover:bg-red-50 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition"
                title="Supprime définitivement de la base de données — irréversible"
              >
                🗑 Supprimer
              </button>
            </div>
          </div>
          {intervention.rapport_json && Object.keys(intervention.rapport_json || {}).length > 0 && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-0.5">Rapport d&apos;intervention</div>
                <div className="text-sm text-slate-700">PDF disponible — télécharger ou facturer.</div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <CreateFactureFromRapportButton
                  disabled={hasFacture}
                  disabledReason="Une facture est déjà liée à cette intervention. Supprime-la depuis l'historique pour pouvoir en recréer une."
                  source={{
                    rapport: intervention.rapport_json,
                    client_nom: client?.nom || null,
                    client_email: client?.email || null,
                    client_adresse: client?.adresse || null,
                    client_code_postal: client?.code_postal || null,
                    client_ville: client?.ville || null,
                    adresse_chantier: intervention.adresse_chantier || null,
                    type_intervention: intervention.type_intervention || null,
                    date_intervention: intervention.date_realisee || intervention.date_prevue || null,
                    reference: intervention.reference || null,
                  }}
                />
                <InterventionRapportDownloadButton
                  intervention={{
                    id: intervention.id,
                    reference: intervention.reference,
                    type_intervention: intervention.type_intervention,
                    adresse_chantier: intervention.adresse_chantier,
                    ville: intervention.ville,
                    code_postal: intervention.code_postal,
                    date_realisee: intervention.date_realisee,
                    date_prevue: intervention.date_prevue,
                    rapport_json: intervention.rapport_json,
                    photos_urls: intervention.photos_urls,
                    client_nom: client?.nom || null,
                    client_adresse: client?.adresse || null,
                    client_code_postal: client?.code_postal || null,
                    client_ville: client?.ville || null,
                    technicien_nom: technicien?.nom || null,
                  }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Hub d'actions : envoi combiné, publication, vidéo, facture */}
        <InterventionActionsHub
          interventionId={intervention.id}
          hasRapport={!!intervention.rapport_json && Object.keys(intervention.rapport_json || {}).length > 0}
          hasFacture={hasFacture}
          clientEmail={client?.email || null}
          publieSlug={intervention.publie_slug}
          onCreateFacture={() => {
            if (!intervention.rapport_json) return
            import('@/lib/rapportToFacture').then(({ buildFactureFromRapport }) => {
              const payload = buildFactureFromRapport({
                rapport: intervention.rapport_json,
                client_nom: client?.nom || null,
                client_email: client?.email || null,
                client_adresse: client?.adresse || null,
                client_code_postal: client?.code_postal || null,
                client_ville: client?.ville || null,
                adresse_chantier: intervention.adresse_chantier || null,
                type_intervention: intervention.type_intervention || null,
                date_intervention: intervention.date_realisee || intervention.date_prevue || null,
                reference: intervention.reference || null,
              })
              sessionStorage.setItem('ltdb_devis_to_facture', JSON.stringify(payload))
              router.push('/facture/nouvelle')
            })
          }}
        />
        {!editing && intervention.statut === 'terminee' ? (
          <GenerateVideoButton
            interventionId={intervention.id}
            hasPhotos={!!(intervention.photos_urls && intervention.photos_urls.length > 0)}
            initialVideoUrls={intervention.video_urls}
            initialVideoStatus={intervention.video_status}
            initialVideoError={intervention.video_error}
            initialYoutubeUrl={intervention.video_youtube_url}
          />
        ) : null}

        {/* Date / heure / type */}
        {editing ? (
          <section className="bg-blue-50 rounded-2xl shadow-sm border border-blue-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <EditField label="Date prévue">
              <input type="date" value={form.date_prevue || ''} onChange={e => setForm(f => ({ ...f, date_prevue: e.target.value || null }))} className={editInputCls} />
            </EditField>
            <EditField label="Heure">
              <input type="time" value={form.heure_prevue || ''} onChange={e => setForm(f => ({ ...f, heure_prevue: e.target.value || null }))} className={editInputCls} />
            </EditField>
            <EditField label="Durée (min)">
              <input type="number" min="0" step="15" value={form.duree_estimee_min ?? ''} onChange={e => setForm(f => ({ ...f, duree_estimee_min: e.target.value ? Number(e.target.value) : null }))} className={editInputCls} />
            </EditField>
            <EditField label="Type">
              <select value={form.type_intervention || ''} onChange={e => setForm(f => ({ ...f, type_intervention: e.target.value || null }))} className={editInputCls}>
                <option value="">—</option>
                {TYPES_INTERVENTION.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </EditField>
            <EditField label="Urgence">
              <label className="inline-flex items-center gap-2 mt-1">
                <input type="checkbox" checked={!!form.urgence} onChange={e => setForm(f => ({ ...f, urgence: e.target.checked }))} className="w-5 h-5 accent-red-500" />
                <span className="text-sm font-bold">{form.urgence ? '🚨 Urgente' : 'Non urgente'}</span>
              </label>
            </EditField>
            <EditField label="Prix prévu (€)">
              <input type="number" min="0" step="0.01" value={form.prix_prevu ?? ''} onChange={e => setForm(f => ({ ...f, prix_prevu: e.target.value ? Number(e.target.value) : null }))} className={editInputCls} />
            </EditField>
          </section>
        ) : (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoCell label="Date prévue" value={fmtDateFR(intervention.date_prevue)} />
            <InfoCell label="Heure" value={intervention.heure_prevue ? intervention.heure_prevue.slice(0, 5) : '—'} />
            <InfoCell label="Durée estimée" value={intervention.duree_estimee_min ? `${intervention.duree_estimee_min} min` : '—'} />
            <InfoCell label="Type" value={intervention.type_intervention || '—'} />
            <InfoCell label="Urgence" value={intervention.urgence ? '🚨 Oui' : 'Non'} />
            <InfoCell label="Prix prévu" value={fmtEUR(intervention.prix_prevu)} />
          </section>
        )}

        {/* Canal d'acquisition (éditable) */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Canal d&apos;acquisition</h2>
            <span className="text-base">
              {canalIcon(intervention.canal_acquisition)} {canalLabel(intervention.canal_acquisition)}
            </span>
          </div>
          <select
            value={intervention.canal_acquisition || ''}
            onChange={async (e) => {
              const value = e.target.value || null
              try {
                const res = await fetch(`/api/interventions/${intervention.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ canal_acquisition: value }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
                setIntervention(data.intervention)
                setActionMsg('Canal d\'acquisition mis à jour')
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              }
            }}
            disabled={actionInProgress}
            className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">— non précisé —</option>
            {CANAUX_ACQUISITION.map(c => (
              <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400">Modifie l&apos;origine de la prise de rendez-vous. Visible dans 📊 Stats.</p>
        </section>

        {/* Client */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Client</h2>
          {editing && client ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-blue-50 rounded-xl p-3 border border-blue-200">
              <EditField label="Nom">
                <input value={clientForm.nom || ''} onChange={e => setClientForm(f => ({ ...f, nom: e.target.value }))} className={editInputCls} />
              </EditField>
              <EditField label="Téléphone">
                <input value={clientForm.telephone || ''} onChange={e => setClientForm(f => ({ ...f, telephone: e.target.value }))} className={editInputCls} inputMode="tel" placeholder="Compléter le téléphone…" />
              </EditField>
              <div className="sm:col-span-2">
                <EditField label="Email">
                  <input value={clientForm.email || ''} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} className={editInputCls} inputMode="email" placeholder="Compléter l'email…" />
                </EditField>
              </div>
              <div className="sm:col-span-2">
                <EditField label="Adresse client">
                  <input value={clientForm.adresse || ''} onChange={e => setClientForm(f => ({ ...f, adresse: e.target.value }))} className={editInputCls} />
                </EditField>
              </div>
              <EditField label="Code postal">
                <input value={clientForm.code_postal || ''} onChange={e => setClientForm(f => ({ ...f, code_postal: e.target.value }))} className={editInputCls} inputMode="numeric" />
              </EditField>
              <EditField label="Ville">
                <input value={clientForm.ville || ''} onChange={e => setClientForm(f => ({ ...f, ville: e.target.value }))} className={editInputCls} />
              </EditField>
            </div>
          ) : client ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <InfoCell label="Nom" value={client.nom} />
              <InfoCell label="Téléphone" value={client.telephone ? <a href={`tel:${client.telephone}`} className="text-blue-600 hover:underline font-bold">{client.telephone}</a> : '—'} />
              <InfoCell label="Email" value={client.email ? <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">{client.email}</a> : '—'} />
              <InfoCell label="Ville" value={[client.code_postal, client.ville].filter(Boolean).join(' ') || '—'} />
              <div className="sm:col-span-2">
                <InfoCell label="Adresse client" value={client.adresse || '—'} />
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">Aucun client lié</p>
          )}
        </section>

        {/* Chantier + map */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Chantier</h2>
            {adresseComplete && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresseComplete)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-blue-700 hover:text-blue-900"
              >
                🗺 Itinéraire Maps →
              </a>
            )}
          </div>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-blue-50 rounded-xl p-3 border border-blue-200">
              <EditField label="Adresse">
                <input value={form.adresse_chantier || ''} onChange={e => setForm(f => ({ ...f, adresse_chantier: e.target.value || null }))} className={editInputCls} />
              </EditField>
              <EditField label="Code postal">
                <input value={form.code_postal || ''} onChange={e => setForm(f => ({ ...f, code_postal: e.target.value || null }))} className={editInputCls} />
              </EditField>
              <EditField label="Ville">
                <VilleCombobox
                  value={form.ville || ''}
                  onChange={(nom) => setForm(f => ({ ...f, ville: nom || null }))}
                  onSelect={(v) => setForm(f => ({ ...f, ville: v.nom, code_postal: v.cp || f.code_postal }))}
                />
              </EditField>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCell label="Adresse" value={intervention.adresse_chantier || '—'} />
              <InfoCell label="Ville" value={[intervention.code_postal, intervention.ville].filter(Boolean).join(' ') || '—'} />
            </div>
          )}
          <InterventionMap
            adresse={intervention.adresse_chantier ?? undefined}
            ville={intervention.ville ?? undefined}
            codePostal={intervention.code_postal ?? undefined}
            showCadastre
            className="h-80 rounded-xl overflow-hidden"
          />
        </section>

        {/* Technicien */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Technicien assigné</h2>
          {editing ? (
            <>
              <select
                value={form.technicien_id || ''}
                onChange={e => setForm(f => ({ ...f, technicien_id: e.target.value || null }))}
                className={editInputCls + ' bg-blue-50 border-blue-200'}
              >
                <option value="">— non assigné —</option>
                {techniciens.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nom}{t.agence ? ` · ${t.agence}` : ''}
                  </option>
                ))}
              </select>
              {techniciensError && (
                <p className="text-xs text-red-600 mt-1">⚠ {techniciensError}</p>
              )}
            </>
          ) : technicien ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <InfoCell label="Nom" value={technicien.nom} />
              <InfoCell label="Agence" value={technicien.agence || '—'} />
              <InfoCell label="Téléphone" value={technicien.telephone ? <a href={`tel:${technicien.telephone}`} className="text-blue-600 hover:underline font-bold">{technicien.telephone}</a> : '—'} />
              <InfoCell label="Email" value={technicien.email || '—'} />
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">Aucun technicien assigné</p>
          )}
        </section>

        {/* Notes */}
        {editing ? (
          <section className="bg-amber-50 rounded-2xl border border-amber-200 p-5 space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800">Notes internes</h2>
            <textarea
              value={form.notes_internes || ''}
              onChange={e => setForm(f => ({ ...f, notes_internes: e.target.value || null }))}
              rows={4}
              className={editInputCls + ' resize-y bg-white'}
              placeholder="Notes visibles uniquement en interne…"
            />
          </section>
        ) : intervention.notes_internes ? (
          <section className="bg-amber-50 rounded-2xl border border-amber-200 p-5 space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800">Notes internes</h2>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{intervention.notes_internes}</p>
          </section>
        ) : null}
      </main>

      {editing && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-3 z-30">
          <div className="max-w-4xl mx-auto flex gap-3">
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg disabled:opacity-60 transition"
            >
              {saving ? 'Enregistrement…' : '💾 Enregistrer les modifications'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const editInputCls = "w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm bg-white transition-colors"

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">{label}</div>
      <div className="text-sm text-slate-700 font-semibold">{value}</div>
    </div>
  )
}
