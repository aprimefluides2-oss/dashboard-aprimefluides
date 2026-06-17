'use client'
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import VoiceRecorder from "@/components/VoiceRecorder"
import VilleCombobox from "@/components/VilleCombobox"
import ClientAutocomplete from "@/components/ClientAutocomplete"
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning"
import type { AttestationData, AttestationObservation, Variante } from "@/components/AttestationPDF"

const AttestationDownloadButton = dynamic(() => import("@/components/AttestationPDF"), { ssr: false })
const SaveDocumentButton = dynamic(() => import("@/components/SaveDocumentButton"), { ssr: false })

type Step = 'capture' | 'generating' | 'preview'
type PhotoItem = { file: File; dataUrl: string; preview: string; legende: string }

const VARIANT_OPTIONS: { key: Variante; label: string; desc: string; color: string }[] = [
  {
    key: 'tout-a-legout',
    label: 'Tout-à-l\'égout',
    desc: 'Raccordement au réseau public d\'assainissement collectif',
    color: 'border-emerald-500 bg-emerald-50 text-emerald-900',
  },
  {
    key: 'fosse-septique',
    label: 'Fosse septique',
    desc: 'Raccordement à un dispositif d\'assainissement non collectif',
    color: 'border-amber-500 bg-amber-50 text-amber-900',
  },
  {
    key: 'non-conforme',
    label: 'Non-conforme',
    desc: 'Réseau non conforme — vice caché, anomalies structurelles',
    color: 'border-red-500 bg-red-50 text-red-900',
  },
]

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
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
        'image/jpeg', quality,
      )
    }
    img.onerror = () => reject(new Error('Lecture image impossible'))
    img.src = dataUrl
  })
}

export default function AttestationPage() {

  const [step, setStep] = useState<Step>('capture')
  const [error, setError] = useState('')

  const [variante, setVariante] = useState<Variante>('tout-a-legout')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [technicienNom, setTechnicienNom] = useState('')
  const [transcription, setTranscription] = useState('')
  const [photos, setPhotos] = useState<PhotoItem[]>([])

  const [data, setData] = useState<AttestationData | null>(null)

  const [clientEmail, setClientEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  useUnsavedChangesWarning(
    !emailSent && (
      nom.trim() !== '' ||
      transcription.trim() !== '' ||
      photos.length > 0 ||
      data !== null
    )
  )

  async function handleSendToClient() {
    if (!data) return
    if (!clientEmail) { setEmailError('Renseigne l\'email du client.'); return }
    const missing: string[] = []
    if (!data.nom?.trim()) missing.push('nom')
    if (!data.adresse?.trim()) missing.push('adresse')
    if (!data.ville?.trim()) missing.push('ville')
    if (missing.length) {
      setEmailError(`Champs client incomplets : ${missing.join(', ')}.`)
      return
    }
    setEmailSending(true); setEmailError(''); setEmailSent(false)
    try {
      const photosForPdf = photos.map(p => ({ url: p.dataUrl, legende: p.legende }))
      const [{ AttestationDocument }, { pdfDocumentToBase64 }, React] = await Promise.all([
        import('@/components/AttestationPDF'),
        import('@/lib/pdfToBase64'),
        import('react'),
      ])
      const pdfBase64 = await pdfDocumentToBase64(
        React.createElement(AttestationDocument, { data, photos: photosForPdf })
      )
      const filename = `${data.numero || 'attestation'}.pdf`.replace(/\s+/g, '-')
      const res = await fetch('/api/notify-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail,
          clientNom: `${data.prenom || ''} ${data.nom || ''}`.trim(),
          technicienNom: data.technicienNom,
          ville: data.ville,
          dateAttestation: data.date,
          numero: data.numero,
          variante: data.variante,
          pdfBase64,
          pdfFilename: filename,
          // Champs persistance DB
          attestation: data,
          clientAdresse: data.adresse,
          clientCP: data.codePostal,
        }),
      })
      const json = await res.json().catch(() => ({} as Record<string, any>))
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      if (json.warning) setEmailError(json.warning)
      else setEmailSent(true)
    } catch (e: any) {
      setEmailError(`Erreur envoi : ${e.message || e}`)
    } finally {
      setEmailSending(false)
    }
  }

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ltdb_technicien') : null
    if (saved) setTechnicienNom(saved)
  }, [])
  useEffect(() => {
    if (technicienNom && typeof window !== 'undefined') localStorage.setItem('ltdb_technicien', technicienNom)
  }, [technicienNom])

  async function addPhoto(file: File | null) {
    if (!file) return
    try {
      const compressed = await compressImage(file)
      const dataUrl = await fileToDataUrl(compressed)
      const preview = URL.createObjectURL(compressed)
      setPhotos(prev => [...prev, { file: compressed, dataUrl, preview, legende: `Photo ${prev.length + 1}` }])
    } catch (e: any) {
      setError(`Photo : ${e.message || 'erreur'}`)
    }
  }
  function removePhoto(i: number) { setPhotos(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleGenerate() {
    setError('')
    if (!nom || !prenom || !adresse || !ville) { setError('Renseigne nom, prénom, adresse, ville.'); return }
    if (!technicienNom) { setError('Indique ton nom de technicien.'); return }
    if (photos.length === 0) { setError('Au moins une photo d\'inspection est requise.'); return }
    if (transcription.trim().length < 20) { setError('Dicte au moins quelques phrases sur l\'inspection et tes constats.'); return }

    setStep('generating')
    try {
      const res = await fetch('/api/generate-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription,
          variante,
          nom, prenom, adresse,
          code_postal: codePostal, ville,
          date,
          technicien_nom: technicienNom,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Génération échouée')
      setData(result as AttestationData)
      setStep('preview')
    } catch (e: any) {
      setError(`Erreur IA : ${e.message}`)
      setStep('capture')
    }
  }

  function updateObservation(i: number, patch: Partial<AttestationObservation>) {
    if (!data) return
    const obs = [...data.observations]
    obs[i] = { ...obs[i], ...patch }
    setData({ ...data, observations: obs })
  }
  function removeObservation(i: number) {
    if (!data) return
    setData({ ...data, observations: data.observations.filter((_, idx) => idx !== i) })
  }
  function addObservation() {
    if (!data) return
    setData({ ...data, observations: [...data.observations, { label: '', valeur: '', statut: 'info' }] })
  }

  /* ===== STEP: GENERATING ===== */
  if (step === 'generating') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-[#0f2e5c] mb-4" />
          <h2 className="text-xl font-black text-[#0f2e5c]">Rédaction de l&apos;attestation…</h2>
          <p className="text-sm text-slate-500 mt-2">L&apos;IA structure objet, méthode, relevés et conclusion.</p>
        </div>
      </div>
    )
  }

  /* ===== STEP: PREVIEW ===== */
  if (step === 'preview' && data) {
    const photosForPdf = photos.map(p => ({ url: p.dataUrl, legende: p.legende }))
    const variantLabel = VARIANT_OPTIONS.find(v => v.key === data.variante)?.label || data.variante

    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b-2 border-[#0f2e5c] sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
            <Link href="/" className="text-sm text-slate-500 hover:text-[#0f2e5c]">← Accueil</Link>
            <div className="text-xs uppercase tracking-widest text-[#a78346] font-bold">Attestation officielle</div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#a78346] font-bold">Attestation</div>
              <h1 className="text-xl font-black text-[#0f2e5c]">{data.numero}</h1>
              <p className="text-sm text-slate-500">Variante : <span className="font-semibold text-[#0f2e5c]">{variantLabel}</span> · {data.date}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStep('capture')} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">← Modifier</button>
              <SaveDocumentButton
                endpoint="/api/save-attestation"
                className="bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-amber-600 disabled:opacity-50 transition"
                body={() => ({
                  attestation: data,
                  clientNom: `${data.prenom || ''} ${data.nom || ''}`.trim(),
                  clientEmail,
                  clientAdresse: data.adresse,
                  clientCP: data.codePostal,
                  ville: data.ville,
                  numero: data.numero,
                  variante: data.variante,
                  dateAttestation: data.date,
                })}
              />
              <AttestationDownloadButton data={data} photos={photosForPdf} />
            </div>
          </div>

          {/* Envoi au client */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-[#0f2e5c]">Envoyer l'attestation au client</h2>
            <p className="text-xs text-slate-500">Le PDF sera envoyé par email avec un mot d'accompagnement.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="email@client.com"
                className="flex-1 border-2 border-slate-200 focus:border-[#0f2e5c] outline-none rounded-lg px-3 py-2 text-sm"
                disabled={emailSending}
              />
              <button
                onClick={handleSendToClient}
                disabled={emailSending || !clientEmail}
                className="bg-[#0f2e5c] text-white font-semibold rounded-lg px-4 py-2 text-sm hover:bg-[#0a2047] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {emailSending ? 'Envoi…' : '✉ Envoyer le PDF'}
              </button>
            </div>
            {emailSent && <p className="text-sm text-emerald-700">✓ Attestation envoyée à <strong>{clientEmail}</strong></p>}
            {emailError && <p className="text-sm text-red-600">{emailError}</p>}
          </section>

          {/* Identité du bien */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-[#0f2e5c]">Propriétaire &amp; bien</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Prénom" value={data.prenom} onChange={v => setData({ ...data, prenom: v })} />
              <Field label="Nom" value={data.nom} onChange={v => setData({ ...data, nom: v })} />
              <Field label="Adresse" value={data.adresse} onChange={v => setData({ ...data, adresse: v })} />
              <Field label="Code postal" value={data.codePostal} onChange={v => setData({ ...data, codePostal: v })} />
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500">Ville</span>
                <div className="mt-1">
                  <VilleCombobox
                    value={data.ville}
                    onChange={v => setData({ ...data, ville: v })}
                    onSelect={v => setData({ ...data, ville: v.nom, codePostal: v.cp })}
                  />
                </div>
              </label>
              <Field label="Technicien" value={data.technicienNom} onChange={v => setData({ ...data, technicienNom: v })} />
            </div>
          </section>

          {/* Objet */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <h2 className="font-bold text-[#0f2e5c]">Objet de l&apos;intervention</h2>
            <textarea
              value={data.objet}
              onChange={e => setData({ ...data, objet: e.target.value })}
              rows={3}
              className="w-full border-2 border-slate-200 focus:border-[#0f2e5c] outline-none rounded-lg px-3 py-2 text-sm"
            />
          </section>

          {/* Méthode */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <h2 className="font-bold text-[#0f2e5c]">Méthodologie de l&apos;inspection</h2>
            <textarea
              value={data.methode}
              onChange={e => setData({ ...data, methode: e.target.value })}
              rows={4}
              className="w-full border-2 border-slate-200 focus:border-[#0f2e5c] outline-none rounded-lg px-3 py-2 text-sm"
            />
          </section>

          {/* Observations */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-[#0f2e5c]">Relevés techniques</h2>
              <button onClick={addObservation} className="text-sm font-semibold text-blue-700">+ Ligne</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2">Label</th>
                    <th className="py-2 pr-2">Valeur / constat</th>
                    <th className="py-2 pr-2 w-24">Statut</th>
                    <th className="py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.observations.map((o, i) => (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2">
                        <input value={o.label} onChange={e => updateObservation(i, { label: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1" />
                      </td>
                      <td className="py-1 pr-2">
                        <input value={o.valeur} onChange={e => updateObservation(i, { valeur: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1" />
                      </td>
                      <td className="py-1 pr-2">
                        <select value={o.statut} onChange={e => updateObservation(i, { statut: e.target.value as any })} className="w-full border border-slate-200 rounded px-2 py-1">
                          <option value="ok">✓ OK</option>
                          <option value="ko">✗ KO</option>
                          <option value="info">• Info</option>
                        </select>
                      </td>
                      <td className="py-1">
                        <button onClick={() => removeObservation(i)} className="text-red-500 hover:text-red-700 text-lg leading-none">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Variante B fosse */}
          {data.variante === 'fosse-septique' && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-[#0f2e5c]">Caractéristiques du dispositif (fosse)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Volume estimé" value={data.fosse?.volume_m3 || ''} onChange={v => setData({ ...data, fosse: { ...(data.fosse || {}), volume_m3: v } })} placeholder="ex: 3 m³" />
                <Field label="État général" value={data.fosse?.etat || ''} onChange={v => setData({ ...data, fosse: { ...(data.fosse || {}), etat: v } })} />
                <Field label="Accessibilité" value={data.fosse?.acces || ''} onChange={v => setData({ ...data, fosse: { ...(data.fosse || {}), acces: v } })} />
                <Field label="Dernière vidange" value={data.fosse?.derniere_vidange || ''} onChange={v => setData({ ...data, fosse: { ...(data.fosse || {}), derniere_vidange: v } })} />
              </div>
            </section>
          )}

          {/* Variante C anomalies / recommandations */}
          {data.variante === 'non-conforme' && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-[#0f2e5c]">Anomalies &amp; recommandations</h2>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Anomalies (une par ligne)</div>
                <textarea
                  value={(data.anomalies || []).join('\n')}
                  onChange={e => setData({ ...data, anomalies: e.target.value.split('\n').filter(Boolean) })}
                  rows={4}
                  className="w-full border-2 border-slate-200 focus:border-red-500 outline-none rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Recommandations (une par ligne)</div>
                <textarea
                  value={(data.recommandations || []).join('\n')}
                  onChange={e => setData({ ...data, recommandations: e.target.value.split('\n').filter(Boolean) })}
                  rows={3}
                  className="w-full border-2 border-slate-200 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </section>
          )}

          {/* Conclusion */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <h2 className="font-bold text-[#0f2e5c]">Conclusion technique</h2>
            <textarea
              value={data.conclusion}
              onChange={e => setData({ ...data, conclusion: e.target.value })}
              rows={4}
              className="w-full border-2 border-slate-200 focus:border-[#0f2e5c] outline-none rounded-lg px-3 py-2 text-sm"
            />
            <div className="text-xs uppercase tracking-wide text-slate-500 mt-2 mb-1">Réserves (facultatif)</div>
            <textarea
              value={data.reserves || ''}
              onChange={e => setData({ ...data, reserves: e.target.value })}
              rows={2}
              className="w-full border-2 border-slate-200 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm"
            />
          </section>

          <div className="flex justify-end pb-10">
            <AttestationDownloadButton data={data} photos={photosForPdf} />
          </div>
        </main>
      </div>
    )
  }

  /* ===== STEP: CAPTURE ===== */
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b-2 border-[#0f2e5c] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-sm text-slate-500 hover:text-[#0f2e5c]">← Accueil</Link>
          <div className="text-xs uppercase tracking-widest text-[#a78346] font-bold">Attestation officielle</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-[#a78346] font-bold mb-2">Document probatoire · Notaires &amp; ventes immobilières</div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0f2e5c]">Attestation de conformité de raccordement</h1>
          <div className="mx-auto mt-3 w-16 h-0.5 bg-[#a78346]" />
        </div>

        {/* Variante */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-bold text-[#0f2e5c]">Type d&apos;attestation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {VARIANT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setVariante(opt.key)}
                className={`text-left rounded-xl border-2 p-3 transition-all ${variante === opt.key ? `${opt.color} shadow-md` : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                <div className="font-black">{opt.label}</div>
                <div className="text-xs mt-1 opacity-80">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Propriétaire & bien */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-bold text-[#0f2e5c]">Propriétaire &amp; bien immobilier</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Prénom" value={prenom} onChange={setPrenom} placeholder="Jean" />
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500">Nom</span>
              <div className="mt-1">
                <ClientAutocomplete
                  value={nom}
                  onChange={setNom}
                  onSelect={c => {
                    setNom(c.nom)
                    if (c.adresse) setAdresse(c.adresse)
                    if (c.code_postal) setCodePostal(c.code_postal)
                    if (c.ville) setVille(c.ville)
                    if (c.email) setClientEmail(c.email)
                  }}
                  placeholder="Dupont / Mairie de…"
                />
              </div>
            </label>
            <Field label="Adresse du bien" value={adresse} onChange={setAdresse} placeholder="1 place du Château" />
            <Field label="Code postal" value={codePostal} onChange={setCodePostal} />
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500">Ville</span>
              <div className="mt-1">
                <VilleCombobox
                  value={ville}
                  onChange={setVille}
                  onSelect={v => { setVille(v.nom); setCodePostal(v.cp) }}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500">Date de l&apos;inspection</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 mt-1" />
            </label>
          </div>
        </section>

        {/* Technicien */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
          <h2 className="font-bold text-[#0f2e5c]">Technicien intervenant</h2>
          <Field label="Nom du technicien" value={technicienNom} onChange={setTechnicienNom} placeholder="Prénom Nom" />
        </section>

        {/* Dictée */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="font-bold text-[#0f2e5c]">Récit de l&apos;inspection</h2>
            <p className="text-sm text-slate-500 mt-1">
              Dicte ce que tu as inspecté, les moyens utilisés (caméra, ouverture de regard, etc.), les relevés et ta conclusion.
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <VoiceRecorder onTranscription={t => setTranscription(prev => prev ? prev + ' ' + t : t)} />
          </div>
          <textarea
            value={transcription}
            onChange={e => setTranscription(e.target.value)}
            rows={6}
            placeholder="Ex : Inspection caméra du réseau d'évacuation de la maison située 1 place du Château à Cuzieu. Ouverture du regard principal, passage caméra sur 12 mètres jusqu'au réseau public. Pente régulière, pas de contre-pente, pas de fosse intermédiaire. Diamètre 100 PVC. Débit confirmé par coloration."
            className="w-full border-2 border-slate-200 focus:border-[#0f2e5c] outline-none rounded-xl px-4 py-3 text-base"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>{transcription.length} car.</span>
            <span>{transcription.length < 50 ? 'Détaille davantage' : '✓ OK'}</span>
          </div>
        </section>

        {/* Photos */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#0f2e5c]">Photos d&apos;inspection <span className="text-red-600">*</span></h2>
              <p className="text-xs text-slate-500 mt-1">Regard ouvert, raccordement, réseau, coloration — au moins 1 photo requise.</p>
            </div>
            <span className="bg-[#0f2e5c] text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center">{photos.length}</span>
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((p, i) => (
                <div key={p.preview} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt={p.legende} className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                  <input
                    value={p.legende}
                    onChange={e => setPhotos(prev => prev.map((x, idx) => idx === i ? { ...x, legende: e.target.value } : x))}
                    className="w-full text-[11px] border border-slate-200 rounded mt-1 px-1.5 py-0.5"
                  />
                  <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-white rounded-full w-6 h-6 text-red-600 font-bold shadow">×</button>
                </div>
              ))}
            </div>
          )}
          <label className="block">
            <input type="file" accept="image/*" capture="environment" multiple onChange={e => { const files = e.target.files; if (files) { Array.from(files).forEach(f => addPhoto(f)); (e.target as HTMLInputElement).value = '' } }} className="hidden" id="att-photo-input" />
            <label htmlFor="att-photo-input" className="block w-full text-center border-2 border-dashed border-slate-300 text-slate-500 hover:border-[#0f2e5c] hover:text-[#0f2e5c] rounded-xl py-4 cursor-pointer transition-colors">
              + Ajouter des photos
            </label>
          </label>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <button
          onClick={handleGenerate}
          disabled={transcription.trim().length < 20}
          className="w-full bg-[#0f2e5c] hover:bg-[#0a2047] disabled:bg-slate-300 text-white font-bold py-4 rounded-xl transition-colors"
        >
          Générer l&apos;attestation →
        </button>
      </main>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-slate-200 rounded px-2 py-1.5 mt-1" />
    </label>
  )
}
