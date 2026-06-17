import type { AccordIntervention, LigneDevis } from "@/lib/supabase"
import { fmtEUR, fmtDateFR } from "@/lib/format"
import {
  ACCORD_TITRE,
  MENTION_TVA_FRANCHISE,
  adresseClientComplete,
  blocADemandeExpresse,
  formatDateHeureFR,
  BLOC_C_INFORMATION,
  BLOC_C_TRAVAUX_NON_URGENTS,
} from "@/lib/accord/blocs-legaux"

export type EmetteurInfo = {
  raisonSociale: string
  adresseLignes: string[]
  email: string
}

type Props = {
  accord: AccordIntervention
  lignes: LigneDevis[]
  emetteur: EmetteurInfo
  telephone: string
}

/**
 * Aperçu écran du document signé : demande expresse (A) + devis détaillé (B)
 * + information rétractation (C). Composant de pur affichage — mêmes textes
 * que le PDF (source commune : lib/accord/blocs-legaux).
 */
export default function ApercuAccord({ accord, lignes, emetteur, telephone }: Props) {
  const dateAccord = accord.valide_at || accord.created_at
  const dateHeure = formatDateHeureFR(dateAccord)
  const adresseClient = adresseClientComplete(accord)
  const sousTotal = lignes.reduce((s, l) => s + (l.total_ligne || 0), 0)
  const sansTVA = !accord.taux_tva || accord.taux_tva <= 0

  return (
    <article className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* En-tête document */}
      <div className="bg-[#0e2a52] text-white px-5 py-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold">
          {emetteur.raisonSociale}
        </div>
        <h2 className="text-xl font-black mt-0.5">{ACCORD_TITRE}</h2>
        <div className="text-[11px] text-white/70 mt-1">
          {accord.reference || accord.id.slice(0, 8)} · établi le {fmtDateFR(dateAccord)}
        </div>
      </div>

      <div className="p-5 space-y-5 text-sm text-slate-700">
        {/* Émetteur / Client */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Partie titre="Entreprise">
            <div className="font-bold text-slate-800">{emetteur.raisonSociale}</div>
            {emetteur.adresseLignes.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            <div>Tél. {telephone}</div>
            <div>{emetteur.email}</div>
          </Partie>
          <Partie titre="Client">
            <div className="font-bold text-slate-800">{accord.client_nom || '—'}</div>
            <div>{adresseClient || '—'}</div>
            {accord.client_telephone && <div>Tél. {accord.client_telephone}</div>}
            {accord.client_email && <div>{accord.client_email}</div>}
          </Partie>
        </div>

        {/* Bloc A */}
        <Bloc lettre="A" titre="Demande expresse d'intervention en urgence">
          <p className="leading-relaxed">{blocADemandeExpresse(accord, dateHeure)}</p>
        </Bloc>

        {/* Bloc B — devis */}
        <Bloc lettre="B" titre="Devis détaillé">
          <p className="text-xs text-slate-500 mb-2">
            Lieu d&apos;exécution : {adresseClient || '—'}
          </p>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-left">
                  <th className="px-2 py-1.5 font-bold">Prestation</th>
                  <th className="px-2 py-1.5 font-bold text-center">Caractère</th>
                  <th className="px-2 py-1.5 font-bold text-center">Qté</th>
                  <th className="px-2 py-1.5 font-bold text-right">P.U.</th>
                  <th className="px-2 py-1.5 font-bold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{l.label}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={l.urgent ? 'text-red-600 font-semibold' : 'text-slate-400'}>
                        {l.urgent ? 'Urgent' : 'Non urgent'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {l.quantite} {l.unite}
                    </td>
                    <td className="px-2 py-1.5 text-right">{fmtEUR(l.prix_unitaire)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{fmtEUR(l.total_ligne)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 ml-auto sm:w-1/2 space-y-1 text-xs">
            <TotalRow label="Sous-total prestations" value={fmtEUR(sousTotal)} />
            <TotalRow label="Frais de déplacement" value={fmtEUR(accord.frais_deplacement)} />
            <TotalRow label="Total HT" value={fmtEUR(accord.total_ht)} />
            {sansTVA ? (
              <p className="text-[11px] text-slate-400 pt-0.5">{MENTION_TVA_FRANCHISE}</p>
            ) : (
              <TotalRow label={`TVA (${accord.taux_tva} %)`} value={fmtEUR(accord.total_tva)} />
            )}
            <TotalRow label="Total à payer" value={fmtEUR(accord.total_ttc)} strong />
          </div>

          <p className="text-[11px] text-slate-400 mt-2">
            Devis {accord.devis_gratuit ? 'gratuit' : 'payant'} · valable {accord.validite_jours} jours
            à compter de sa date d&apos;établissement.
          </p>
        </Bloc>

        {/* Bloc C — rétractation */}
        <Bloc lettre="C" titre="Information sur le droit de rétractation">
          <p className="leading-relaxed">{BLOC_C_INFORMATION}</p>
          {accord.a_travaux_non_urgents && (
            <p className="leading-relaxed mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              {BLOC_C_TRAVAUX_NON_URGENTS}
            </p>
          )}
        </Bloc>

        {/* Validation */}
        <div className="border-t border-slate-200 pt-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
            Validation du client
          </div>
          {accord.statut === 'VALIDE' && accord.signature_image ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={accord.signature_image}
                alt="Signature du client"
                className="h-24 border border-slate-200 rounded-lg bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Validé le {formatDateHeureFR(accord.valide_at)}
                {accord.canal_validation ? ` · signature ${accord.canal_validation === 'SMS' ? 'à distance' : 'sur place'}` : ''}
              </p>
            </div>
          ) : accord.statut === 'REFUSE' ? (
            <p className="text-sm text-red-600">
              Refusé par le client
              {accord.motif_refus ? ` — ${accord.motif_refus}` : ''}.
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">
              Document non encore validé — signature à recueillir.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function Partie({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{titre}</div>
      <div className="space-y-0.5 text-[13px]">{children}</div>
    </div>
  )
}

function Bloc({
  lettre,
  titre,
  children,
}: {
  lettre: string
  titre: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-[#0e2a52] text-white text-xs font-black w-6 h-6 rounded-md flex items-center justify-center shrink-0">
          {lettre}
        </span>
        <h3 className="font-bold text-slate-800">{titre}</h3>
      </div>
      <div className="pl-8">{children}</div>
    </section>
  )
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between ${
        strong ? 'font-black text-slate-900 text-sm pt-1 border-t border-slate-200' : 'text-slate-600'
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
