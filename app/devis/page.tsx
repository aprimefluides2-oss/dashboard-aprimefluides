'use client'
import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import VoiceRecorder from "@/components/VoiceRecorder"
import AppTabs from "@/components/AppTabs"
import DevisTabs from "@/components/DevisTabs"
import VilleCombobox from "@/components/VilleCombobox"
import ClientAutocomplete from "@/components/ClientAutocomplete"
import PrestationsCombobox from "@/components/PrestationsCombobox"
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning"
import type { DevisPDFProps, DevisLineData, DevisConstatItem, ClientData, DevisData } from "@/components/DevisPDF"
import { APRIME_EMETTEUR } from "@/lib/emetteur"
import { fmtDateISOtoFR } from "@/lib/format"
import { detectTypeIntervention } from "@/lib/types-intervention"
import DevisEnvoiPanel from "@/components/DevisEnvoiPanel"

const DevisDownloadButton = dynamic(() => import("@/components/DevisPDF"), { ssr: false })
const SaveDocumentButton = dynamic(() => import("@/components/SaveDocumentButton"), { ssr: false })

type Step = 'capture' | 'extracting' | 'generating' | 'preview'

export default function DevisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Chargement…</div>
    }>
      <DevisPageContent />
    </Suspense>
  )
}

function DevisPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const interventionId = searchParams.get('intervention')
  const [step, setStep] = useState<Step>('capture')
  const [error, setError] = useState('')

  // Capture
  const [transcription, setTranscription] = useState('')
  const [clientNom, setClientNom] = useState('')
  const [clientAdresse, setClientAdresse] = useState('')
  const [clientCP, setClientCP] = useState('')
  const [clientVille, setClientVille] = useState('')
  const [adresseChantier, setAdresseChantier] = useState('idem')
  const [dateDevis, setDateDevis] = useState(new Date().toISOString().split('T')[0])
  const [referenceDossier, setReferenceDossier] = useState('')

  // Résultat IA (éditable)
  const [devis, setDevis] = useState<DevisData | null>(null)

  const [clientEmail, setClientEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(!!interventionId)

  useUnsavedChangesWarning(
    (step === 'capture' && (transcription.trim() !== '' || clientNom.trim() !== '')) ||
    (step === 'preview' && devis !== null && !emailSent)
  )

  useEffect(() => {
    if (!interventionId) {
      setPrefillLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/interventions/${interventionId}`, { cache: 'no-store' })
        const data = await res.json()
        if (cancelled || !res.ok) return
        const c = data.client
        const itv = data.intervention
        if (c?.nom) setClientNom(c.nom)
        if (c?.email) setClientEmail(c.email)
        if (c?.adresse) setClientAdresse(c.adresse)
        if (c?.code_postal) setClientCP(c.code_postal)
        if (c?.ville) setClientVille(c.ville)
        if (itv?.adresse_chantier) setAdresseChantier(itv.adresse_chantier)
        else if (c?.adresse) setAdresseChantier(c.adresse)
        if (itv?.ville && !c?.ville) setClientVille(itv.ville)
        if (itv?.code_postal && !c?.code_postal) setClientCP(itv.code_postal)
        setReferenceDossier(itv?.reference ? `Intervention ${itv.reference}` : '')
      } catch {
        /* best-effort */
      } finally {
        if (!cancelled) setPrefillLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [interventionId])

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
      setError('Dicte au moins quelques phrases sur les travaux, les quantités et les prix.')
      return
    }
    setError(''); setStep('generating')
    try {
      const res = await fetch('/api/generate-devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription,
          client_nom: clientNom,
          client_adresse: clientAdresse,
          client_ville: clientVille,
          client_code_postal: clientCP,
          date_devis: dateDevis,
          reference_dossier: referenceDossier,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Génération échouée')

      // Si l'IA a détecté un client depuis la dictée, on alimente les champs (n'écrase pas ce qui est déjà saisi)
      if (!clientNom && data.devis?.client_nom_detecte) setClientNom(data.devis.client_nom_detecte)
      if (!clientAdresse && data.devis?.client_adresse_detectee) setClientAdresse(data.devis.client_adresse_detectee)

      setDevis(data.devis)
      setStep('preview')
    } catch (e: any) {
      setError(`Erreur IA : ${e.message}`)
      setStep('capture')
    }
  }

  function updateLine(index: number, patch: Partial<DevisLineData>) {
    if (!devis) return
    const lignes = [...devis.lignes]
    lignes[index] = { ...lignes[index], ...patch }
    setDevis({ ...devis, lignes })
  }

  function removeLine(index: number) {
    if (!devis) return
    setDevis({ ...devis, lignes: devis.lignes.filter((_, i) => i !== index) })
  }

  function addLine() {
    if (!devis) return
    const lastSection = devis.lignes[devis.lignes.length - 1]?.section || '1. Prestations'
    setDevis({
      ...devis,
      lignes: [
        ...devis.lignes,
        { section: lastSection, designation: '', description: '', qte: 1, unite: 'forfait', pu_ht: 0 },
      ],
    })
  }

  function handleTransformToFacture() {
    if (!devis) return
    const today = new Date()
    const seq = String(today.getHours()).padStart(2, '0') + String(today.getMinutes()).padStart(2, '0')
    const numeroFA = `FA-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${seq}`

    const payload = {
      client_nom: clientNom,
      client_adresse: clientAdresse,
      client_cp: clientCP,
      client_ville: clientVille,
      adresse_chantier: adresseChantier,
      reference_dossier: `Devis ${devis.numero}`,
      client_email: clientEmail,
      // Libellé court inféré (ex: "Débouchage canalisation") pour rester
      // propre sur la facture — pas la longue description du devis.
      facture: (() => {
        const objetCourt = detectTypeIntervention(devis.objet)
          || detectTypeIntervention(devis.lignes.map(l => l.designation).join(' '))
          || 'Intervention'
        return {
          numero: numeroFA,
          date_facture: today.toISOString().split('T')[0],
          echeance: 'À réception',
          objet: objetCourt,
          reference_dossier: `Devis ${devis.numero}`,
          lignes: devis.lignes.map(l => ({
            // Idem : on simplifie chaque ligne en un libellé standardisé
            designation: detectTypeIntervention(l.designation)
              || detectTypeIntervention(l.section || '')
              || objetCourt,
            description: '',
            qte: l.qte,
            unite: l.unite || 'forfait',
            pu_ht: l.pu_ht,
            inclus: false,
          })),
          tva_taux: devis.tva_taux ?? 10,
          mode_reglement: '',
          observations: '',
          recommandation: '',
        }
      })(),
    }
    sessionStorage.setItem('ltdb_devis_to_facture', JSON.stringify(payload))
    router.push('/facture/nouvelle')
  }

  function handleManualEntry() {
    const today = new Date()
    const seq = String(today.getHours()).padStart(2, '0') + String(today.getMinutes()).padStart(2, '0')
    setDevis({
      numero: `DV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${seq}`,
      date_devis: today.toISOString().split('T')[0],
      validite_jours: 30,
      objet: '',
      lignes: [{ section: '1. Prestations', designation: '', description: '', qte: 1, unite: 'forfait', pu_ht: 0 }],
      tva_taux: 10,
      tva_reduite_attestation: true,
      conditions: {
        validite: '30 jours à compter de la date d\'établissement',
        delai_execution: 'À convenir avec le client après validation',
        duree_chantier: 'Selon accès et météo',
        garanties: 'Garantie décennale sur ouvrages enterrés · Garantie de parfait achèvement 1 an',
        assurance: 'RC Pro et décennale LTDB en cours de validité',
        particulieres: '',
      },
      modalites: {
        acompte_pct: 30,
        modes_paiement: ['Chèque', 'Virement bancaire', 'Carte bancaire', 'Espèces (dans la limite légale)'],
      },
      constats_conformes: [],
      constats_critiques: [],
      non_garantie: '',
    })
    setStep('preview')
  }

  function updateConstat(
    kind: 'conformes' | 'critiques',
    index: number,
    patch: Partial<DevisConstatItem>,
  ) {
    if (!devis) return
    const key = kind === 'conformes' ? 'constats_conformes' : 'constats_critiques'
    const rows = [...(devis[key] || [])]
    rows[index] = { ...rows[index], ...patch }
    setDevis({ ...devis, [key]: rows })
  }

  function addConstat(kind: 'conformes' | 'critiques') {
    if (!devis) return
    const key = kind === 'conformes' ? 'constats_conformes' : 'constats_critiques'
    setDevis({
      ...devis,
      [key]: [...(devis[key] || []), { intitule: '', localisation: '', description: '' }],
    })
  }

  function removeConstat(kind: 'conformes' | 'critiques', index: number) {
    if (!devis) return
    const key = kind === 'conformes' ? 'constats_conformes' : 'constats_critiques'
    setDevis({ ...devis, [key]: (devis[key] || []).filter((_, i) => i !== index) })
  }

  const total = devis?.lignes.reduce((s, l) => s + (Number(l.pu_ht) || 0) * (Number(l.qte) || 0), 0) || 0
  const tvaTaux = devis?.tva_taux ?? 10
  const tva = total * tvaTaux / 100
  const ttc = total + tva

  /* =================== RENDER =================== */
  if (step === 'generating') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-[#0e2a52] mb-4" />
          <h2 className="text-xl font-black text-[#0e2a52]">Analyse de la dictée…</h2>
          <p className="text-sm text-slate-500 mt-2">L&apos;IA structure le devis (constats, objet, lignes, conditions, TVA).</p>
        </div>
      </div>
    )
  }

  if (step === 'preview' && devis) {
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
    const pdfProps: DevisPDFProps = {
      emetteur: APRIME_EMETTEUR,
      client,
      devis,
      phone: APRIME_EMETTEUR.telephone,
    }

    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <AppTabs />
          </div>
        </header>
        <DevisTabs current="nouveau" />

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Header preview */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-[#0e2a52]">Devis N° {devis.numero}</h1>
              <p className="text-sm text-slate-500">Établi le {fmtDateISOtoFR(devis.date_devis)} · valable {devis.validite_jours} jours</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStep('capture')}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
              >
                ← Modifier la dictée
              </button>
              <button
                onClick={handleTransformToFacture}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
                title="Crée une facture pré-remplie depuis ce devis"
              >
                💶 Transformer en facture
              </button>
              <SaveDocumentButton
                endpoint="/api/save-devis"
                className="bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-amber-600 disabled:opacity-50 transition"
                body={() => ({
                  devis,
                  clientNom,
                  clientEmail,
                  clientAdresse,
                  clientCP,
                  ville: clientVille,
                  numero: devis.numero,
                  totalHT: total,
                  totalTTC: ttc,
                  tvaTaux,
                  validiteJours: devis.validite_jours,
                })}
              />
              <DevisDownloadButton {...pdfProps} />
            </div>
          </div>

          {missingClient.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-4 py-3 text-sm">
              ⚠ Champs client manquants : <strong>{missingClient.join(', ')}</strong> — le devis risque de s&apos;afficher avec « — ». Complète le bloc <em>Client &amp; chantier</em> avant d&apos;exporter ou d&apos;envoyer.
            </div>
          )}

          {interventionId && (
            <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-sm">
              📋 Devis lié à l&apos;intervention — pas de mode terrain.{' '}
              <Link href={`/intervention/${interventionId}`} className="font-bold underline">
                Retour fiche
              </Link>
            </div>
          )}

          <DevisEnvoiPanel
            devis={devis}
            clientEmail={clientEmail}
            onClientEmailChange={setClientEmail}
            clientNom={clientNom}
            clientAdresse={clientAdresse}
            clientCP={clientCP}
            clientVille={clientVille}
            dateDevis={dateDevis}
            totalHT={total}
            totalTTC={ttc}
            tvaTaux={tvaTaux}
            interventionId={interventionId}
            onSent={() => setEmailSent(true)}
          />

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
                    placeholder="M. Dupont / SAS Martin…"
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
                value={devis.reference_dossier || ''}
                onChange={v => setDevis({ ...devis, reference_dossier: v })}
                placeholder="ex: Rapport d'intervention du 11/04/2026" />
            </div>
          </section>

          {/* Objet */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-2">
            <h2 className="font-bold text-[#0e2a52]">Objet du devis</h2>
            <textarea
              value={devis.objet}
              onChange={e => setDevis({ ...devis, objet: e.target.value })}
              rows={3}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm transition-colors"
            />
          </section>

          {/* Constats conforme / critique / non garantie */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
            <h2 className="font-bold text-[#0e2a52]">Constats techniques</h2>
            <p className="text-xs text-slate-500">
              Générés depuis la dictée — à compléter si besoin. Ne pas inventer de faits absents de la dictée.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-teal-800">Conforme</h3>
                <button type="button" onClick={() => addConstat('conformes')} className="text-xs font-semibold text-teal-700 hover:text-teal-900">+ Ajouter</button>
              </div>
              {(devis.constats_conformes || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucun constat conforme (normal si non mentionné dans la dictée).</p>
              ) : (
                (devis.constats_conformes || []).map((row, i) => (
                  <div key={i} className="border border-teal-200 rounded-xl p-3 space-y-2 bg-teal-50/40">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-teal-800">#{i + 1}</span>
                      <button type="button" onClick={() => removeConstat('conformes', i)} className="text-red-500 text-lg leading-none" aria-label="Supprimer">×</button>
                    </div>
                    <Field label="Intitulé" value={row.intitule} onChange={v => updateConstat('conformes', i, { intitule: v })} />
                    <Field label="Localisation" value={row.localisation || ''} onChange={v => updateConstat('conformes', i, { localisation: v })} />
                    <label className="block text-sm">
                      <span className="text-xs uppercase tracking-wide text-slate-500">Description</span>
                      <textarea value={row.description} onChange={e => updateConstat('conformes', i, { description: e.target.value })} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm" />
                    </label>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-red-800">Critique</h3>
                <button type="button" onClick={() => addConstat('critiques')} className="text-xs font-semibold text-red-700 hover:text-red-900">+ Ajouter</button>
              </div>
              {(devis.constats_critiques || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucun constat critique (normal si non mentionné).</p>
              ) : (
                (devis.constats_critiques || []).map((row, i) => (
                  <div key={i} className="border border-red-200 rounded-xl p-3 space-y-2 bg-red-50/40">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-red-800">#{i + 1}</span>
                      <button type="button" onClick={() => removeConstat('critiques', i)} className="text-red-500 text-lg leading-none" aria-label="Supprimer">×</button>
                    </div>
                    <Field label="Intitulé" value={row.intitule} onChange={v => updateConstat('critiques', i, { intitule: v })} />
                    <Field label="Localisation" value={row.localisation || ''} onChange={v => updateConstat('critiques', i, { localisation: v })} />
                    <label className="block text-sm">
                      <span className="text-xs uppercase tracking-wide text-slate-500">Description</span>
                      <textarea value={row.description} onChange={e => updateConstat('critiques', i, { description: e.target.value })} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm" />
                    </label>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-sm">
                <span className="text-sm font-bold text-[#0e2a52]">Non garantie suite à notre intervention</span>
                <textarea
                  value={devis.non_garantie || ''}
                  onChange={e => setDevis({ ...devis, non_garantie: e.target.value })}
                  rows={5}
                  placeholder="Limites de garantie après intervention…"
                  className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 text-sm"
                />
              </label>
            </div>
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
                    <th className="py-2 pr-2">Section</th>
                    <th className="py-2 pr-2">Désignation</th>
                    <th className="py-2 pr-2 w-16">Qté</th>
                    <th className="py-2 pr-2 w-24">Unité</th>
                    <th className="py-2 pr-2 w-28 text-right">P.U. HT €</th>
                    <th className="py-2 pr-2 w-28 text-right">Total HT</th>
                    <th className="py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {devis.lignes.map((l, i) => (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2">
                        <input
                          value={l.section || ''}
                          onChange={e => updateLine(i, { section: e.target.value })}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                        />
                      </td>
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
                          className="w-full border border-slate-200 rounded px-2 py-1 text-right"
                        />
                      </td>
                      <td className="py-1 pr-2 text-right font-semibold text-[#0e2a52]">
                        {(l.qte * l.pu_ht).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
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
                  <span className="font-semibold">{total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 items-center">
                  <span className="text-slate-600">TVA</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max="30" step="0.1"
                      value={tvaTaux}
                      onChange={e => setDevis({ ...devis, tva_taux: Number(e.target.value) })}
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
                <label className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                  <input
                    type="checkbox"
                    checked={!!devis.tva_reduite_attestation}
                    onChange={e => setDevis({ ...devis, tva_reduite_attestation: e.target.checked })}
                  />
                  Ajouter l&apos;attestation TVA 10 % (habitation &gt; 2 ans)
                </label>
              </div>
            </div>
          </section>

          {/* Conditions */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-[#0e2a52]">Conditions d&apos;exécution</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Validité" value={devis.conditions?.validite || ''} onChange={v => setDevis({ ...devis, conditions: { ...(devis.conditions || {}), validite: v } })} />
              <Field label="Délai d'exécution" value={devis.conditions?.delai_execution || ''} onChange={v => setDevis({ ...devis, conditions: { ...(devis.conditions || {}), delai_execution: v } })} />
              <Field label="Durée estimée du chantier" value={devis.conditions?.duree_chantier || ''} onChange={v => setDevis({ ...devis, conditions: { ...(devis.conditions || {}), duree_chantier: v } })} />
              <Field label="Garanties" value={devis.conditions?.garanties || ''} onChange={v => setDevis({ ...devis, conditions: { ...(devis.conditions || {}), garanties: v } })} />
              <Field label="Assurance" value={devis.conditions?.assurance || ''} onChange={v => setDevis({ ...devis, conditions: { ...(devis.conditions || {}), assurance: v } })} />
              <Field label="Conditions particulières" value={devis.conditions?.particulieres || ''} onChange={v => setDevis({ ...devis, conditions: { ...(devis.conditions || {}), particulieres: v } })} />
              <Field label="Majoration (note)" value={devis.majoration_note || ''} onChange={v => setDevis({ ...devis, majoration_note: v })} placeholder="ex: 100 % après 17 h, week-ends" />
            </div>
          </section>

          {/* Modalités */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-[#0e2a52]">Modalités de règlement</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-500">Acompte (%)</span>
                <input
                  type="number" min="0" max="100" step="1"
                  value={devis.modalites?.acompte_pct ?? 30}
                  onChange={e => setDevis({ ...devis, modalites: { ...(devis.modalites || {}), acompte_pct: Number(e.target.value) } })}
                  className="w-full border border-slate-200 rounded px-2 py-1 mt-1"
                />
              </label>
              <Field
                label="Modes de paiement (séparés par virgule)"
                value={(devis.modalites?.modes_paiement || []).join(', ')}
                onChange={v => setDevis({ ...devis, modalites: { ...(devis.modalites || {}), modes_paiement: v.split(',').map(s => s.trim()).filter(Boolean) } })}
              />
            </div>
          </section>

          <div className="flex justify-end">
            <DevisDownloadButton {...pdfProps} />
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
      <DevisTabs current="nouveau" />

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {interventionId && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-sm">
            {prefillLoading ? 'Chargement client…' : (
              <>
                Intervention devis — client pré-rempli.{' '}
                <Link href={`/intervention/${interventionId}`} className="font-bold underline">Fiche</Link>
              </>
            )}
          </div>
        )}
        <div className="text-center">
          <h1 className="text-2xl font-black text-[#0e2a52]">Nouveau devis</h1>
          <p className="text-sm text-slate-500 mt-1">Dicte les travaux, les quantités et les prix — on s&apos;occupe du reste.</p>
        </div>

        {/* Saisie manuelle */}
        <button
          onClick={handleManualEntry}
          className="w-full bg-white border-2 border-dashed border-amber-400 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50 text-amber-800 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          <span className="text-xl">✍️</span>
          <span>Saisir un devis manuellement (sans dictée)</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-slate-200" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ou</span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        {/* Dictée */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-xl font-black text-[#0e2a52]">Raconte le chantier</h2>
            <p className="text-sm text-slate-500 mt-1">
              Dicte ou tape. Exemple : « Devis pour M. Dupont à Toulon — pompage fosse 390 €, tranchée 8 mètres à 95 € le mètre, pose carrelage 18 m² à 78 €, TVA 10 %. »
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <VoiceRecorder onTranscription={t => setTranscription(prev => prev ? prev + ' ' + t : t)} />
          </div>

          <textarea
            value={transcription}
            onChange={e => setTranscription(e.target.value)}
            rows={6}
            placeholder="Dicte les prestations avec leurs quantités et prix…"
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
                  placeholder="M. Dupont / SAS Martin…"
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
              <span className="text-xs uppercase tracking-wide text-slate-500">Date du devis</span>
              <input
                type="date"
                value={dateDevis}
                onChange={e => setDateDevis(e.target.value)}
                className="w-full border border-slate-200 rounded px-2 py-1.5 mt-1"
              />
            </label>
            <Field
              label="Référence dossier (optionnel)"
              value={referenceDossier}
              onChange={setReferenceDossier}
              placeholder="Rapport d'intervention du…"
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
          Générer le devis →
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
