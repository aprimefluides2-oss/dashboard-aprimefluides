'use client'
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import VoiceRecorder from "@/components/VoiceRecorder"
import AppTabs from "@/components/AppTabs"
import VilleCombobox from "@/components/VilleCombobox"
import PrestationsCombobox from "@/components/PrestationsCombobox"
import ClientAutocomplete from "@/components/ClientAutocomplete"
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning"
import { AGENCES, type Agence } from "@/lib/agences"
import { APRIME_EMETTEUR, aprimeFactureEmetteur } from "@/lib/emetteur"
import { fmtDateISOtoFR } from "@/lib/format"
import type {
  FacturePDFProps,
  FactureLineData,
  FactureData,
} from "@/components/FacturePDF"
import type { ClientData } from "@/components/DevisPDF"

const FactureDownloadButton = dynamic(() => import("@/components/FacturePDF"), { ssr: false })
const SaveDocumentButton = dynamic(() => import("@/components/SaveDocumentButton"), { ssr: false })

type Step = 'capture' | 'extracting' | 'generating' | 'preview'

const ECHEANCES_PRESETS = [
  'Réglée',
  'À réception',
  '15 jours fin de mois',
  '30 jours fin de mois',
  '45 jours fin de mois',
  '60 jours fin de mois',
] as const

export default function FacturePage() {
  const [step, setStep] = useState<Step>('capture')
  const [error, setError] = useState('')

  // Capture
  const [transcription, setTranscription] = useState('')
  const [clientNom, setClientNom] = useState('')
  const [clientAdresse, setClientAdresse] = useState('')
  const [clientCP, setClientCP] = useState('')
  const [clientVille, setClientVille] = useState('')
  const [adresseChantier, setAdresseChantier] = useState('idem')
  const [dateFacture, setDateFacture] = useState(new Date().toISOString().split('T')[0])
  const [referenceDossier, setReferenceDossier] = useState('')
  const [agence, setAgence] = useState<Agence>(AGENCES[0])

  // Résultat IA (éditable)
  const [facture, setFacture] = useState<FactureData | null>(null)

  // Envoi email
  const [clientEmail, setClientEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailInfo, setEmailInfo] = useState('')

  useUnsavedChangesWarning(
    (step === 'capture' && (transcription.trim() !== '' || clientNom.trim() !== '')) ||
    (step === 'preview' && facture !== null && !emailSent)
  )

  // Pré-remplissage depuis un devis transformé
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = sessionStorage.getItem('ltdb_devis_to_facture')
    if (!raw) return
    try {
      const payload = JSON.parse(raw)
      sessionStorage.removeItem('ltdb_devis_to_facture')
      if (payload.client_nom) setClientNom(payload.client_nom)
      if (payload.client_adresse) setClientAdresse(payload.client_adresse)
      if (payload.client_cp) setClientCP(payload.client_cp)
      if (payload.client_ville) setClientVille(payload.client_ville)
      if (payload.adresse_chantier) setAdresseChantier(payload.adresse_chantier)
      if (payload.reference_dossier) setReferenceDossier(payload.reference_dossier)
      if (payload.client_email) setClientEmail(payload.client_email)

      if (payload.facture) {
        setFacture(payload.facture)
        setStep('preview')
      }
    } catch {
      // ignore
    }
  }, [])

  async function handleSendToClient() {
    if (!facture) return
    if (!clientEmail) { setEmailError("Renseigne l'email du client."); return }
    const missing: string[] = []
    if (!clientNom.trim()) missing.push('nom')
    if (!clientAdresse.trim()) missing.push('adresse')
    if (!clientVille.trim()) missing.push('ville')
    if (missing.length) {
      setEmailError(`Champs client incomplets : ${missing.join(', ')}. Complète-les avant l'envoi.`)
      return
    }
    setEmailSending(true); setEmailError(''); setEmailInfo(''); setEmailSent(false)
    try {
      const totalHT = facture.lignes.reduce((sum, l) => {
        if (l.inclus) return sum
        return sum + (Number(l.pu_ht) || 0) * (Number(l.qte) || 0)
      }, 0)
      const totalTTC = totalHT * (1 + ((facture.tva_taux ?? 10) / 100))
      const technicienNom = typeof window !== 'undefined' ? (localStorage.getItem('ltdb_technicien') || '') : ''
      const client: ClientData = {
        nom: clientNom || '—',
        adresseLignes: [
          clientAdresse || '',
          [clientCP, clientVille].filter(Boolean).join(' '),
        ].filter(Boolean),
        adresseChantier: adresseChantier || undefined,
      }
      const emetteur = aprimeFactureEmetteur(agence)
      const [{ FactureDocument }, { pdfDocumentToBase64 }, React] = await Promise.all([
        import('@/components/FacturePDF'),
        import('@/lib/pdfToBase64'),
        import('react'),
      ])
      const pdfBase64 = await pdfDocumentToBase64(
        React.createElement(FactureDocument, {
          emetteur,
          client,
          facture,
          phone: emetteur.telephone,
        })
      )
      const filename = `facture-${facture.numero || 'sans-numero'}.pdf`.replace(/\s+/g, '-')
      const res = await fetch('/api/notify-facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail,
          clientNom,
          technicienNom,
          ville: clientVille,
          dateFacture: fmtDateISOtoFR(facture.date_facture),
          numero: facture.numero,
          totalTTC,
          echeance: facture.echeance,
          agence,
          pdfBase64,
          pdfFilename: filename,
          // Champs persistance DB
          facture,
          totalHT,
          tvaTaux: facture.tva_taux ?? 10,
          clientAdresse,
          clientCP,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (data.warning) setEmailError(data.warning)
      else {
        setEmailSent(true)
        if (data.relances_planifiees) {
          setEmailInfo(
            `${data.relances_planifiees} relance(s) hebdomadaire(s) planifiée(s) (ton cordial → ferme) tant que la facture n'est pas marquée réglée.`,
          )
        }
      }
    } catch (e: any) {
      setEmailError(`Erreur envoi : ${e.message || e}`)
    } finally {
      setEmailSending(false)
    }
  }

  async function handleExtractClient() {
    if (!transcription || transcription.trim().length < 10) return
    setStep('extracting'); setError('')
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription }),
      })
      const data = await res.json()
      if (data.client_nom && !clientNom) setClientNom(data.client_nom)
      if (data.adresse && !clientAdresse) setClientAdresse(data.adresse)
      if (data.ville && !clientVille) setClientVille(data.ville)
      if (data.code_postal && !clientCP) setClientCP(data.code_postal)
      setStep('capture')
    } catch {
      setStep('capture')
    }
  }

  async function handleGenerate() {
    if (!transcription || transcription.trim().length < 20) {
      setError("Dicte au moins quelques phrases sur l'intervention, les prestations, les prix et le mode de règlement.")
      return
    }
    setError(''); setStep('generating')
    try {
      const res = await fetch('/api/generate-facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription,
          client_nom: clientNom,
          client_adresse: clientAdresse,
          client_ville: clientVille,
          client_code_postal: clientCP,
          date_facture: dateFacture,
          reference_dossier: referenceDossier,
          agence,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Génération échouée')

      if (!clientNom && data.facture?.client_nom_detecte) setClientNom(data.facture.client_nom_detecte)
      if (!clientAdresse && data.facture?.client_adresse_detectee) setClientAdresse(data.facture.client_adresse_detectee)

      setFacture(data.facture)
      setStep('preview')
    } catch (e: any) {
      setError(`Erreur IA : ${e.message}`)
      setStep('capture')
    }
  }

  function updateLine(index: number, patch: Partial<FactureLineData>) {
    if (!facture) return
    const lignes = [...facture.lignes]
    lignes[index] = { ...lignes[index], ...patch }
    setFacture({ ...facture, lignes })
  }

  function removeLine(index: number) {
    if (!facture) return
    setFacture({ ...facture, lignes: facture.lignes.filter((_, i) => i !== index) })
  }

  function addLine() {
    if (!facture) return
    setFacture({
      ...facture,
      lignes: [
        ...facture.lignes,
        { designation: '', description: '', qte: 1, unite: 'forfait', pu_ht: 0, inclus: false },
      ],
    })
  }

  function handleCreateBlank() {
    const today = new Date()
    const seq = String(today.getHours()).padStart(2, '0') + String(today.getMinutes()).padStart(2, '0')
    const numero = `FA-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${seq}`
    const blank: FactureData = {
      numero,
      date_facture: dateFacture,
      echeance: 'À réception',
      objet: '',
      reference_dossier: referenceDossier || undefined,
      lignes: [
        { designation: '', description: '', qte: 1, unite: 'forfait', pu_ht: 0, inclus: false },
      ],
      tva_taux: 10,
      mode_reglement: '',
      observations: '',
      recommandation: '',
    }
    setError('')
    setFacture(blank)
    setStep('preview')
  }

  const totalHT = facture?.lignes.reduce((s, l) => {
    if (l.inclus) return s
    return s + (Number(l.pu_ht) || 0) * (Number(l.qte) || 0)
  }, 0) || 0
  const tvaTaux = facture?.tva_taux ?? 10
  const tva = totalHT * tvaTaux / 100
  const ttc = totalHT + tva

  /* =================== RENDER =================== */
  if (step === 'generating') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-[#0e2a52] mb-4" />
          <h2 className="text-xl font-black text-[#0e2a52]">Analyse de la dictée…</h2>
          <p className="text-sm text-slate-500 mt-2">L&apos;IA structure la facture (objet, lignes, observations, mode de règlement).</p>
        </div>
      </div>
    )
  }

  if (step === 'preview' && facture) {
    const client: ClientData = {
      nom: clientNom || '—',
      adresseLignes: [
        clientAdresse || '',
        [clientCP, clientVille].filter(Boolean).join(' '),
      ].filter(Boolean),
      adresseChantier: adresseChantier || undefined,
    }
    const missingClient: string[] = []
    if (!clientNom.trim()) missingClient.push('nom')
    if (!clientAdresse.trim()) missingClient.push('adresse')
    if (!clientVille.trim()) missingClient.push('ville')
    const emetteur = aprimeFactureEmetteur(agence)
    const pdfProps: FacturePDFProps = {
      emetteur,
      client,
      facture,
      phone: emetteur.telephone,
    }

    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <AppTabs />
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Header preview */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-[#0e2a52]">Facture N° {facture.numero}</h1>
              <p className="text-sm text-slate-500">
                Établie le {fmtDateISOtoFR(facture.date_facture)} · Échéance : <strong className={/^r[ée]gl[ée]e?$/i.test(facture.echeance) ? 'text-emerald-700' : ''}>{facture.echeance}</strong> · {agence}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('capture')}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
              >
                ← Modifier la dictée
              </button>
              <SaveDocumentButton
                endpoint="/api/save-facture"
                className="bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-amber-600 disabled:opacity-50 transition"
                body={() => ({
                  facture,
                  clientNom,
                  clientEmail,
                  clientAdresse,
                  clientCP,
                  ville: clientVille,
                  agence,
                  numero: facture.numero,
                  totalHT,
                  totalTTC: ttc,
                  tvaTaux,
                  echeance: facture.echeance,
                })}
              />
              <FactureDownloadButton {...pdfProps} />
            </div>
          </div>

          {missingClient.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-4 py-3 text-sm">
              ⚠ Champs client manquants : <strong>{missingClient.join(', ')}</strong> — la facture risque de s&apos;afficher avec « — ». Complète le bloc <em>Client &amp; chantier</em> ci-dessous avant d&apos;exporter ou d&apos;envoyer.
            </div>
          )}

          {/* Envoi au client */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-[#0e2a52]">Envoyer la facture au client</h2>
            <p className="text-xs text-slate-500">Le PDF sera joint à un email récapitulant le montant et l&apos;échéance.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="email@client.com"
                className="flex-1 border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-lg px-3 py-2 text-sm"
                disabled={emailSending}
              />
              <button
                onClick={handleSendToClient}
                disabled={emailSending || !clientEmail}
                className="bg-[#0e2a52] text-white font-semibold rounded-lg px-4 py-2 text-sm hover:bg-[#0a2047] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {emailSending ? 'Envoi…' : '✉ Envoyer le PDF'}
              </button>
            </div>
            {emailSent && <p className="text-sm text-emerald-700">✓ Facture envoyée à <strong>{clientEmail}</strong></p>}
            {emailInfo && <p className="text-sm text-blue-700">{emailInfo}</p>}
            {emailError && <p className="text-sm text-red-600">{emailError}</p>}
          </section>

          {/* Émetteur (agence) */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-[#0e2a52]">Émetteur — agence rattachée</h2>
            <select
              value={agence}
              onChange={e => setAgence(e.target.value as Agence)}
              className="w-full border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-lg px-3 py-2 text-sm"
            >
              {AGENCES.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </section>

          {/* Échéance */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-[#0e2a52]">Échéance &amp; numéro</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Numéro de facture" value={facture.numero} onChange={v => setFacture({ ...facture, numero: v })} />
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500">Échéance</span>
                <select
                  value={ECHEANCES_PRESETS.includes(facture.echeance as any) ? facture.echeance : '__custom__'}
                  onChange={e => {
                    if (e.target.value === '__custom__') return
                    setFacture({ ...facture, echeance: e.target.value })
                  }}
                  className="w-full border border-slate-200 rounded px-2 py-1.5 mt-1"
                >
                  {ECHEANCES_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="__custom__">Autre (saisie libre ↓)</option>
                </select>
                <input
                  value={facture.echeance}
                  onChange={e => setFacture({ ...facture, echeance: e.target.value })}
                  placeholder="ex: 30/05/2026"
                  className="w-full border border-slate-200 rounded px-2 py-1.5 mt-2 text-sm"
                />
              </label>
            </div>
          </section>

          {/* Client */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-[#0e2a52]">Client &amp; chantier</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500">Nom du client</span>
                <div className="mt-1">
                  <ClientAutocomplete
                    value={clientNom}
                    onChange={setClientNom}
                    onSelect={c => {
                      setClientNom(c.nom)
                      if (c.adresse) setClientAdresse(c.adresse)
                      if (c.code_postal) setClientCP(c.code_postal)
                      if (c.ville) setClientVille(c.ville)
                      if (c.email) setClientEmail(c.email)
                    }}
                    placeholder="M. Dupont / Mme Jules…"
                  />
                </div>
              </label>
              <Field label="Adresse client" value={clientAdresse} onChange={setClientAdresse} />
              <Field label="Code postal" value={clientCP} onChange={setClientCP} />
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
              <Field label="Adresse du chantier" value={adresseChantier} onChange={setAdresseChantier} placeholder="idem ou adresse différente" />
              <Field label="Référence dossier (optionnel)"
                value={facture.reference_dossier || ''}
                onChange={v => setFacture({ ...facture, reference_dossier: v })}
                placeholder="ex: Devis DV-..." />
            </div>
          </section>

          {/* Objet */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-2">
            <h2 className="font-bold text-[#0e2a52]">Objet de la facture</h2>
            <textarea
              value={facture.objet}
              onChange={e => setFacture({ ...facture, objet: e.target.value })}
              rows={2}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm transition-colors"
            />
          </section>

          {/* Lignes */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#0e2a52]">Prestations</h2>
              <button onClick={addLine} className="text-sm font-semibold text-blue-700 hover:text-blue-900">+ Ajouter une ligne</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2">Désignation</th>
                    <th className="py-2 pr-2 w-16">Qté</th>
                    <th className="py-2 pr-2 w-24">Unité</th>
                    <th className="py-2 pr-2 w-28 text-right">P.U. HT €</th>
                    <th className="py-2 pr-2 w-20 text-center">Inclus</th>
                    <th className="py-2 pr-2 w-28 text-right">Total HT</th>
                    <th className="py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {facture.lignes.map((l, i) => (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2">
                        <PrestationsCombobox
                          designation={l.designation}
                          onChange={(patch) => updateLine(i, patch)}
                          className="mb-1"
                        />
                        <input
                          value={l.description || ''}
                          onChange={e => updateLine(i, { description: e.target.value })}
                          placeholder="précisions (optionnel)"
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-500"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="number" step="0.01" min="0"
                          value={l.qte}
                          onChange={e => updateLine(i, { qte: Number(e.target.value) })}
                          className="w-full border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          value={l.unite || ''}
                          onChange={e => updateLine(i, { unite: e.target.value })}
                          className="w-full border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="number" step="0.01" min="0"
                          value={l.pu_ht}
                          onChange={e => updateLine(i, { pu_ht: Number(e.target.value) })}
                          disabled={!!l.inclus}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-right disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                      <td className="py-1 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!l.inclus}
                          onChange={e => updateLine(i, { inclus: e.target.checked })}
                          aria-label="Inclus"
                        />
                      </td>
                      <td className="py-1 pr-2 text-right font-semibold text-[#0e2a52]">
                        {l.inclus
                          ? <span className="text-slate-400 italic font-normal">inclus</span>
                          : `${(l.qte * l.pu_ht).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                      </td>
                      <td className="py-1">
                        <button
                          onClick={() => removeLine(i)}
                          className="text-red-500 hover:text-red-700 text-lg leading-none"
                          aria-label="Supprimer la ligne"
                        >×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-2">
              <div className="w-full sm:w-80 space-y-1 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Total HT</span>
                  <span className="font-semibold">{totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 items-center">
                  <span className="text-slate-600">TVA</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max="30" step="0.1"
                      value={tvaTaux}
                      onChange={e => setFacture({ ...facture, tva_taux: Number(e.target.value) })}
                      className="w-16 border border-slate-200 rounded px-2 py-1 text-right"
                    />
                    <span>%</span>
                    <span className="font-semibold ml-2">{tva.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                  </div>
                </div>
                <div className="flex justify-between py-2 bg-[#0e2a52] text-white px-3 rounded-lg">
                  <span className="font-bold">Montant TTC</span>
                  <span className="font-bold">{ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </div>
              </div>
            </div>
          </section>

          {/* Mode de règlement */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-2">
            <h2 className="font-bold text-[#0e2a52]">Mode de règlement</h2>
            <p className="text-xs text-slate-500">Affiché dans l&apos;encadré vert. Vide = pas d&apos;encadré sur le PDF.</p>
            <textarea
              value={facture.mode_reglement || ''}
              onChange={e => setFacture({ ...facture, mode_reglement: e.target.value })}
              rows={2}
              placeholder="ex: Intervention réglée par carte bancaire le 29/04/2026. Aucun solde restant dû."
              className="w-full border-2 border-slate-200 focus:border-emerald-500 outline-none rounded-lg px-3 py-2 text-sm transition-colors"
            />
          </section>

          {/* Observations technicien */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-[#0e2a52]">Observations du technicien</h2>
            <p className="text-xs text-slate-500">Affichées dans l&apos;encadré jaune.</p>
            <textarea
              value={facture.observations || ''}
              onChange={e => setFacture({ ...facture, observations: e.target.value })}
              rows={4}
              placeholder="Constat technique : état de la canalisation, nature du bouchon…"
              className="w-full border-2 border-slate-200 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm transition-colors"
            />
            <textarea
              value={facture.recommandation || ''}
              onChange={e => setFacture({ ...facture, recommandation: e.target.value })}
              rows={2}
              placeholder="Recommandation préventive (optionnel)"
              className="w-full border-2 border-slate-200 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm transition-colors"
            />
          </section>

          <div className="flex justify-end">
            <FactureDownloadButton {...pdfProps} />
          </div>
        </main>
      </div>
    )
  }

  /* ========= CAPTURE ========= */
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <AppTabs />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-black text-[#0e2a52]">Nouvelle facture</h1>
          <p className="text-sm text-slate-500 mt-1">Dicte l&apos;intervention réalisée, les prestations, les prix et le mode de règlement.</p>
        </div>

        {/* Agence (avant génération) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-2">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-slate-500 font-bold">Agence émettrice</span>
            <select
              value={agence}
              onChange={e => setAgence(e.target.value as Agence)}
              className="w-full border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-lg px-3 py-2.5 mt-1 text-sm font-semibold"
            >
              {AGENCES.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500 mt-1 block">Apparaît sous le bloc émetteur sur la facture PDF.</span>
          </label>
        </div>

        {/* Dictée */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-xl font-black text-[#0e2a52]">Raconte l&apos;intervention</h2>
            <p className="text-sm text-slate-500 mt-1">
              Ex : « Facture pour Madame Jules à Trets, 250 € pour le débouchage haute pression du collecteur eaux usées, déplacement inclus, payé par carte aujourd&apos;hui. Le tuyau était plein de graisses alimentaires, j&apos;ai conseillé d&apos;arrêter de jeter de l&apos;huile dedans. »
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <VoiceRecorder onTranscription={t => setTranscription(prev => prev ? prev + ' ' + t : t)} />
          </div>

          <textarea
            value={transcription}
            onChange={e => setTranscription(e.target.value)}
            rows={6}
            placeholder="Dicte l&apos;intervention, les prestations, les prix et le mode de règlement…"
            className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors"
          />

          <div className="flex justify-between text-xs text-slate-400">
            <span>{transcription.length} car.</span>
            <span>{transcription.length < 50 ? 'Ajoute plus de détails' : '✓ OK'}</span>
          </div>

          {transcription.length > 20 && (
            <button
              onClick={handleExtractClient}
              disabled={step === 'extracting'}
              className="text-sm text-blue-700 hover:text-blue-900 font-semibold disabled:opacity-50"
            >
              {step === 'extracting' ? 'Extraction…' : '↳ Pré-remplir les champs client depuis la dictée'}
            </button>
          )}
        </div>

        {/* Client */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-3">
          <h2 className="text-xl font-black text-[#0e2a52]">Client</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500">Nom du client</span>
              <div className="mt-1">
                <ClientAutocomplete
                  value={clientNom}
                  onChange={setClientNom}
                  onSelect={c => {
                    setClientNom(c.nom)
                    if (c.adresse) setClientAdresse(c.adresse)
                    if (c.code_postal) setClientCP(c.code_postal)
                    if (c.ville) setClientVille(c.ville)
                    if (c.email) setClientEmail(c.email)
                  }}
                  placeholder="M. Dupont / Mme Jules…"
                />
              </div>
            </label>
            <Field label="Adresse" value={clientAdresse} onChange={setClientAdresse} />
            <Field label="Code postal" value={clientCP} onChange={setClientCP} />
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
            <Field label="Adresse du chantier" value={adresseChantier} onChange={setAdresseChantier} placeholder="idem / autre" />
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500">Date de la facture</span>
              <input
                type="date"
                value={dateFacture}
                onChange={e => setDateFacture(e.target.value)}
                className="w-full border border-slate-200 rounded px-2 py-1.5 mt-1"
              />
            </label>
            <Field
              label="Référence dossier (optionnel)"
              value={referenceDossier}
              onChange={setReferenceDossier}
              placeholder="ex: DV-..., rapport du …"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={transcription.trim().length < 20}
          className="w-full bg-[#0e2a52] hover:bg-[#13386e] disabled:bg-slate-300 text-white font-bold py-4 rounded-xl transition-colors"
        >
          🤖 Générer la facture depuis la dictée →
        </button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">ou</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          onClick={handleCreateBlank}
          className="w-full bg-white border-2 border-[#0e2a52] hover:bg-slate-50 text-[#0e2a52] font-bold py-4 rounded-xl transition-colors"
        >
          ✏️ Saisir manuellement (sans dictée)
        </button>
      </main>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded px-2 py-1.5 mt-1"
      />
    </label>
  )
}
