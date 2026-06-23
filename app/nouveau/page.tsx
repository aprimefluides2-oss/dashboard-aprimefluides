'use client'
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import VoiceRecorder from "@/components/VoiceRecorder"
import GenerationPreview from "@/components/GenerationPreview"
import AppTabs from "@/components/AppTabs"
import RapportTabs from "@/components/RapportTabs"
import dynamic from "next/dynamic"
import { AGENCES } from "@/lib/agences"
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning"
import { REALISATION_PAGE_STYLE } from "@/lib/realisationPageCss"

const PDFDownloadButton = dynamic(() => import("@/components/RealisationPDF"), { ssr: false })
const PDFPreviewModal = dynamic(() => import("@/components/PDFPreviewModal"), { ssr: false })
const DriveSaveButton = dynamic(() => import("@/components/DriveSaveButton"), { ssr: false })
const SaveDocumentButton = dynamic(() => import("@/components/SaveDocumentButton"), { ssr: false })
import SitePreviewModal from "@/components/SitePreviewModal"
import CatLoader from "@/components/CatLoader"

function notifyDone(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try { new Notification(title, { body, icon: '/icon-192.png', tag: 'ltdb-rapport' }) } catch {}
}

async function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission() } catch {}
  }
}

type Step = 'capture' | 'extracting' | 'validate' | 'generating' | 'preview' | 'publishing' | 'done'

const DRAFT_KEY = 'ltdb_draft'
const DRAFT_VERSION = 1
type Draft = {
  v: number
  savedAt: number
  transcription: string
  typeIntervention: string
  adresse: string
  ville: string
  codePostal: string
  dateIntervention: string
  clientNom: string
  clientEmail: string
  technicienNom: string
  interventionId: string | null
}

function formatDraftAge(ts: number) {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  return new Date(ts).toLocaleDateString('fr-FR')
}

const TYPES = [
  { v: 'Débouchage canalisation', icon: '🔧' },
  { v: 'Débouchage WC', icon: '🚽' },
  { v: 'Débouchage évier', icon: '🍽' },
  { v: 'Débouchage douche', icon: '🚿' },
  { v: 'Hydrocurage', icon: '💦' },
  { v: 'Inspection caméra', icon: '📹' },
  { v: 'Vidange fosse septique', icon: '🛢' },
  { v: 'Curage canalisation', icon: '⚙' },
]

const STEPPER_STEPS = [
  { key: 'capture', label: 'Dictée & Photos', icon: '🎤' },
  { key: 'validate', label: 'Vérification', icon: '✅' },
  { key: 'preview', label: 'Rapport', icon: '📄' },
  { key: 'done', label: 'Terminé', icon: '🎉' },
]

function getStepperIndex(step: Step): number {
  if (step === 'capture' || step === 'extracting') return 0
  if (step === 'validate' || step === 'generating') return 1
  if (step === 'preview' || step === 'publishing') return 2
  if (step === 'done') return 3
  return 0
}

export default function NouveauPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('capture')
  const [error, setError] = useState('')

  // Champs
  const [transcription, setTranscription] = useState('')
  const [typeIntervention, setTypeIntervention] = useState('Débouchage canalisation')
  const [adresse, setAdresse] = useState('')
  const [ville, setVille] = useState('')
  const [agence, setAgence] = useState<string>(AGENCES[0])
  const [codePostal, setCodePostal] = useState('')
  const [dateIntervention, setDateIntervention] = useState(new Date().toISOString().split('T')[0])
  const [clientNom, setClientNom] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [technicienNom, setTechnicienNom] = useState('')
  const [editTech, setEditTech] = useState(false)
  const [interventionId, setInterventionId] = useState<string | null>(null)
  type PhotoItem = { file: File; dataUrl: string; preview: string; legende: string }
  const [photos, setPhotos] = useState<PhotoItem[]>([])

  // Pré-remplissage depuis Planning (sessionStorage 'ltdb_intervention_prefill')
  // ou chargement direct d'un rapport existant pour édition (sessionStorage 'ltdb_load_rapport_id').
  useEffect(() => {
    if (typeof window === 'undefined') return
    const loadId = sessionStorage.getItem('ltdb_load_rapport_id')
    if (loadId) {
      sessionStorage.removeItem('ltdb_load_rapport_id')
      sessionStorage.removeItem('ltdb_intervention_prefill')
      // loadRapportForEdit n'est pas encore défini à ce stade du fichier, on l'appelle
      // via setTimeout pour être sûr qu'il est dans la portée au moment de l'exécution.
      setTimeout(() => { loadRapportForEdit(loadId) }, 0)
      return
    }
    const raw = sessionStorage.getItem('ltdb_intervention_prefill')
    if (!raw) return
    try {
      const p = JSON.parse(raw) as {
        intervention_id?: string
        clientNom?: string
        clientEmail?: string
        adresse?: string
        ville?: string
        codePostal?: string
        dateIntervention?: string
        typeIntervention?: string
        technicienNom?: string
      }
      if (p.intervention_id) setInterventionId(p.intervention_id)
      if (p.clientNom) setClientNom(p.clientNom)
      if (p.clientEmail) setClientEmail(p.clientEmail)
      if (p.adresse) setAdresse(p.adresse)
      if (p.ville) setVille(p.ville)
      if (p.codePostal) setCodePostal(p.codePostal)
      if (p.dateIntervention) setDateIntervention(p.dateIntervention)
      if (p.typeIntervention) setTypeIntervention(p.typeIntervention)
      if (p.technicienNom) setTechnicienNom(p.technicienNom)
    } catch {
      /* ignore */
    } finally {
      sessionStorage.removeItem('ltdb_intervention_prefill')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Résultats IA
  const [rapport, setRapport] = useState<any>(null)
  const [seo, setSeo] = useState<any>(null)
  const [publishedSlug, setPublishedSlug] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [showSitePreview, setShowSitePreview] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Historique des rapports (modal en haut à droite)
  type HistoryRapport = {
    id: string
    reference: string | null
    type_intervention: string | null
    ville: string | null
    code_postal: string | null
    date_realisee: string | null
    date_prevue: string | null
    client_nom: string | null
    publie_slug: string | null
    has_rapport: boolean
  }
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyItems, setHistoryItems] = useState<HistoryRapport[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [savingInPlace, setSavingInPlace] = useState(false)

  // Bannière de restauration de brouillon
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null)

  // Persist nom technicien
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ltdb_technicien') : null
    if (saved) setTechnicienNom(saved)
    else setEditTech(true)
  }, [])
  useEffect(() => {
    if (technicienNom && typeof window !== 'undefined') localStorage.setItem('ltdb_technicien', technicienNom)
  }, [technicienNom])

  // Restauration du brouillon au mount (sauf si un prefill /planning est présent)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('ltdb_intervention_prefill')) return
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    try {
      const d = JSON.parse(raw) as Draft
      if (d.v !== DRAFT_VERSION) {
        localStorage.removeItem(DRAFT_KEY)
        return
      }
      if (d.transcription) setTranscription(d.transcription)
      if (d.typeIntervention) setTypeIntervention(d.typeIntervention)
      if (d.adresse) setAdresse(d.adresse)
      if (d.ville) setVille(d.ville)
      if (d.codePostal) setCodePostal(d.codePostal)
      if (d.dateIntervention) setDateIntervention(d.dateIntervention)
      if (d.clientNom) setClientNom(d.clientNom)
      if (d.clientEmail) setClientEmail(d.clientEmail)
      if (d.technicienNom) setTechnicienNom(d.technicienNom)
      if (d.interventionId) setInterventionId(d.interventionId)
      setDraftRestoredAt(d.savedAt)
    } catch {
      localStorage.removeItem(DRAFT_KEY)
    }
  }, [])

  // Auto-save du brouillon pendant la phase de saisie (capture / extracting / validate)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (step !== 'capture' && step !== 'extracting' && step !== 'validate') return
    const hasContent =
      transcription.trim() !== '' ||
      clientNom.trim() !== '' ||
      adresse.trim() !== '' ||
      ville.trim() !== ''
    if (!hasContent) return
    const draft: Draft = {
      v: DRAFT_VERSION,
      savedAt: Date.now(),
      transcription,
      typeIntervention,
      adresse,
      ville,
      codePostal,
      dateIntervention,
      clientNom,
      clientEmail,
      technicienNom,
      interventionId,
    }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* quota dépassé : on ignore silencieusement */
    }
  }, [step, transcription, typeIntervention, adresse, ville, codePostal, dateIntervention, clientNom, clientEmail, technicienNom, interventionId])

  useUnsavedChangesWarning(
    step !== 'done' && (transcription.trim() !== '' || photos.length > 0 || rapport !== null)
  )

  function discardDraft() {
    if (typeof window !== 'undefined') localStorage.removeItem(DRAFT_KEY)
    setDraftRestoredAt(null)
    setTranscription('')
    setAdresse(''); setVille(''); setCodePostal('')
    setClientNom(''); setClientEmail('')
    setInterventionId(null)
    setPhotos([])
  }

  // Animation progressive écran IA
  const GEN_STEPS = [
    '🎙️ Analyse de la dictée…',
    '📝 Structuration du rapport…',
    '⚙️ Identification des phases…',
    '📊 Génération du tableau d\'analyse…',
    '🏷️ Optimisation SEO local…',
    '🔗 Maillage interne…',
    '❓ Rédaction FAQ…',
    '📦 Assemblage JSON-LD…',
    '✨ Finalisation…',
  ]
  const [genStepIdx, setGenStepIdx] = useState(0)
  useEffect(() => {
    if (step !== 'generating') return
    setGenStepIdx(0)
    const interval = setInterval(() => setGenStepIdx(i => (i + 1) % GEN_STEPS.length), 3500)
    return () => clearInterval(interval)
  }, [step])

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function compressImage(file: File, maxDim = 1920, quality = 0.82): Promise<File> {
    if (!file.type.startsWith('image/')) return file
    const dataUrl = await fileToDataUrl(file)
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim }
          else { width = Math.round(width * maxDim / height); height = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas non supporté'))
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          blob => {
            if (!blob) return reject(new Error('Compression échouée'))
            const compressed = new File([blob], file.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg'), { type: 'image/jpeg' })
            resolve(compressed)
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('Lecture image impossible'))
      img.src = dataUrl
    })
  }

  function defaultLegende(index: number) {
    if (index === 0) return 'Photo avant intervention'
    if (index === 1) return 'Photo après intervention'
    return `Photo ${index + 1}`
  }

  async function addPhoto(file: File | null) {
    if (!file) return
    try {
      const compressed = await compressImage(file)
      const dataUrl = await fileToDataUrl(compressed)
      const preview = URL.createObjectURL(compressed)
      setPhotos(prev => [...prev, { file: compressed, dataUrl, preview, legende: defaultLegende(prev.length) }])
    } catch (e: any) {
      setError(`Erreur photo : ${e.message || 'compression impossible'}`)
    }
  }

  function updatePhotoLegende(i: number, legende: string) {
    setPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, legende } : p))
  }

  function removePhoto(i: number) {
    setPhotos(prev => prev.filter((_, idx) => idx !== i))
  }

  function movePhoto(i: number, dir: -1 | 1) {
    setPhotos(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function handleExtract() {
    setError('')
    if (!technicienNom) { setError('Indique ton nom de technicien.'); return }
    if (!transcription || transcription.trim().length < 20) { setError('Dicte ou tape au moins quelques phrases sur l\'intervention.'); return }
    setStep('extracting')
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction échouée')
      if (data.type_intervention) setTypeIntervention(data.type_intervention)
      if (data.ville) setVille(data.ville)
      if (data.code_postal) setCodePostal(data.code_postal)
      if (data.adresse) setAdresse(data.adresse)
      if (data.client_nom) setClientNom(data.client_nom)
      if (data.client_email) setClientEmail(data.client_email)
      if (data.warning) setError(`⚠ ${data.warning}`)
      setStep('validate')
    } catch (e: any) {
      setError(`Erreur extraction : ${e.message}`)
      setStep('capture')
    }
  }

  async function handleGenerate() {
    if (!transcription || !typeIntervention || !ville) {
      setError('Renseignez la dictée, le type et la ville.')
      return
    }
    setError(''); setStep('generating')
    ensureNotificationPermission()
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription, type_intervention: typeIntervention, ville, code_postal: codePostal }),
        signal: AbortSignal.timeout(180_000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Génération échouée')
      setRapport(data.rapport); setSeo(data.seo)
      setStep('preview')
      notifyDone('Rapport prêt', `${typeIntervention} — ${ville}`)
    } catch (e: any) {
      const isTimeout = e?.name === 'TimeoutError' || /aborted|timeout/i.test(String(e?.message || ''))
      setError(isTimeout
        ? 'La génération a dépassé 3 minutes. Réessaie ou raccourcis la dictée.'
        : `Erreur IA : ${e.message}`)
      setStep('validate')
    }
  }

  async function handleSendToClient() {
    if (!clientEmail) { setError('Email client manquant.'); return }
    if (!rapport) { setError('Rapport indisponible.'); return }
    setEmailSending(true); setError('')
    try {
      const photosForPdf = photos.map(p => ({ url: p.dataUrl, legende: p.legende }))
      const tech = technicienNom || 'Technicien'
      const [{ RealisationDocument }, { pdfDocumentToBase64 }, React] = await Promise.all([
        import('@/components/RealisationPDF'),
        import('@/lib/pdfToBase64'),
        import('react'),
      ])
      const pdfBase64 = await pdfDocumentToBase64(
        React.createElement(RealisationDocument, {
          clientNom, adresse, ville, codePostal, dateIntervention, typeIntervention,
          technicienNom: tech,
          rapport,
          photos: photosForPdf,
        })
      )
      const pdfFilename = `rapport-${(ville || 'intervention').toLowerCase()}-${dateIntervention}.pdf`.replace(/\s+/g, '-')
      const res = await fetch('/api/notify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail, clientNom, technicienNom: tech, ville, dateIntervention,
          pdfBase64, pdfFilename,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setEmailSent(true)
    } catch (e: any) {
      setError(`Erreur envoi : ${e.message}`)
    } finally {
      setEmailSending(false)
    }
  }

  function handleCreateFacture() {
    const today = new Date()
    const seq = String(today.getHours()).padStart(2, '0') + String(today.getMinutes()).padStart(2, '0')
    const numeroFA = `FA-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${seq}`
    const objet = ville
      ? `${typeIntervention} — ${ville}`
      : typeIntervention
    const observations = (rapport && typeof rapport.synthese === 'string')
      ? rapport.synthese
      : ''
    const payload = {
      client_nom: clientNom,
      client_adresse: adresse,
      client_cp: codePostal,
      client_ville: ville,
      adresse_chantier: 'idem',
      reference_dossier: interventionId ? `Intervention ${interventionId}` : '',
      client_email: clientEmail,
      facture: {
        numero: numeroFA,
        date_facture: dateIntervention || today.toISOString().split('T')[0],
        echeance: 'Réglée',
        objet,
        reference_dossier: interventionId ? `Intervention ${interventionId}` : '',
        lignes: [
          {
            designation: typeIntervention,
            description: '',
            qte: 1,
            unite: 'forfait',
            pu_ht: 0,
            inclus: false,
          },
        ],
        tva_taux: 10,
        mode_reglement: '',
        observations,
        recommandation: '',
      },
    }
    sessionStorage.setItem('ltdb_devis_to_facture', JSON.stringify(payload))
    router.push('/facture/nouvelle')
  }

  async function handlePublish() {
    setStep('publishing'); setError('')
    if (photos.length === 0) {
      setError('Au moins une photo est requise.'); setStep('preview'); return
    }
    const totalBytes = photos.reduce((sum, p) => sum + p.file.size, 0)
    if (totalBytes > 4 * 1024 * 1024) {
      setError(`Photos trop lourdes (${(totalBytes / 1024 / 1024).toFixed(1)} MB). Retire les plus grandes.`)
      setStep('preview'); return
    }
    const formData = new FormData()
    const escapeHtml = (s: string) => s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    const galleryHtml = photos.length > 1
      ? `<section class="content-block gallery-block"><h2>Photos de l'intervention</h2><p>Ces photos documentent les étapes clés sur site (avant, pendant, après).</p><div class="photo-grid">${photos.map((p, i) => `<figure class="photo-card"><img src="{PHOTO_${i + 1}_URL}" alt="${escapeHtml(p.legende || `Photo ${i + 1}`)}" loading="lazy"><figcaption>${escapeHtml(p.legende || `Photo ${i + 1}`)}</figcaption></figure>`).join('')}</div></section>`
      : ''
    // FAQ intégrée DIRECTEMENT dans le HTML de contenu : le template Django
    // n'affiche que `content`, donc la FAQ doit y être (sinon elle n'apparaît
    // pas sur la page publiée, même si elle part aussi dans faq_json/seo_json).
    const faqHtml = Array.isArray(seo.faq) && seo.faq.length > 0
      ? `<section class="content-block faq-block"><h2>Questions fréquentes</h2>${seo.faq.map((f: any) => `<details class="faq-item"><summary>${escapeHtml(f?.question || '')}</summary><div class="faq-answer"><p>${escapeHtml(f?.reponse || '')}</p></div></details>`).join('')}</section>`
      : ''
    const resumeHtml = seo.resume_rich_snippet
      ? `<section class="content-block resume-block"><h2>Résumé de l'intervention</h2><p>${escapeHtml(seo.resume_rich_snippet)}</p></section>`
      : ''
    // CSS embed désactivé : Django renvoie HTTP 500 quand le content commence
    // par un <style>. Cf. fix temporaire dans /api/publish/from-intervention.
    void REALISATION_PAGE_STYLE
    const contentWithContainers = `${resumeHtml}${seo.contenu_principal || ''}${galleryHtml}${faqHtml}`
    // Tronque title/description pour respecter les CharField Django
    // (title max_length=100 côté backend ; description max ~200). DeepSeek
    // dépasse parfois → 500 silencieux.
    const truncate = (s: string, max: number) => s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…'
    formData.append('title', truncate(seo.titre_h1 || '', 95))
    formData.append('slug', seo.slug || '')
    formData.append('service_type', typeIntervention)
    formData.append('location', ville)
    formData.append('intervention_city', ville)
    formData.append('postal_code', codePostal)
    formData.append('agence', agence)
    formData.append('intervention_date', dateIntervention)
    formData.append('description', truncate(seo.meta_description || '', 195))
    formData.append('meta_keywords', (seo.meta_keywords || []).join(', '))
    formData.append('content', contentWithContainers)
    formData.append('faq_json', JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": (Array.isArray(seo?.faq) ? seo.faq : []).map((f: any) => ({ "@type": "Question", "name": f?.question || '', "acceptedAnswer": { "@type": "Answer", "text": f?.reponse || '' } })) }))
    formData.append('jsonld', JSON.stringify(seo.jsonld || {}))
    formData.append('related_services_json', JSON.stringify(seo.related_services || []))
    formData.append('is_published', 'true')
    formData.append('transcription', transcription || '')
    formData.append('rapport_json', JSON.stringify(rapport || {}))
    formData.append('seo_json', JSON.stringify(seo || {}))
    formData.append('client_nom', clientNom || '')
    formData.append('client_email', clientEmail || '')
    formData.append('client_adresse', `${adresse || ''} ${codePostal || ''} ${ville || ''}`.trim())
    if (interventionId) formData.append('intervention_id', interventionId)
    // Django LTDB exige technicien_name NOT NULL (sinon IntegrityError 500).
    formData.append('technicien_name', technicienNom || '')
    formData.append('before_image', photos[0].file)
    formData.append('after_image', (photos[1] || photos[0]).file)
    photos.slice(2).forEach((p, i) => formData.append(`extra_image_${i}`, p.file))
    try {
      const res = await fetch('/api/publish', { method: 'POST', body: formData })
      const txt = await res.text()
      let data: any = null
      try { data = JSON.parse(txt) } catch {}
      if (!res.ok) {
        const msg = data ? (typeof data === 'string' ? data : (data.error || JSON.stringify(data))) : txt.slice(0, 300)
        throw new Error(msg)
      }
      const slug = data?.slug || seo?.slug || ''
      setPublishedSlug(slug)
      setTranscription('')
      setRapport(null); setSeo(null)
      setClientNom(''); setClientEmail(''); setAdresse(''); setVille(''); setCodePostal('')
      setPhotos([])
      setEmailSent(false)
      setInterventionId(null)
      if (typeof window !== 'undefined') localStorage.removeItem(DRAFT_KEY)
      setDraftRestoredAt(null)
      setStep('done')
    } catch (e: any) {
      setError(`Erreur publication : ${e.message}`)
      setStep('preview')
    }
  }

  // ── Historique : ouverture, recherche, chargement d'un rapport pour édition ──
  async function openHistoryModal() {
    setShowHistoryModal(true)
    if (historyLoaded) return
    setHistoryLoading(true); setHistoryError('')
    try {
      const res = await fetch('/api/historique?limit=500', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const withRapport = (data.interventions || []).filter((i: any) => i.has_rapport) as HistoryRapport[]
      setHistoryItems(withRapport)
      setHistoryLoaded(true)
    } catch (e: any) {
      setHistoryError(e.message || 'Erreur de chargement')
    } finally {
      setHistoryLoading(false)
    }
  }

  async function loadRapportForEdit(id: string) {
    setLoadingEditId(id); setHistoryError(''); setError('')
    try {
      const res = await fetch(`/api/interventions/${id}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const i = data.intervention
      const c = data.client

      setInterventionId(id)
      setRapport(i.rapport_json || null)
      setSeo(i.seo_json || null)
      setTranscription(i.transcription || '')
      setTypeIntervention(i.type_intervention || 'Débouchage canalisation')
      setVille(i.ville || '')
      if (i.agence) setAgence(i.agence)
      setCodePostal(i.code_postal || '')
      setAdresse(i.adresse_chantier || '')
      setDateIntervention(i.date_realisee || i.date_prevue || new Date().toISOString().split('T')[0])
      setClientNom(c?.nom || '')
      setClientEmail(c?.email || '')
      setPhotos([])
      setEmailSent(false)
      setPublishedSlug(i.publie_slug || '')

      // Si rapport existant → preview directe ; sinon repart en validation
      setStep(i.rapport_json && Object.keys(i.rapport_json || {}).length > 0 ? 'preview' : 'validate')
      setShowHistoryModal(false)
    } catch (e: any) {
      setHistoryError(`Chargement impossible : ${e.message}`)
    } finally {
      setLoadingEditId(null)
    }
  }

  /** Régénère le rapport à partir de la transcription/ville/type courants, puis revient au preview. */
  async function handleRegenerate() {
    if (!transcription || !typeIntervention || !ville) {
      setError('Renseignez la dictée, le type et la ville.')
      return
    }
    if (!confirm('Régénérer le rapport remplacera le contenu actuel. Continuer ?')) return
    setError(''); setRegenerating(true); setStep('generating')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription, type_intervention: typeIntervention, ville, code_postal: codePostal }),
        signal: AbortSignal.timeout(180_000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Régénération échouée')
      setRapport(data.rapport); setSeo(data.seo)
      setStep('preview')
    } catch (e: any) {
      const isTimeout = e?.name === 'TimeoutError' || /aborted|timeout/i.test(String(e?.message || ''))
      setError(isTimeout
        ? 'La régénération a dépassé 3 minutes. Réessaie ou raccourcis la dictée.'
        : `Erreur IA : ${e.message}`)
      setStep('preview')
    } finally {
      setRegenerating(false)
    }
  }

  /** Enregistre le rapport courant à la place de l'intervention chargée (update). */
  async function handleSaveInPlace() {
    if (!rapport || !interventionId) return
    setError(''); setSavingInPlace(true); setSavedFlash(false)
    try {
      const res = await fetch('/api/save-rapport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interventionId,
          clientNom, clientEmail,
          clientAdresse: adresse,
          ville, codePostal,
          typeIntervention,
          dateIntervention,
          transcription,
          rapport, seo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setSavedFlash(true)
      // Remet à jour la liste historique en arrière-plan
      setHistoryLoaded(false)
      setTimeout(() => setSavedFlash(false), 2500)
    } catch (e: any) {
      setError(`Erreur enregistrement : ${e.message}`)
    } finally {
      setSavingInPlace(false)
    }
  }

  function resetForm() {
    setStep('capture')
    setTranscription(''); setRapport(null); setSeo(null); setError('')
    setClientNom(''); setClientEmail(''); setAdresse(''); setVille(''); setCodePostal('')
    setPhotos([])
    setEmailSent(false); setPublishedSlug('')
    setInterventionId(null)
    setDraftRestoredAt(null)
    if (typeof window !== 'undefined') localStorage.removeItem(DRAFT_KEY)
  }

  const totalMb = photos.reduce((s, p) => s + p.file.size, 0) / 1024 / 1024
  const currentStepperIdx = getStepperIndex(step)

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* App tabs (rapport vs devis) */}
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-3xl mx-auto px-4">
          <AppTabs />
        </div>
      </div>
      {/* Header */}
      <nav className="bg-[#0e2a52] text-white px-4 py-3 sm:px-6 sm:py-4 shadow-lg sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex justify-between items-center gap-3">
          <div>
            <div className="font-black text-base sm:text-lg leading-tight">Aprime fluides</div>
            <div className="text-[11px] opacity-70">Nouvelle réalisation</div>
          </div>
          <div className="text-right flex items-center gap-2">
            <button
              type="button"
              onClick={openHistoryModal}
              className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/20 transition active:scale-95"
              aria-label="Ouvrir l'historique des rapports"
              title="Historique des rapports"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              <span className="hidden sm:inline">Historique</span>
            </button>
            {editTech ? (
              <input
                autoFocus
                value={technicienNom}
                onChange={e => setTechnicienNom(e.target.value)}
                onBlur={() => technicienNom && setEditTech(false)}
                onKeyDown={e => { if (e.key === 'Enter' && technicienNom) setEditTech(false) }}
                placeholder="Ton nom"
                className="bg-white/20 placeholder:text-white/60 text-white text-sm font-semibold px-3 py-1.5 rounded-lg outline-none border border-white/30 focus:border-white"
              />
            ) : technicienNom ? (
              <button onClick={() => setEditTech(true)} className="text-right group">
                <div className="text-[10px] opacity-60 group-hover:opacity-100">Technicien ✎</div>
                <div className="text-sm font-semibold">{technicienNom}</div>
              </button>
            ) : null}
          </div>
        </div>
      </nav>

      <RapportTabs current="rediger" />

      {/* STEPPER */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-[52px] sm:top-[60px] z-20">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {STEPPER_STEPS.map((s, i) => {
              const isActive = i === currentStepperIdx
              const isDone = i < currentStepperIdx
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all ${
                      isDone ? 'bg-emerald-500 text-white shadow-md' :
                      isActive ? 'bg-[#0e2a52] text-white shadow-lg ring-4 ring-blue-100' :
                      'bg-slate-100 text-slate-400 border-2 border-slate-200'
                    }`}>
                      {isDone ? '✓' : s.icon}
                    </div>
                    <span className={`text-[10px] sm:text-xs mt-1 font-semibold text-center leading-tight ${
                      isActive ? 'text-[#0e2a52]' : isDone ? 'text-emerald-600' : 'text-slate-400'
                    }`}>{s.label}</span>
                  </div>
                  {i < STEPPER_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 sm:mx-3 rounded-full transition-all ${
                      i < currentStepperIdx ? 'bg-emerald-400' : 'bg-slate-200'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* ═══════════ ÉTAPE 1 — DICTÉE + PHOTOS ═══════════ */}
        {(step === 'capture' || step === 'extracting') && (
          <>
            {draftRestoredAt && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-amber-900">
                  📝 Brouillon restauré <span className="opacity-70">({formatDraftAge(draftRestoredAt)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Effacer le brouillon et démarrer à neuf ?')) discardDraft()
                  }}
                  className="text-amber-700 hover:text-amber-900 font-bold text-xs underline"
                >
                  Démarrer à neuf
                </button>
              </div>
            )}

            {/* Dictée */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-xl font-black text-[#0e2a52]">Raconte l&apos;intervention</h2>
                <p className="text-sm text-slate-500 mt-1">Dicte ou tape : l&apos;IA remplira les champs.</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <VoiceRecorder onTranscription={t => setTranscription(prev => prev ? prev + ' ' + t : t)} />
              </div>

              <textarea
                value={transcription}
                onChange={e => setTranscription(e.target.value)}
                rows={5}
                placeholder="Ex : Débouchage WC chez Mme Dupont à Argenteuil, 5 rue des Tombades. Colonne EU bouchée au 2e étage, furet électrique 15m…"
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>{transcription.length} car.</span>
                <span>{transcription.length < 50 ? 'Ajoute plus de détails' : '✓ OK'}</span>
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-[#0e2a52]">Photos</h2>
                  <p className="text-sm text-slate-500">Optionnelles — requises pour publier sur le site</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#0e2a52] text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center">{photos.length}</span>
                  {photos.length > 0 && <span className="text-[11px] text-slate-400">{totalMb.toFixed(1)} MB</span>}
                </div>
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((p, i) => (
                    <PhotoItemCard
                      key={p.preview}
                      index={i}
                      photo={p}
                      isFirst={i === 0}
                      isLast={i === photos.length - 1}
                      onLegendeChange={lg => updatePhotoLegende(i, lg)}
                      onRemove={() => removePhoto(i)}
                      onMoveUp={() => movePhoto(i, -1)}
                      onMoveDown={() => movePhoto(i, 1)}
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label htmlFor="add-cam" className="bg-[#0e2a52] text-white px-4 py-3.5 rounded-xl text-sm font-bold cursor-pointer active:scale-95 transition text-center">
                  📸 Prendre photo
                  <input id="add-cam" type="file" accept="image/*" capture="environment" onChange={e => { addPhoto(e.target.files?.[0] || null); (e.target as HTMLInputElement).value = '' }} className="hidden" />
                </label>
                <label htmlFor="add-gal" className="bg-white border-2 border-[#0e2a52] text-[#0e2a52] px-4 py-3.5 rounded-xl text-sm font-bold cursor-pointer active:scale-95 transition text-center">
                  🖼 Galerie
                  <input id="add-gal" type="file" accept="image/*" multiple onChange={async e => {
                    const files = Array.from(e.target.files || [])
                    for (const f of files) await addPhoto(f)
                    ;(e.target as HTMLInputElement).value = ''
                  }} className="hidden" />
                </label>
              </div>
            </div>

            {/* Loading extraction */}
            {step === 'extracting' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center space-y-3">
                <div className="text-4xl animate-pulse">✨</div>
                <p className="text-sm font-semibold text-blue-900">Lecture de ta dictée…</p>
                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden max-w-xs mx-auto">
                  <div className="h-full bg-blue-500 animate-pulse rounded-full" style={{ width: '65%' }} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════ ÉTAPE 2 — VÉRIFICATION ═══════════ */}
        {(step === 'validate' || step === 'generating') && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-xl font-black text-[#0e2a52]">Vérifie les informations</h2>
                <p className="text-sm text-slate-500 mt-1">Pré-rempli par l&apos;IA. Corrige si besoin.</p>
              </div>

              {/* Type intervention */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type d&apos;intervention</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map(t => (
                    <button key={t.v} type="button"
                      onClick={() => setTypeIntervention(t.v)}
                      className={`p-3 rounded-xl border-2 text-left text-sm font-semibold transition-all ${
                        typeIntervention === t.v
                          ? 'border-blue-500 bg-blue-50 text-[#0e2a52] shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}>
                      <span className="text-lg mr-1">{t.icon}</span>
                      {t.v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Département / Agence */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Département / Agence</label>
                <div className="flex flex-wrap gap-2">
                  {AGENCES.map(a => (
                    <button key={a} type="button"
                      onClick={() => setAgence(a)}
                      className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                        agence === a
                          ? 'border-blue-500 bg-blue-50 text-[#0e2a52] shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}>
                      {a.replace(/^Agence /, '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ville (saisie libre après choix du département) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ville *</label>
                <input
                  value={ville}
                  onChange={e => setVille(e.target.value)}
                  placeholder="Ex : Argenteuil, Paris 15e, Cergy…"
                  autoComplete="off"
                  className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors"
                />
              </div>

              {/* CP + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Code postal</label>
                  <input value={codePostal} onChange={e => setCodePostal(e.target.value)} placeholder="95100" inputMode="numeric" pattern="[0-9]*" className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                  <input type="date" value={dateIntervention} onChange={e => setDateIntervention(e.target.value)} className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors" />
                </div>
              </div>

              {/* Adresse */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Adresse <span className="font-normal text-slate-400 normal-case">(optionnel)</span></label>
                <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="ex: 5 rue des Tombades" className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors" />
              </div>
            </div>

            {/* Client */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Client (optionnel)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Nom</label>
                  <input value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="M. Dupont" className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Email</label>
                  <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@exemple.fr" inputMode="email" autoCapitalize="none" autoCorrect="off" className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors" />
                </div>
              </div>
            </div>

            {/* Loading génération */}
            {step === 'generating' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center space-y-3">
                <p className="text-sm font-bold text-blue-900">{GEN_STEPS[genStepIdx]}</p>
                <CatLoader />
                <p className="text-[11px] text-slate-500">
                  Compte 30 à 90 secondes — tu peux laisser la page ouverte, on te notifie quand c'est prêt.
                </p>
              </div>
            )}
          </>
        )}

        {/* ═══════════ ÉTAPE 3 — RAPPORT PRÊT ═══════════ */}
        {(step === 'preview' || step === 'publishing') && rapport && seo && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#0e2a52]">Rapport prêt</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {interventionId ? 'Mode édition — modifie, régénère ou enregistre à la place.' : 'Vérifie, exporte ou publie.'}
                </p>
              </div>
              {interventionId && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                  Édition
                </span>
              )}
            </div>

            {interventionId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating || !transcription}
                  className="bg-violet-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-violet-700 disabled:opacity-50 active:scale-95 transition-all text-sm"
                >
                  {regenerating ? 'Régénération…' : '🔄 Régénérer le rapport'}
                </button>
                <button
                  onClick={handleSaveInPlace}
                  disabled={savingInPlace}
                  className={`px-4 py-3 rounded-xl font-bold active:scale-95 transition-all text-sm text-white ${
                    savedFlash ? 'bg-emerald-500' : 'bg-[#0e2a52] hover:bg-[#1a3a6b] disabled:opacity-50'
                  }`}
                >
                  {savingInPlace ? 'Enregistrement…' : savedFlash ? '✓ Enregistré' : '💾 Enregistrer à la place'}
                </button>
              </div>
            )}

            <GenerationPreview rapport={rapport} seo={seo} onRapportChange={setRapport} onSeoChange={setSeo} />

            {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

            {(() => {
              const pdfProps = {
                clientNom, adresse, ville, codePostal, dateIntervention, typeIntervention,
                technicienNom: technicienNom || 'Technicien',
                rapport,
                photos: photos.map(p => ({ url: p.dataUrl, legende: p.legende })),
              }
              const pdfFilename = `rapport-${(ville || 'intervention').toLowerCase()}-${dateIntervention}.pdf`
              return (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  {/* Aperçus */}
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setShowPdfPreview(true)} className="bg-slate-50 text-[#0e2a52] px-4 py-3 rounded-xl font-bold hover:bg-slate-100 active:scale-95 transition-all border-2 border-slate-200">
                      👁 Aperçu PDF
                    </button>
                    <button onClick={() => setShowSitePreview(true)} className="bg-slate-50 text-[#0e2a52] px-4 py-3 rounded-xl font-bold hover:bg-slate-100 active:scale-95 transition-all border-2 border-slate-200">
                      🌐 Aperçu page
                    </button>
                  </div>

                  {/* Export */}
                  <div className="grid grid-cols-2 gap-3">
                    <PDFDownloadButton {...pdfProps} />
                    <DriveSaveButton pdfProps={pdfProps} filename={pdfFilename} />
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={handleSendToClient}
                      disabled={emailSending || emailSent || !clientEmail}
                      className="bg-blue-600 text-white px-4 py-3.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {emailSent ? '✓ Email envoyé' : emailSending ? 'Envoi…' : '✉ Envoyer au client'}
                    </button>
                    <button
                      onClick={handlePublish}
                      disabled={step === 'publishing'}
                      className="bg-emerald-600 text-white px-4 py-3.5 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {step === 'publishing' ? 'Publication…' : '🌐 Publier sur le site'}
                    </button>
                  </div>

                  <SaveDocumentButton
                    endpoint="/api/save-rapport"
                    body={() => ({
                      interventionId,
                      clientNom,
                      clientEmail,
                      clientAdresse: adresse,
                      ville,
                      codePostal,
                      typeIntervention,
                      dateIntervention,
                      transcription,
                      rapport,
                      seo,
                      technicienNom: technicienNom || '',
                    })}
                  />

                  <button
                    onClick={handleCreateFacture}
                    className="w-full bg-amber-500 text-white px-4 py-3.5 rounded-xl font-bold hover:bg-amber-600 active:scale-95 transition-all"
                  >
                    🧾 Créer la facture →
                  </button>

                  <PDFPreviewModal open={showPdfPreview} onClose={() => setShowPdfPreview(false)} pdfProps={pdfProps} />
                  <SitePreviewModal open={showSitePreview} onClose={() => setShowSitePreview(false)} seo={seo} ville={ville} photos={photos.map(p => ({ dataUrl: p.dataUrl, legende: p.legende }))} />
                </div>
              )
            })()}
          </div>
        )}

        {/* ═══════════ ÉTAPE 4 — TERMINÉ ═══════════ */}
        {step === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-3xl">🎉</div>
            <h2 className="text-2xl font-black text-emerald-700">Réalisation publiée !</h2>
            <p className="text-slate-600">La page est en ligne sur le site.</p>
            <a
              href={`https://www.aprime-fluides.fr/nos-realisations/${publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-[#0e2a52] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#1a3a6b] transition-colors"
            >
              Voir la page publiée →
            </a>
            <div className="pt-4">
              <button onClick={resetForm} className="text-blue-600 hover:underline font-bold">+ Nouvelle réalisation</button>
            </div>
          </div>
        )}
      </main>

      {/* ═══════════ BARRE D'ACTION BOTTOM ═══════════ */}
      {(['capture', 'validate'] as Step[]).includes(step) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-3 z-30">
          <div className="max-w-3xl mx-auto">
            {error && <div className="text-red-600 text-sm font-semibold mb-2 text-center">{error}</div>}
            <div className="flex gap-3">
              {step === 'capture' ? (
                <button onClick={() => {}} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all">
                  Annuler
                </button>
              ) : (
                <button onClick={() => setStep('capture')} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all">
                  ← Retour
                </button>
              )}
              <button
                onClick={step === 'capture' ? handleExtract : handleGenerate}
                className="flex-[2] bg-[#0e2a52] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all disabled:opacity-60"
              >
                {step === 'capture' ? 'Suivant →' : '🚀 Générer le rapport'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(['preview', 'publishing'] as Step[]).includes(step) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-3 z-30">
          <div className="max-w-3xl mx-auto">
            <button onClick={() => setStep('validate')} className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all">
              ← Modifier les informations
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL HISTORIQUE DES RAPPORTS ═══════════ */}
      {showHistoryModal && (
        <RapportHistoryModal
          items={historyItems}
          loading={historyLoading}
          error={historyError}
          search={historySearch}
          onSearchChange={setHistorySearch}
          loadingEditId={loadingEditId}
          onClose={() => setShowHistoryModal(false)}
          onEdit={loadRapportForEdit}
          onRefresh={() => { setHistoryLoaded(false); openHistoryModal() }}
        />
      )}
    </div>
  )
}

function RapportHistoryModal({
  items, loading, error, search, onSearchChange,
  loadingEditId, onClose, onEdit, onRefresh,
}: {
  items: {
    id: string
    reference: string | null
    type_intervention: string | null
    ville: string | null
    code_postal: string | null
    date_realisee: string | null
    date_prevue: string | null
    client_nom: string | null
    publie_slug: string | null
  }[]
  loading: boolean
  error: string
  search: string
  onSearchChange: (s: string) => void
  loadingEditId: string | null
  onClose: () => void
  onEdit: (id: string) => void
  onRefresh: () => void
}) {
  const filtered = items.filter(i => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [i.client_nom, i.ville, i.type_intervention, i.reference]
      .filter(Boolean).join(' ').toLowerCase().includes(q)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-black text-[#0e2a52]">Historique des rapports</h3>
            <p className="text-xs text-slate-500 mt-0.5">Sélectionne un rapport pour le modifier ou le régénérer.</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 text-xl font-bold active:scale-95 transition">×</button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex gap-2">
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Rechercher : client, ville, type, référence…"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-400 transition-colors"
            autoFocus
          />
          <button
            onClick={onRefresh}
            disabled={loading}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-3 py-2.5 rounded-xl transition disabled:opacity-50"
            title="Rafraîchir"
          >
            ↻
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="text-center text-slate-400 text-sm py-12">Chargement…</div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-12">
              {items.length === 0 ? 'Aucun rapport enregistré.' : 'Aucun rapport ne correspond à la recherche.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map(i => {
                const date = i.date_realisee || i.date_prevue
                const dateLabel = date ? (date.match(/^(\d{4})-(\d{2})-(\d{2})/) ? `${RegExp.$3}/${RegExp.$2}/${RegExp.$1}` : date) : '—'
                const isLoadingThis = loadingEditId === i.id
                return (
                  <li key={i.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3 transition flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900 truncate">{i.client_nom || '—'}</span>
                        {i.publie_slug && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                            publié
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                        <span>{dateLabel}</span>
                        {i.type_intervention && <span>· {i.type_intervention}</span>}
                        {i.ville && <span>· {i.ville}{i.code_postal ? ` (${i.code_postal})` : ''}</span>}
                        {i.reference && <span className="font-mono text-[10px] text-slate-400">· {i.reference}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => onEdit(i.id)}
                      disabled={isLoadingThis || !!loadingEditId}
                      className="bg-[#0e2a52] hover:bg-[#1a3a6b] text-white text-xs font-bold px-3 py-2 rounded-lg active:scale-95 transition disabled:opacity-50 flex-shrink-0"
                    >
                      {isLoadingThis ? '…' : 'Modifier'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

type PhotoItemCardProps = {
  index: number
  photo: { preview: string; legende: string }
  isFirst: boolean
  isLast: boolean
  onLegendeChange: (s: string) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function PhotoItemCard({ index, photo, isFirst, isLast, onLegendeChange, onRemove, onMoveUp, onMoveDown }: PhotoItemCardProps) {
  return (
    <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.preview} alt={photo.legende} className="w-full h-36 object-cover" />
        <div className="absolute top-2 left-2 bg-[#0e2a52] text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow">
          {index + 1}
        </div>
        <button onClick={onRemove} type="button" aria-label="Supprimer"
          className="absolute top-2 right-2 bg-white/95 w-7 h-7 rounded-full text-red-600 font-bold shadow flex items-center justify-center text-sm">✕</button>
        <div className="absolute bottom-2 right-2 flex gap-1">
          {!isFirst && (
            <button onClick={onMoveUp} type="button" aria-label="Monter"
              className="bg-white/95 w-7 h-7 rounded-full text-[#0e2a52] font-bold shadow flex items-center justify-center text-sm">↑</button>
          )}
          {!isLast && (
            <button onClick={onMoveDown} type="button" aria-label="Descendre"
              className="bg-white/95 w-7 h-7 rounded-full text-[#0e2a52] font-bold shadow flex items-center justify-center text-sm">↓</button>
          )}
        </div>
      </div>
      <div className="p-2.5">
        <input
          value={photo.legende}
          onChange={e => onLegendeChange(e.target.value)}
          placeholder={`Photo ${index + 1}`}
          className="w-full border border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm transition-colors"
        />
      </div>
    </div>
  )
}
