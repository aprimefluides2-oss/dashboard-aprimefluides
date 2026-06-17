'use client'
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { Tarif } from "@/lib/supabase"
import { calculDevis } from "@/lib/accord/calcul-devis"
import { savePendingAccord, type AccordCreatePayload } from "@/lib/accord/offline-store"
import { fmtEUR } from "@/lib/format"
import SelecteurPrestations, { type LigneState } from "@/components/accord/SelecteurPrestations"
import SignatureCanvas from "@/components/accord/SignatureCanvas"

/** Données client pré-remplies depuis la fiche intervention. */
export type AccordPrefill = {
  client_id: string | null
  client_nom: string
  client_adresse: string
  client_code_postal: string
  client_ville: string
  client_telephone: string
  client_email: string
}

type Props = {
  tarifs: Tarif[]
  interventionId: string | null
  prefill: AccordPrefill | null
  tauxTVA: number
  validiteJours: number
}

const inputCls =
  "w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm bg-white transition-colors"

const TARIFS_CACHE_KEY = 'ltdb_accord_tarifs'

function loadCachedTarifs(): Tarif[] {
  try {
    const raw = localStorage.getItem(TARIFS_CACHE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export default function AccordForm({
  tarifs,
  interventionId,
  prefill,
  tauxTVA,
  validiteJours,
}: Props) {
  const router = useRouter()

  const [clientNom, setClientNom] = useState(prefill?.client_nom || '')
  const [clientAdresse, setClientAdresse] = useState(prefill?.client_adresse || '')
  const [clientCodePostal, setClientCodePostal] = useState(prefill?.client_code_postal || '')
  const [clientVille, setClientVille] = useState(prefill?.client_ville || '')
  const [clientTelephone, setClientTelephone] = useState(prefill?.client_telephone || '')
  const [clientEmail, setClientEmail] = useState(prefill?.client_email || '')

  const [lignes, setLignes] = useState<LigneState[]>([])
  const [fraisDeplacement, setFraisDeplacement] = useState('0')
  const [interventionUrgente, setInterventionUrgente] = useState(true)

  const [signature, setSignature] = useState<string | null>(null)
  const [demandeExpresse, setDemandeExpresse] = useState(false)
  const [renonciation, setRenonciation] = useState(false)

  const [busy, setBusy] = useState<'valider' | 'brouillon' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offlineSaved, setOfflineSaved] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  // Cache local des tarifs : alimenté quand on est en ligne, lu en repli si la
  // page est servie hors-ligne sans tarifs.
  const [cachedTarifs, setCachedTarifs] = useState<Tarif[]>([])
  useEffect(() => {
    if (tarifs.length > 0) {
      try {
        localStorage.setItem(TARIFS_CACHE_KEY, JSON.stringify(tarifs))
      } catch {
        /* quota — sans gravité */
      }
    } else {
      setCachedTarifs(loadCachedTarifs())
    }
  }, [tarifs])
  const tarifsDispo = tarifs.length > 0 ? tarifs : cachedTarifs

  // Suivi de la connectivité.
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const totaux = useMemo(
    () => calculDevis(lignes, Number(fraisDeplacement) || 0, tauxTVA),
    [lignes, fraisDeplacement, tauxTVA],
  )
  const aTravauxNonUrgents = lignes.some(l => !l.urgent)
  const peutValider =
    !!clientNom.trim() &&
    lignes.length > 0 &&
    !!signature &&
    demandeExpresse &&
    renonciation &&
    busy === null

  function buildPayload(withSignature: boolean): AccordCreatePayload {
    return {
      local_id: crypto.randomUUID(),
      intervention_id: interventionId,
      client_id: prefill?.client_id || null,
      client_nom: clientNom.trim(),
      client_adresse: clientAdresse.trim() || null,
      client_code_postal: clientCodePostal.trim() || null,
      client_ville: clientVille.trim() || null,
      client_telephone: clientTelephone.trim() || null,
      client_email: clientEmail.trim() || null,
      frais_deplacement: Number(fraisDeplacement) || 0,
      taux_tva: tauxTVA,
      validite_jours: validiteJours,
      intervention_urgente: interventionUrgente,
      lignes: lignes.map(l => ({
        tarif_type: l.tarif_type,
        label: l.label,
        prix_unitaire: l.prix_unitaire,
        unite: l.unite,
        quantite: l.quantite,
        urgent: l.urgent,
      })),
      signature: withSignature ? signature : null,
      valide_at: withSignature ? new Date().toISOString() : null,
      demande_expresse: withSignature,
      renonciation_retractation: withSignature,
      canal_validation: withSignature ? 'SIGNATURE' : null,
    }
  }

  async function submit(withSignature: boolean) {
    setError(null)
    if (!clientNom.trim()) {
      setError('Le nom du client est obligatoire.')
      return
    }
    if (lignes.length === 0) {
      setError('Ajoute au moins une prestation.')
      return
    }
    if (withSignature && (!signature || !demandeExpresse || !renonciation)) {
      setError('Pour valider : signature du client + les deux consentements cochés.')
      return
    }

    const payload = buildPayload(withSignature)
    setBusy(withSignature ? 'valider' : 'brouillon')

    // Tentative en ligne.
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const res = await fetch('/api/accords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        router.push(data.id ? `/accord/${data.id}` : '/accord')
        return
      } catch (e) {
        // fetch lève un TypeError sur coupure réseau → on bascule hors-ligne.
        // Une vraie erreur serveur est remontée à l'utilisateur.
        if (!(e instanceof TypeError)) {
          setError(e instanceof Error ? e.message : String(e))
          setBusy(null)
          return
        }
      }
    }

    // Hors-ligne (ou réseau perdu) → file de synchronisation IndexedDB.
    try {
      await savePendingAccord(payload)
      setOfflineSaved(true)
      setTimeout(() => router.push('/accord'), 1600)
    } catch (e) {
      setError("Échec de l'enregistrement hors-ligne : " + (e instanceof Error ? e.message : String(e)))
      setBusy(null)
    }
  }

  if (offlineSaved) {
    return (
      <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center shadow-sm">
        <div className="text-4xl mb-2">📥</div>
        <div className="font-bold text-slate-800">Accord enregistré hors-ligne</div>
        <p className="text-sm text-slate-500 mt-1">
          Il sera synchronisé automatiquement au retour du réseau.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-28">
      {!isOnline && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-sm">
          📡 Mode hors-ligne — l&apos;accord sera enregistré sur l&apos;appareil puis synchronisé au
          retour du réseau.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Client */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Client</h2>
          {prefill && <span className="text-[11px] text-slate-400">Pré-rempli — modifiable</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nom *">
            <input value={clientNom} onChange={e => setClientNom(e.target.value)} className={inputCls} placeholder="Nom du client" />
          </Field>
          <Field label="Téléphone">
            <input value={clientTelephone} onChange={e => setClientTelephone(e.target.value)} className={inputCls} inputMode="tel" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Adresse">
              <input value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Code postal">
            <input value={clientCodePostal} onChange={e => setClientCodePostal(e.target.value)} className={inputCls} inputMode="numeric" />
          </Field>
          <Field label="Ville">
            <input value={clientVille} onChange={e => setClientVille(e.target.value)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Email">
              <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={inputCls} inputMode="email" />
            </Field>
          </div>
        </div>
      </section>

      {/* Prestations */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Prestations</h2>
        <SelecteurPrestations tarifs={tarifsDispo} lignes={lignes} onChange={setLignes} />
      </section>

      {/* Déplacement & urgence */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Déplacement &amp; urgence</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Frais de déplacement (€)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={fraisDeplacement}
              onChange={e => setFraisDeplacement(e.target.value)}
              className={inputCls}
            />
          </Field>
          <label className="flex items-center gap-2 sm:mt-7">
            <input
              type="checkbox"
              checked={interventionUrgente}
              onChange={e => setInterventionUrgente(e.target.checked)}
              className="w-5 h-5 accent-red-500"
            />
            <span className="text-sm font-semibold">
              {interventionUrgente ? '🚨 Intervention urgente' : 'Intervention non urgente'}
            </span>
          </label>
        </div>
      </section>

      {/* Récapitulatif */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Récapitulatif</h2>
        <Row label="Sous-total prestations" value={fmtEUR(totaux.sousTotalPrestations)} />
        <Row label="Frais de déplacement" value={fmtEUR(Number(fraisDeplacement) || 0)} />
        {tauxTVA > 0 ? (
          <>
            <Row label="Total HT" value={fmtEUR(totaux.totalHT)} />
            <Row label={`TVA (${tauxTVA} %)`} value={fmtEUR(totaux.totalTVA)} />
            <Row label="Total TTC" value={fmtEUR(totaux.totalTTC)} strong />
          </>
        ) : (
          <>
            <Row label="Total à payer" value={fmtEUR(totaux.totalTTC)} strong />
            <p className="text-[11px] text-slate-400 pt-1">
              TVA non applicable — art. 293 B du CGI (franchise en base de TVA).
            </p>
          </>
        )}
        {aTravauxNonUrgents && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
            ⚠ Au moins une prestation est marquée « non urgente » : le client conserve son délai de
            rétractation de 14 jours pour ces travaux (mention reprise sur le document).
          </p>
        )}
        <p className="text-[11px] text-slate-400">Devis gratuit · validité {validiteJours} jours.</p>
      </section>

      {/* Signature & validation */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Signature &amp; validation
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Faire relire le document au client, puis recueillir son accord et sa signature.
          </p>
        </div>

        <label className="flex gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={demandeExpresse}
            onChange={e => setDemandeExpresse(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-red-600 shrink-0"
          />
          <span>
            Le client <strong>sollicite expressément</strong> cette intervention de dépannage en
            urgence à son domicile (bloc A).
          </span>
        </label>
        <label className="flex gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={renonciation}
            onChange={e => setRenonciation(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-red-600 shrink-0"
          />
          <span>
            Le client <strong>renonce à son droit de rétractation</strong> pour les travaux urgents
            et en demande l&apos;exécution immédiate (bloc C).
          </span>
        </label>

        <SignatureCanvas onChange={setSignature} />

        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={busy !== null}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            {busy === 'brouillon' ? 'Enregistrement…' : 'Enregistrer en brouillon (signer plus tard) →'}
          </button>
        </div>
      </section>

      {/* Barre de validation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-3 z-30">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total</div>
            <div className="font-black text-lg text-slate-800 leading-none">{fmtEUR(totaux.totalTTC)}</div>
          </div>
          <button
            onClick={() => submit(true)}
            disabled={!peutValider}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg disabled:opacity-50 transition"
          >
            {busy === 'valider'
              ? 'Validation…'
              : isOnline
              ? '✓ Valider l’accord'
              : '✓ Valider (hors-ligne)'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between ${
        strong
          ? 'text-base font-black text-slate-900 pt-1 border-t border-slate-100'
          : 'text-sm text-slate-600'
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
