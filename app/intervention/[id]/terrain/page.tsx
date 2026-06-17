'use client'
import { useEffect, useState, useRef } from 'react'
import Link from "next/link"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import TerrainStepper from "@/components/terrain/TerrainStepper"
import TerrainPhotoCapture from "@/components/terrain/TerrainPhotoCapture"
import TerrainOceanLoader from "@/components/terrain/TerrainOceanLoader"
import DevisEnvoiPanel from "@/components/DevisEnvoiPanel"
import type { DevisData, DevisLineData } from "@/components/DevisPDF"
import { joinNomPrenom } from "@/lib/rapportToDevis"
import { proxyImageUrl } from "@/lib/proxyImageUrl"
import { fetchJsonWithRetry, fetchWithRetry } from "@/lib/fetchWithRetry"
import { isDevisIntervention } from "@/lib/types-intervention"

const VoiceRecorder = dynamic(() => import("@/components/VoiceRecorder"), { ssr: false })

type Intervention = {
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
  date_realisee: string | null
  statut: string
  terrain_step: number
  heure_debut_reelle: string | null
  heure_fin_reelle: string | null
  mail_envoye_at: string | null
  rapport_json: any
  photos_urls: string[] | null
  photos_legendes: string[] | null
  publie_slug: string | null
  prix_prevu: number | null
  video_urls?: { horizontal?: string; vertical?: string; square?: string } | null
  video_youtube_url?: string | null
  video_status?: string | null
}

type Client = {
  id: string
  nom: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
} | null

export default function TerrainPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [interv, setInterv] = useState<Intervention | null>(null)
  const [client, setClient] = useState<Client>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const res = await fetch(`/api/interventions/${params.id}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (isDevisIntervention(data.intervention?.type_intervention)) {
        router.replace(`/devis?intervention=${params.id}`)
        return
      }
      setInterv(data.intervention)
      setClient(data.client)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [params.id])

  async function setStep(step: number) {
    setError('')
    try {
      const res = await fetch(`/api/interventions/${params.id}/terrain-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', step }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setInterv(data.intervention)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function callTerrainAction(action: 'debut' | 'fin') {
    setError('')
    try {
      const res = await fetch(`/api/interventions/${params.id}/terrain-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setInterv(data.intervention)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Chargement…</div>
  }
  // Écran d'erreur plein écran UNIQUEMENT si l'intervention n'a pas pu être
  // chargée. Une erreur d'étape (envoi, facture…) ne doit pas faire disparaître
  // tout le wizard : elle s'affiche en bandeau inline et l'utilisateur peut
  // réessayer sans recharger la page.
  if (!interv) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">{error || 'Intervention introuvable'}</div>
        <Link href="/planning" className="inline-block mt-4 text-blue-600 hover:underline font-semibold">← Retour au planning</Link>
      </div>
    )
  }

  const step = interv.terrain_step ?? 0

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header sticky */}
      <nav className="bg-[#0e2a52] text-white px-4 py-3 sticky top-0 z-30 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-black text-base truncate">{interv.type_intervention || 'Intervention'}</div>
            <div className="text-[11px] opacity-70 truncate">
              {client?.nom || 'Client inconnu'} · {interv.ville || '—'}
            </div>
          </div>
          <Link href={`/intervention/${interv.id}`} className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition flex-shrink-0">
            ✕ Quitter
          </Link>
        </div>
      </nav>

      <TerrainStepper current={step} onStepClick={setStep} />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 p-3 rounded-xl text-sm font-semibold mb-4">
            ⚠ {error}
          </div>
        )}

        {step === 0 && <StepPhotoAvant interv={interv} onDone={load} onError={setError} />}
        {step === 1 && <StepDemarrer interv={interv} onAction={() => callTerrainAction('debut')} />}
        {step === 2 && <StepEnCours interv={interv} onPhotoUploaded={load} onTerminer={() => callTerrainAction('fin')} onError={setError} onSkipToRapport={() => setStep(3)} />}
        {step === 3 && <StepRapport interv={interv} onSaved={load} onError={setError} />}
        {step === 4 && <StepFacture interv={interv} client={client} onCreated={load} onError={setError} />}
        {step === 5 && (
          <StepDevisOption
            interv={interv}
            client={client}
            onContinue={() => setStep(6)}
            onError={setError}
          />
        )}
        {step === 6 && (
          <TerrainDiffusionPanel interv={interv} client={client} onRefresh={load} onError={setError} />
        )}
        {step >= 7 && (
          <StepTermine interv={interv} client={client} onRefresh={load} onError={setError} />
        )}
      </main>
    </div>
  )
}

// ============================================================
// ÉTAPE 0 — Photo avant
// ============================================================
function StepPhotoAvant({ interv, onDone, onError }: { interv: Intervention; onDone: () => void; onError: (e: string) => void }) {
  return (
    <section className="space-y-5">
      <header className="text-center">
        <div className="text-5xl mb-2">📷</div>
        <h1 className="text-2xl font-black text-slate-800">Photo avant intervention</h1>
        <p className="text-sm text-slate-600 mt-2">Capture l&apos;état initial du problème avant de commencer.</p>
      </header>

      <TerrainPhotoCapture
        interventionId={interv.id}
        legendeDefaut="Photo avant intervention"
        titre="Prendre la photo AVANT"
        onUploaded={onDone}
      />

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          Passer cette étape
        </button>
      </div>
    </section>
  )
}

// ============================================================
// ÉTAPE 1 — Démarrer
// ============================================================
function StepDemarrer({ interv, onAction }: { interv: Intervention; onAction: () => void }) {
  return (
    <section className="space-y-6 text-center">
      <header>
        <div className="text-6xl mb-2">▶</div>
        <h1 className="text-2xl font-black text-slate-800">Prêt à démarrer</h1>
        <p className="text-sm text-slate-600 mt-2">Lance le chronomètre quand tu commences à travailler.</p>
      </header>

      {interv.photos_urls && interv.photos_urls[0] && (
        <div className="rounded-xl overflow-hidden border-2 border-slate-200">
          <img src={interv.photos_urls[0]} alt="Avant" className="w-full max-h-60 object-cover" />
          <div className="text-xs text-slate-500 py-1 bg-slate-100">📷 Photo avant enregistrée</div>
        </div>
      )}

      <button
        type="button"
        onClick={onAction}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-6 font-black text-xl shadow-lg transition"
      >
        ▶ Démarrer l&apos;intervention
      </button>
    </section>
  )
}

// ============================================================
// ÉTAPE 2 — En cours (chrono + photo après + terminer)
// ============================================================
function StepEnCours({ interv, onPhotoUploaded, onTerminer, onError, onSkipToRapport }: {
  interv: Intervention
  onPhotoUploaded: () => void
  onTerminer: () => void
  onError: (e: string) => void
  onSkipToRapport: () => void
}) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!interv.heure_debut_reelle) return
    const start = new Date(interv.heure_debut_reelle).getTime()
    const tick = () => {
      const diff = Date.now() - start
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setElapsed(`${m}min ${String(s).padStart(2, '0')}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [interv.heure_debut_reelle])

  const hasPhotoApres = (interv.photos_urls?.length ?? 0) >= 2

  return (
    <section className="space-y-5">
      <header className="text-center bg-amber-50 border-2 border-amber-200 rounded-2xl py-6 px-4">
        <div className="text-3xl mb-1">⏱</div>
        <div className="text-sm uppercase tracking-wider text-amber-700 font-bold">Intervention en cours</div>
        <div className="text-4xl font-black text-amber-900 mt-2 tabular-nums">{elapsed || '—'}</div>
      </header>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 space-y-4">
        <div>
          <h2 className="font-bold text-slate-800">📷 Photo après l&apos;intervention</h2>
          <p className="text-xs text-slate-500 mt-1">Capture le résultat du travail effectué.</p>
        </div>
        {!hasPhotoApres ? (
          <TerrainPhotoCapture
            interventionId={interv.id}
            legendeDefaut="Photo après intervention"
            titre="Photo APRÈS"
            onUploaded={onPhotoUploaded}
          />
        ) : (
          <div className="rounded-xl overflow-hidden border-2 border-emerald-200">
            <img src={interv.photos_urls![1]} alt="Après" className="w-full max-h-60 object-cover" />
            <div className="text-xs text-emerald-700 py-1 bg-emerald-50 font-bold">✓ Photo après enregistrée</div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onTerminer}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-4 font-black text-base shadow-lg transition"
        >
          ✓ Terminer le travail
        </button>
        {hasPhotoApres && (
          <button
            type="button"
            onClick={onSkipToRapport}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 px-5 font-bold text-sm shadow-lg transition"
          >
            🎤 →
          </button>
        )}
      </div>
    </section>
  )
}

// ============================================================
// ÉTAPE 3 — Rapport (dictée + génération + preview + validation)
// ============================================================
function StepRapport({ interv, onSaved, onError }: { interv: Intervention; onSaved: () => void; onError: (e: string) => void }) {
  const [transcription, setTranscription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genDone, setGenDone] = useState(false)
  // rapportPreview = rapport généré en mémoire, pas encore validé/sauvegardé
  const [rapportPreview, setRapportPreview] = useState<any | null>(null)
  const [seoPreview, setSeoPreview] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleGenerate() {
    if (!transcription || transcription.trim().length < 20) {
      onError('Dicte ou tape au moins quelques phrases.')
      return
    }
    setGenerating(true)
    setGenDone(false)
    try {
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription,
          type_intervention: interv.type_intervention || 'Intervention',
          ville: interv.ville || '',
          code_postal: interv.code_postal || '',
        }),
        signal: AbortSignal.timeout(180_000),
      })
      const genData = await genRes.json()
      if (!genRes.ok) throw new Error(genData.error || 'Génération échouée')

      setGenDone(true)
      await new Promise(r => setTimeout(r, 500))

      setRapportPreview(genData.rapport)
      setSeoPreview(genData.seo)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(false)
      setGenDone(false)
    }
  }

  async function handleValidate() {
    if (!rapportPreview) return
    setSaving(true)
    try {
      const saveRes = await fetch('/api/save-rapport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interventionId: interv.id,
          rapport: rapportPreview,
          seo: seoPreview,
          transcription,
          typeIntervention: interv.type_intervention,
          dateIntervention: interv.date_prevue,
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || 'Sauvegarde échouée')

      // Bump step à 4
      await fetch(`/api/interventions/${interv.id}/terrain-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', step: 4 }),
      })

      onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function handleRegenerate() {
    setRapportPreview(null)
    setSeoPreview(null)
  }

  // ── Vue 1 : preview du rapport généré, en attente de validation ──
  if (rapportPreview) {
    return (
      <section className="space-y-5">
        <header className="text-center">
          <div className="text-5xl mb-2">📄</div>
          <h1 className="text-2xl font-black text-slate-800">Aperçu du rapport</h1>
          <p className="text-sm text-slate-600 mt-2">Relis avant de valider. Tu peux re-dicter ou regénérer si besoin.</p>
        </header>

        <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 space-y-4">
          {seoPreview?.titre_h1 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">Titre</div>
              <h2 className="text-lg font-black text-slate-800">{seoPreview.titre_h1}</h2>
            </div>
          )}

          {rapportPreview.objet && (
            <PreviewField label="Objet" value={rapportPreview.objet} />
          )}
          {rapportPreview.diagnostic && (
            <PreviewField label="Diagnostic" value={rapportPreview.diagnostic} />
          )}
          {rapportPreview.travaux_realises && (
            <PreviewField label="Travaux réalisés" value={rapportPreview.travaux_realises} />
          )}
          {rapportPreview.recommandations && (
            <PreviewField label="Recommandations" value={rapportPreview.recommandations} />
          )}
          {rapportPreview.commentaire_technicien && (
            <PreviewField label="Commentaire technicien" value={rapportPreview.commentaire_technicien} />
          )}

          {Array.isArray(rapportPreview.devis?.lignes) && rapportPreview.devis.lignes.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">Devis détecté</div>
              <ul className="space-y-1 text-sm">
                {rapportPreview.devis.lignes.map((l: any, i: number) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-slate-700">{l.designation}</span>
                    <span className="text-slate-500 tabular-nums">
                      {l.qte ? `${l.qte} × ` : ''}{Number(l.pu_ht || 0).toFixed(2)} €
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={saving}
            className="flex-1 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 rounded-2xl py-4 font-bold text-sm disabled:opacity-50 transition"
          >
            ↻ Re-dicter
          </button>
          <button
            type="button"
            onClick={handleValidate}
            disabled={saving}
            className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl py-4 font-black text-base shadow-lg transition"
          >
            {saving ? '⚙ Enregistrement…' : '✓ Valider le rapport'}
          </button>
        </div>
      </section>
    )
  }

  // ── Vue 2bis : génération en cours → loader ludique ──
  if (generating) {
    return (
      <section className="space-y-5">
        <header className="text-center">
          <div className="text-5xl mb-2">✨</div>
          <h1 className="text-2xl font-black text-slate-800">Le rapport se rédige…</h1>
          <p className="text-sm text-slate-600 mt-2">Patiente quelques instants, on cingle vers le soleil.</p>
        </header>

        <TerrainOceanLoader done={genDone} expectedMs={75_000} />

        <p className="text-xs text-center text-slate-400 italic">
          {genDone
            ? 'Ouverture de l’aperçu…'
            : 'La génération prend généralement 30 à 90 secondes. Ne ferme pas la page.'}
        </p>
      </section>
    )
  }

  // ── Vue 2 : dictée initiale ──
  return (
    <section className="space-y-5">
      <header className="text-center">
        <div className="text-5xl mb-2">🎤</div>
        <h1 className="text-2xl font-black text-slate-800">Dicte le rapport</h1>
        <p className="text-sm text-slate-600 mt-2">Décris ce que tu as fait, ce que tu as trouvé, les prestations et les prix.</p>
      </header>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-4">
        <VoiceRecorder onTranscription={(text) => setTranscription(prev => (prev ? prev + ' ' : '') + text)} />
        <textarea
          value={transcription}
          onChange={e => setTranscription(e.target.value)}
          rows={8}
          placeholder="Ou tape ici directement le texte du rapport…"
          className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm resize-y"
        />
        <p className="text-[11px] text-slate-400">{transcription.length} caractères</p>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={transcription.trim().length < 20}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl py-5 font-black text-lg shadow-lg transition"
      >
        ✨ Générer le rapport
      </button>
    </section>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">{label}</div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

// ============================================================
// ÉTAPE 4 — Facture (éditeur complet : lignes, TVA 0/10/20, preview)
// ============================================================
type LigneFacture = {
  designation: string
  description: string
  qte: number
  unite: string
  pu_ht: number
  inclus: boolean
}

const UNITES = ['forfait', 'h', 'u', 'ml', 'm²', 'm³'] as const

function StepFacture({ interv, client, onCreated, onError }: {
  interv: Intervention
  client: Client
  onCreated: () => void
  onError: (e: string) => void
}) {
  const [lignes, setLignes] = useState<LigneFacture[]>([])
  const [objet, setObjet] = useState('')
  const [modeReglement, setModeReglement] = useState('')
  const [echeance, setEcheance] = useState<'Réglée' | 'À réception' | '30 jours'>('Réglée')
  const [tva, setTva] = useState<0 | 10 | 20>(10)
  const [observations, setObservations] = useState('')
  const [recommandation, setRecommandation] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [numero, setNumero] = useState('')

  // Charge le prefill au mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/interventions/${interv.id}/facture-preview`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        if (cancelled) return

        const facture = data.prefill?.facture
        if (facture) {
          setLignes((facture.lignes || []).map((l: any) => ({
            designation: l.designation || '',
            description: l.description || '',
            qte: Number(l.qte) || 1,
            unite: l.unite || 'forfait',
            pu_ht: Number(l.pu_ht) || 0,
            inclus: l.inclus === true,
          })))
          setObjet(facture.objet || '')
          setTva((facture.tva_taux === 0 || facture.tva_taux === 20) ? facture.tva_taux : 10)
          setObservations(facture.observations || '')
          setRecommandation(facture.recommandation || '')
          setNumero(facture.numero || '')
          if (typeof facture.echeance === 'string') {
            if (/r[ée]gl[ée]e?/i.test(facture.echeance)) setEcheance('Réglée')
            else if (/r[ée]ception/i.test(facture.echeance)) setEcheance('À réception')
            else setEcheance('30 jours')
          }
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [interv.id])

  function updateLigne(i: number, patch: Partial<LigneFacture>) {
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }
  function ajouterLigne() {
    setLignes(prev => [...prev, { designation: '', description: '', qte: 1, unite: 'forfait', pu_ht: 0, inclus: false }])
  }
  function supprimerLigne(i: number) {
    setLignes(prev => prev.filter((_, idx) => idx !== i))
  }

  // Calculs live
  const totalHT = lignes.reduce((s, l) => s + (l.inclus ? 0 : l.qte * l.pu_ht), 0)
  const totalTVA = totalHT * (tva / 100)
  const totalTTC = totalHT + totalTVA

  async function handleCreate() {
    if (lignes.length === 0 || !lignes.some(l => l.designation.trim())) {
      onError('Ajoute au moins une ligne avec une désignation.')
      return
    }
    setCreating(true)
    try {
      const res = await fetch(`/api/interventions/${interv.id}/facture-quick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lignes: lignes.filter(l => l.designation.trim()),
          objet: objet || undefined,
          mode_reglement: modeReglement || undefined,
          echeance,
          tva_taux: tva,
          observations: observations || undefined,
          recommandation: recommandation || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Création facture échouée')
      onCreated()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <section className="space-y-3 text-center py-10">
        <div className="animate-spin h-10 w-10 border-3 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-sm text-slate-500">Préparation de la facture…</p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <header className="text-center">
        <div className="text-5xl mb-2">🧾</div>
        <h1 className="text-2xl font-black text-slate-800">Facture</h1>
        <p className="text-sm text-slate-600 mt-2">
          {numero ? <span className="font-bold">{numero} · </span> : null}
          Modifie les lignes, le prix, la TVA. Tout est enregistré à la validation.
        </p>
      </header>

      {/* Objet */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-2">
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">Objet</label>
        <input
          value={objet}
          onChange={e => setObjet(e.target.value)}
          placeholder="Intervention de débouchage…"
          className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Lignes éditables */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Lignes</h2>
          <button
            type="button"
            onClick={ajouterLigne}
            className="text-xs font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg px-3 py-1.5 transition"
          >
            + Ajouter
          </button>
        </div>

        {lignes.length === 0 && (
          <p className="text-sm text-slate-400 italic text-center py-4">Aucune ligne. Clique &quot;+ Ajouter&quot;.</p>
        )}

        {lignes.map((l, i) => (
          <div key={i} className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-start gap-2">
              <input
                value={l.designation}
                onChange={e => updateLigne(i, { designation: e.target.value })}
                placeholder="Désignation"
                className="flex-1 border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm font-bold bg-white"
              />
              <button
                type="button"
                onClick={() => supprimerLigne(i)}
                className="text-red-600 hover:bg-red-50 rounded-lg w-9 h-9 flex items-center justify-center flex-shrink-0"
                title="Supprimer cette ligne"
              >
                ✕
              </button>
            </div>

            <input
              value={l.description}
              onChange={e => updateLigne(i, { description: e.target.value })}
              placeholder="Description (facultatif)"
              className="w-full border border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-1.5 text-xs bg-white"
            />

            <div className="grid grid-cols-12 gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={l.qte}
                onChange={e => updateLigne(i, { qte: Number(e.target.value) || 0 })}
                className="col-span-3 border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-2 py-2 text-sm text-center bg-white"
              />
              <select
                value={l.unite}
                onChange={e => updateLigne(i, { unite: e.target.value })}
                className="col-span-4 border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-2 py-2 text-sm bg-white"
              >
                {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={l.pu_ht}
                onChange={e => updateLigne(i, { pu_ht: Number(e.target.value) || 0 })}
                placeholder="PU HT"
                className="col-span-5 border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-2 py-2 text-sm text-right tabular-nums bg-white"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={l.inclus}
                  onChange={e => updateLigne(i, { inclus: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="font-bold text-slate-600">Inclus (gratuit)</span>
              </label>
              <span className="text-sm font-bold tabular-nums text-slate-700">
                {l.inclus ? <span className="text-emerald-600 italic">Inclus</span> : `${(l.qte * l.pu_ht).toFixed(2)} €`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* TVA */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-2">
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">TVA</label>
        <div className="flex gap-2">
          {([0, 10, 20] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTva(t)}
              className={`flex-1 py-2 rounded-lg font-bold text-sm ${tva === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {t}%
            </button>
          ))}
        </div>
      </div>

      {/* Règlement */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-2">
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">Règlement</label>
        <div className="flex gap-2">
          {(['Réglée', 'À réception', '30 jours'] as const).map(e => (
            <button
              key={e}
              type="button"
              onClick={() => setEcheance(e)}
              className={`flex-1 py-2 rounded-lg font-bold text-xs ${echeance === e ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {e}
            </button>
          ))}
        </div>
        {echeance === 'Réglée' && (
          <input
            value={modeReglement}
            onChange={e => setModeReglement(e.target.value)}
            placeholder="Mode (CB, espèces, chèque…)"
            className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm"
          />
        )}
      </div>

      {/* Preview totaux */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 space-y-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-blue-700 mb-2">Aperçu</h2>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Total HT</span>
          <span className="font-bold tabular-nums">{totalHT.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">TVA ({tva}%)</span>
          <span className="font-bold tabular-nums">{totalTVA.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between border-t border-blue-300 pt-2 mt-2">
          <span className="font-black text-lg">Total TTC</span>
          <span className="font-black text-lg tabular-nums text-blue-900">{totalTTC.toFixed(2)} €</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCreate}
        disabled={creating}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl py-5 font-black text-lg shadow-lg transition"
      >
        {creating ? '⚙ Enregistrement…' : '✓ Enregistrer la facture'}
      </button>
    </section>
  )
}

// ============================================================
// ÉTAPE 5 — Devis optionnel (envoi séparé du mail rapport+facture)
// ============================================================
function StepDevisOption({ interv, client, onContinue, onError }: {
  interv: Intervention
  client: Client
  onContinue: () => void | Promise<void>
  onError: (e: string) => void
}) {
  const [phase, setPhase] = useState<'ask' | 'form'>('ask')
  const [loading, setLoading] = useState(false)
  const [devis, setDevis] = useState<DevisData | null>(null)
  const [prenom, setPrenom] = useState('')
  const [nomFamille, setNomFamille] = useState('')
  const [email, setEmail] = useState(client?.email || '')
  const [adresse, setAdresse] = useState('')
  const [cp, setCp] = useState('')
  const [ville, setVille] = useState('')

  async function loadDevisForm() {
    setLoading(true)
    onError('')
    try {
      const res = await fetch(`/api/interventions/${interv.id}/devis-preview`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const p = data.prefill
      const lignes: DevisLineData[] = (p.devis?.lignes?.length
        ? p.devis.lignes
        : [{ designation: '', description: '', qte: 1, unite: 'forfait', pu_ht: 0 }]
      ).map((l: DevisLineData) => ({
        designation: l.designation || '',
        description: l.description || '',
        qte: Number(l.qte) || 1,
        unite: l.unite || 'forfait',
        pu_ht: Number(l.pu_ht) || 0,
        section: l.section,
      }))
      setDevis({ ...p.devis, lignes })
      setPrenom(p.client_prenom || '')
      setNomFamille(p.client_nom_famille || '')
      setEmail(p.client_email || client?.email || '')
      setAdresse(p.client_adresse || client?.adresse || '')
      setCp(p.client_cp || client?.code_postal || '')
      setVille(p.client_ville || client?.ville || interv.ville || '')
      setPhase('form')
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const clientNom = joinNomPrenom(prenom, nomFamille)
  const tvaTaux: 0 | 10 | 20 = devis?.tva_taux === 0 || devis?.tva_taux === 20 ? devis.tva_taux : 10
  const lignes = devis?.lignes || []
  const totalHT = lignes.reduce(
    (s, l) => s + (Number(l.qte) || 0) * (Number(l.pu_ht) || 0),
    0,
  )
  const totalTVA = totalHT * (tvaTaux / 100)
  const totalTTC = totalHT + totalTVA
  const dateDevis = devis?.date_devis
    ? devis.date_devis.split('-').reverse().join('/')
    : ''

  function updateLigne(i: number, patch: Partial<DevisLineData>) {
    if (!devis) return
    setDevis({
      ...devis,
      lignes: devis.lignes.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    })
  }
  function ajouterLigne() {
    if (!devis) return
    setDevis({
      ...devis,
      lignes: [...devis.lignes, { designation: '', description: '', qte: 1, unite: 'forfait', pu_ht: 0 }],
    })
  }
  function supprimerLigne(i: number) {
    if (!devis) return
    setDevis({ ...devis, lignes: devis.lignes.filter((_, idx) => idx !== i) })
  }
  function setTva(t: 0 | 10 | 20) {
    if (!devis) return
    setDevis({ ...devis, tva_taux: t })
  }

  if (phase === 'ask') {
    return (
      <section className="space-y-6">
        <header className="text-center">
          <div className="text-5xl mb-2">📋</div>
          <h1 className="text-2xl font-black text-slate-800">Devis complémentaire ?</h1>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            La facture est enregistrée. Souhaitez-vous envoyer un <strong>devis séparé</strong> au client
            (même procédure que les devis classiques : relances sur 3 semaines) ?
          </p>
        </header>

        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          Le devis part dans un <strong>mail distinct</strong> du rapport et de la facture (étape suivante).
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={loadDevisForm}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-2xl py-5 font-black text-lg shadow-lg transition"
          >
            {loading ? '⚙ Préparation…' : '✓ Oui, envoyer un devis'}
          </button>
          <button
            type="button"
            onClick={() => onContinue()}
            disabled={loading}
            className="w-full bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 rounded-2xl py-4 font-bold text-base transition"
          >
            Non, passer à l&apos;envoi client →
          </button>
        </div>
      </section>
    )
  }

  if (!devis) {
    return (
      <section className="text-center py-10 text-slate-500">
        <p>Impossible de charger le devis.</p>
        <button type="button" onClick={() => setPhase('ask')} className="mt-4 text-blue-600 underline text-sm">
          Retour
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <header className="text-center">
        <div className="text-5xl mb-2">📋</div>
        <h1 className="text-2xl font-black text-slate-800">Envoyer le devis</h1>
        <p className="text-sm text-slate-600 mt-2">
          {devis.numero} · {devis.lignes.length} ligne{devis.lignes.length > 1 ? 's' : ''}
        </p>
      </header>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 font-bold">Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Prénom</label>
            <input
              value={prenom}
              onChange={e => setPrenom(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm"
              placeholder="Jean"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Nom</label>
            <input
              value={nomFamille}
              onChange={e => setNomFamille(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm"
              placeholder="Dupont"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Adresse</label>
          <input
            value={adresse}
            onChange={e => setAdresse(e.target.value)}
            className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Code postal</label>
            <input
              value={cp}
              onChange={e => setCp(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Ville</label>
            <input
              value={ville}
              onChange={e => setVille(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-2">
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">Objet du devis</label>
        <input
          value={devis.objet || ''}
          onChange={e => setDevis({ ...devis, objet: e.target.value })}
          placeholder="Travaux complémentaires…"
          className="w-full border-2 border-slate-200 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Prestations</h2>
          <button
            type="button"
            onClick={ajouterLigne}
            className="text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg px-3 py-1.5 transition"
          >
            + Ajouter
          </button>
        </div>

        {lignes.length === 0 && (
          <p className="text-sm text-slate-400 italic text-center py-3">Aucune ligne — clique « + Ajouter ».</p>
        )}

        {lignes.map((l, i) => (
          <div key={i} className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-start gap-2">
              <input
                value={l.designation}
                onChange={e => updateLigne(i, { designation: e.target.value })}
                placeholder="Prestation (ex. Pompage fosse)"
                className="flex-1 border-2 border-slate-200 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm font-bold bg-white"
              />
              <button
                type="button"
                onClick={() => supprimerLigne(i)}
                className="text-red-600 hover:bg-red-50 rounded-lg w-9 h-9 flex items-center justify-center flex-shrink-0"
                title="Supprimer"
              >
                ✕
              </button>
            </div>
            <input
              value={l.description || ''}
              onChange={e => updateLigne(i, { description: e.target.value })}
              placeholder="Précisions (facultatif)"
              className="w-full border border-slate-200 focus:border-amber-500 outline-none rounded-lg px-3 py-1.5 text-xs bg-white"
            />
            <div className="grid grid-cols-12 gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={l.qte}
                onChange={e => updateLigne(i, { qte: Number(e.target.value) || 0 })}
                className="col-span-3 border-2 border-slate-200 focus:border-amber-500 outline-none rounded-lg px-2 py-2 text-sm text-center bg-white"
                aria-label="Quantité"
              />
              <select
                value={l.unite || 'forfait'}
                onChange={e => updateLigne(i, { unite: e.target.value })}
                className="col-span-4 border-2 border-slate-200 focus:border-amber-500 outline-none rounded-lg px-2 py-2 text-sm bg-white"
              >
                {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={l.pu_ht}
                onChange={e => updateLigne(i, { pu_ht: Number(e.target.value) || 0 })}
                placeholder="Prix HT"
                className="col-span-5 border-2 border-slate-200 focus:border-amber-500 outline-none rounded-lg px-2 py-2 text-sm text-right tabular-nums bg-white"
                aria-label="Prix unitaire HT"
              />
            </div>
            <div className="text-right text-sm font-bold tabular-nums text-slate-700">
              {(Number(l.qte) * Number(l.pu_ht)).toFixed(2)} € HT
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-2">
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">TVA</label>
        <div className="flex gap-2">
          {([0, 10, 20] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTva(t)}
              className={`flex-1 py-2 rounded-lg font-bold text-sm ${tvaTaux === t ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {t}%
            </button>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Total HT</span>
          <span className="font-bold tabular-nums">{totalHT.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">TVA ({tvaTaux}%)</span>
          <span className="font-bold tabular-nums">{totalTVA.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between border-t border-amber-300 pt-2 mt-1">
          <span className="font-black">Total TTC</span>
          <span className="font-black tabular-nums">{totalTTC.toFixed(2)} €</span>
        </div>
      </div>

      <DevisEnvoiPanel
        devis={{ ...devis, tva_taux: tvaTaux, lignes: lignes.filter(l => l.designation.trim()) }}
        clientEmail={email}
        onClientEmailChange={setEmail}
        clientNom={clientNom || '—'}
        clientAdresse={adresse}
        clientCP={cp}
        clientVille={ville}
        dateDevis={dateDevis}
        totalHT={totalHT}
        totalTTC={totalTTC}
        tvaTaux={tvaTaux}
        interventionId={interv.id}
        onSent={() => onContinue()}
      />

      <button
        type="button"
        onClick={() => onContinue()}
        className="w-full text-center text-sm text-slate-500 hover:text-slate-700 underline"
      >
        Passer sans envoyer le devis →
      </button>
    </section>
  )
}

// ============================================================
// ÉTAPE 6 — Diffusion (mail, site, GMB, YouTube) — actions indépendantes
// ============================================================
type DiffusionAction = 'mail' | 'site' | 'gmb' | 'youtube' | null

function TerrainDiffusionPanel({ interv, client, onRefresh, onError }: {
  interv: Intervention
  client: Client
  onRefresh: () => void | Promise<void>
  onError: (e: string) => void
}) {
  const [email, setEmail] = useState(client?.email || '')
  const [nom, setNom] = useState(client?.nom || '')
  const [busy, setBusy] = useState<DiffusionAction>(null)
  const [progress, setProgress] = useState('')
  const [gmbOk, setGmbOk] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState(interv.video_youtube_url || '')
  const mailRef = useRef(false)

  useEffect(() => {
    setEmail(client?.email || '')
    setNom(client?.nom || '')
  }, [client?.email, client?.nom])

  useEffect(() => {
    setYoutubeUrl(interv.video_youtube_url || '')
  }, [interv.video_youtube_url])

  const mailDone = !!interv.mail_envoye_at
  const siteDone = !!interv.publie_slug
  const hasPhotos = !!(interv.photos_urls && interv.photos_urls.length > 0)

  async function linkClientBestEffort() {
    if (!nom.trim()) return
    try {
      await fetch(`/api/interventions/${interv.id}/link-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nom.trim(), email: email.trim() }),
      })
    } catch { /* best-effort */ }
  }

  async function handleSendMail() {
    if (mailRef.current || busy) return
    mailRef.current = true
    setBusy('mail')
    setProgress('⚙ Vérifications…')
    onError('')

    try {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Email client invalide')
      }
      const clientNom = nom.trim()
      if (!clientNom) {
        throw new Error('Saisis le nom du client avant d\'envoyer.')
      }

      // ── 1. Refresh complet depuis le serveur (évite tout state stale) ──
      const intFresh = await fetchJsonWithRetry<{ intervention: Intervention; client: Client; technicien: { nom?: string } | null }>(
        `/api/interventions/${interv.id}`,
        { cache: 'no-store', retries: 3, timeoutMs: 20_000 },
      )
      const freshInterv = intFresh.intervention
      const freshClient = intFresh.client
      const technicienNom = intFresh.technicien?.nom || 'Technicien'

      if (!freshInterv.rapport_json || Object.keys(freshInterv.rapport_json).length === 0) {
        throw new Error('Rapport non sauvegardé. Reviens à l\'étape rapport.')
      }

      setProgress('👤 Mise à jour de la fiche client…')
      const linkData = await fetchJsonWithRetry<{ client: Client }>(
        `/api/interventions/${interv.id}/link-client`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom: clientNom, email: email.trim() }),
          retries: 3,
          timeoutMs: 15_000,
        },
      )
      const effectiveClient = linkData.client || freshClient

      // ── 2. Charge la dernière facture (payload complet pour le PDF) ──
      const factData = await fetchJsonWithRetry<{ facture: { id: string; numero?: string; payload: any; pdf_url?: string | null } | null }>(
        `/api/interventions/${interv.id}/facture`,
        { cache: 'no-store', retries: 3, timeoutMs: 20_000 },
      )
      if (!factData.facture || !factData.facture.payload) {
        throw new Error('Facture introuvable — reviens à l\'étape facture pour la créer.')
      }
      const facturePayload = factData.facture.payload

      setProgress('📄 Génération du PDF rapport…')
      const [{ RealisationDocument }, { pdfElementToBlob }, React] = await Promise.all([
        import('@/components/RealisationPDF'),
        import('@/lib/pdfToBase64'),
        import('react'),
      ])
      const pdfRapportBlob = await pdfElementToBlob(
        React.createElement(RealisationDocument, {
          clientNom,
          adresse: freshInterv.adresse_chantier || '',
          ville: freshInterv.ville || '',
          codePostal: freshInterv.code_postal || '',
          dateIntervention: freshInterv.date_realisee || freshInterv.date_prevue || '',
          typeIntervention: freshInterv.type_intervention || '',
          technicienNom,
          rapport: freshInterv.rapport_json,
          reference: freshInterv.reference || undefined,
          photos: (freshInterv.photos_urls || []).map((url, i) => ({
            url: proxyImageUrl(url),
            legende: freshInterv.photos_legendes?.[i] || `Photo ${i + 1}`,
          })),
        }),
      )
      if (!pdfRapportBlob || pdfRapportBlob.size < 1000) {
        throw new Error('PDF rapport vide — relance la génération.')
      }

      setProgress('☁ Upload du rapport…')
      const fdRapport = new FormData()
      fdRapport.append('kind', 'rapport')
      fdRapport.append('pdf', pdfRapportBlob, `rapport-${interv.id}.pdf`)
      await fetchJsonWithRetry(`/api/interventions/${interv.id}/store-pdf`, {
        method: 'POST',
        body: fdRapport,
        retries: 3,
        timeoutMs: 60_000,
      })

      setProgress('🧾 Génération du PDF facture…')
      const [{ FactureDocument }, { aprimeFactureEmetteur }] = await Promise.all([
        import('@/components/FacturePDF'),
        import('@/lib/emetteur'),
      ])
      // Adresse PDF : priorité à l'adresse de facturation du client (freshClient.adresse,
      // mise à jour via le PATCH ci-dessus si l'utilisateur l'a complétée). Fallback sur
      // l'adresse chantier — utile quand le client n'a pas d'adresse facturation distincte.
      const adresseLine1 = effectiveClient?.adresse || freshInterv.adresse_chantier || ''
      const adresseCP = effectiveClient?.code_postal || freshInterv.code_postal || ''
      const adresseVille = effectiveClient?.ville || freshInterv.ville || ''
      const clientAdresseLignes: string[] = []
      if (adresseLine1) clientAdresseLignes.push(adresseLine1)
      if (adresseCP || adresseVille) {
        clientAdresseLignes.push([adresseCP, adresseVille].filter(Boolean).join(' '))
      }
      const pdfFactureBlob = await pdfElementToBlob(
        React.createElement(FactureDocument, {
          emetteur: aprimeFactureEmetteur(freshInterv.agence || undefined),
          client: {
            nom: clientNom,
            adresseLignes: clientAdresseLignes.length > 0 ? clientAdresseLignes : ['—'],
          },
          facture: facturePayload,
        }),
      )
      if (!pdfFactureBlob || pdfFactureBlob.size < 1000) {
        throw new Error('PDF facture vide — relance la génération.')
      }

      setProgress('☁ Upload de la facture…')
      const fdFacture = new FormData()
      fdFacture.append('kind', 'facture')
      fdFacture.append('pdf', pdfFactureBlob, `facture-${interv.id}.pdf`)
      await fetchJsonWithRetry(`/api/interventions/${interv.id}/store-pdf`, {
        method: 'POST',
        body: fdFacture,
        retries: 3,
        timeoutMs: 60_000,
      })

      setProgress('✉ Envoi du mail au client…')
      await fetchJsonWithRetry('/api/notify-rapport-facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interventionId: interv.id,
          clientEmail: email,
        }),
        retries: 3,
        timeoutMs: 90_000,
      })

      try {
        await fetchWithRetry(`/api/interventions/${interv.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statut: 'terminee' }),
          retries: 2,
          timeoutMs: 15_000,
        })
      } catch { /* best-effort */ }

      setProgress('✓ Mail envoyé')
      await onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
      setProgress('')
      mailRef.current = false
    }
  }

  async function handlePublishSite() {
    if (busy) return
    setBusy('site')
    setProgress('🌐 Publication sur le site…')
    onError('')
    try {
      await linkClientBestEffort()
      const res = await fetch('/api/publish/from-intervention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId: interv.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setProgress('✓ Publié sur le site')
      await onRefresh()
    } catch (e) {
      onError(`Publication site : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function handlePublishGmb() {
    if (busy) return
    setBusy('gmb')
    setProgress('📍 Publication Google Business…')
    onError('')
    try {
      await linkClientBestEffort()
      const res = await fetch('/api/publish-gmb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId: interv.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setGmbOk(true)
      setProgress('✓ Post GMB publié')
    } catch (e) {
      onError(`Post GMB : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function handlePublishYoutube() {
    if (busy) return
    if (!hasPhotos) {
      onError('Ajoute des photos à l\'intervention avant de publier sur YouTube.')
      return
    }
    setBusy('youtube')
    onError('')
    try {
      let horizontal = interv.video_urls?.horizontal
      if (!horizontal) {
        setProgress('🎬 Génération vidéo 16:9 (~3 min)…')
        const genRes = await fetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interventionId: interv.id }),
        })
        const genData = await genRes.json().catch(() => ({}))
        if (!genRes.ok) throw new Error(genData.error || `Génération vidéo HTTP ${genRes.status}`)
        horizontal = genData.video_urls?.horizontal
        if (!horizontal) throw new Error('Vidéo 16:9 non produite.')
        await onRefresh()
      }
      setProgress('▶ Upload YouTube…')
      const res = await fetch('/api/publish-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId: interv.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setYoutubeUrl(data.url || '')
      setProgress('✓ Vidéo sur YouTube')
      await onRefresh()
    } catch (e) {
      onError(`YouTube : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const actionBtn = (done: boolean, color: string) =>
    `w-full disabled:opacity-50 text-white rounded-2xl py-4 font-black text-base shadow-lg transition ${done ? 'ring-2 ring-emerald-300 ' : ''}${color}`

  return (
    <section className="space-y-5">
      <header className="text-center">
        <div className="text-5xl mb-2">🚀</div>
        <h1 className="text-2xl font-black text-slate-800">Diffusion</h1>
        <p className="text-sm text-slate-600 mt-2">
          Déclenche chaque action à ton rythme — la page reste ouverte.
        </p>
      </header>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 space-y-3">
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Nom du client</label>
          <input
            type="text"
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Nom du client ou de la copropriété"
            className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base"
          />
          {!nom.trim() && (
            <p className="text-xs text-amber-600 font-semibold mt-1">⚠ Obligatoire — apparaît sur le rapport et la facture</p>
          )}
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Email client</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="client@exemple.fr"
            className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base"
          />
        </div>

        <div className="text-sm text-slate-700 space-y-1 pt-2">
          <div>📄 Rapport d&apos;intervention (PDF)</div>
          <div>🧾 Facture (PDF)</div>
          <div>⭐ Demande d&apos;avis Google</div>
          <div className="text-xs text-slate-500 pt-1">+ relances auto J+2, J+4, J+6 si pas d&apos;avis</div>
        </div>
      </div>

      {progress && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 text-sm font-semibold text-center">
          {progress}
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleSendMail}
          disabled={!!busy || !email || !nom.trim()}
          className={actionBtn(mailDone, 'bg-emerald-600 hover:bg-emerald-700')}
        >
          {busy === 'mail' ? (progress || '⚙ Envoi…') : mailDone ? '✓ Mail envoyé au client' : '✉ Envoyer par mail'}
        </button>

        <button
          type="button"
          onClick={handlePublishSite}
          disabled={!!busy}
          className={actionBtn(siteDone, 'bg-blue-600 hover:bg-blue-700')}
        >
          {busy === 'site' ? (progress || '⚙ Publication…') : siteDone ? '✓ Publié sur le site' : '🌐 Publier sur le site'}
        </button>

        <button
          type="button"
          onClick={handlePublishGmb}
          disabled={!!busy}
          className={actionBtn(gmbOk, 'bg-indigo-600 hover:bg-indigo-700')}
        >
          {busy === 'gmb' ? (progress || '⚙ GMB…') : gmbOk ? '✓ Post Google Business publié' : '📍 Post GMB'}
        </button>

        <button
          type="button"
          onClick={handlePublishYoutube}
          disabled={!!busy || !hasPhotos}
          className={actionBtn(!!youtubeUrl, 'bg-red-600 hover:bg-red-700')}
          title={!hasPhotos ? 'Photos requises pour la vidéo' : undefined}
        >
          {busy === 'youtube' ? (progress || '⚙ YouTube…') : youtubeUrl ? '✓ Post YouTube publié' : '▶ Post YouTube'}
        </button>
        {!hasPhotos && (
          <p className="text-xs text-amber-700 font-semibold text-center">YouTube : ajoute des photos (étapes 0 ou 2).</p>
        )}
        {youtubeUrl && (
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-sm font-semibold text-red-700 hover:underline">
            Voir sur YouTube →
          </a>
        )}
      </div>
    </section>
  )
}

// ============================================================
// ÉTAPE 7+ — Terminé
// ============================================================
function StepTermine({ interv, client, onRefresh, onError }: {
  interv: Intervention
  client: Client
  onRefresh: () => void | Promise<void>
  onError: (e: string) => void
}) {
  return (
    <section className="space-y-6">
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
        <div className="text-6xl mb-2">🎉</div>
        <h1 className="text-2xl font-black text-emerald-800">Intervention terminée</h1>
        <p className="text-sm text-emerald-700 mt-2">
          Tu peux encore déclencher mail, site, GMB ou YouTube ci-dessous.
        </p>
      </div>

      <TerrainDiffusionPanel interv={interv} client={client} onRefresh={onRefresh} onError={onError} />

      <div className="flex flex-col gap-3">
        <Link
          href={`/intervention/${interv.id}`}
          className="bg-[#0e2a52] hover:bg-[#0a2047] text-white rounded-2xl py-4 font-bold text-base shadow-lg transition text-center"
        >
          📋 Voir la fiche intervention
        </Link>
        <Link
          href="/planning"
          className="bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 rounded-2xl py-4 font-bold text-base transition text-center"
        >
          📅 Retour au planning
        </Link>
      </div>
    </section>
  )
}
