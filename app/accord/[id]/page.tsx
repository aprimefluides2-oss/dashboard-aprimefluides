import Link from "next/link"
import {
  getSupabaseOrNull,
  type AccordIntervention,
  type AccordStatut,
  type LigneDevis,
} from "@/lib/supabase"
import { getTelPrincipal } from "@/lib/parametres"
import { APRIME_EMETTEUR } from "@/lib/emetteur"
import { fmtDateFR } from "@/lib/format"
import ApercuAccord, { type EmetteurInfo } from "@/components/accord/ApercuAccord"
import GenererPdfButtonLazy from "@/components/accord/GenererPdfButtonLazy"
import ValiderAccordLazy from "@/components/accord/ValiderAccordLazy"
import AnnulerAccordButton from "@/components/accord/AnnulerAccordButton"
import EnvoyerCopieButton from "@/components/accord/EnvoyerCopieButton"

export const dynamic = 'force-dynamic'

const STATUT_LABEL: Record<AccordStatut, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_SMS: 'En attente SMS',
  VALIDE: 'Validé',
  REFUSE: 'Refusé',
  ANNULE: 'Annulé',
}

const STATUT_BADGE: Record<AccordStatut, string> = {
  BROUILLON: 'bg-slate-100 text-slate-600',
  EN_ATTENTE_SMS: 'bg-amber-100 text-amber-700',
  VALIDE: 'bg-emerald-100 text-emerald-700',
  REFUSE: 'bg-red-100 text-red-700',
  ANNULE: 'bg-slate-200 text-slate-500',
}

async function loadAccord(
  id: string,
): Promise<{ accord: AccordIntervention; lignes: LigneDevis[] } | null> {
  const sb = getSupabaseOrNull()
  if (!sb) return null

  const { data: aData, error } = await sb
    .from('accords_intervention')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !aData) {
    if (error) console.error('[accord/[id]] loadAccord', error)
    return null
  }
  const accord = aData as AccordIntervention

  const { data: lData } = await sb
    .from('lignes_devis')
    .select('*')
    .eq('accord_id', id)
    .order('position', { ascending: true })

  return { accord, lignes: (lData as LigneDevis[]) || [] }
}

function ShellHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="bg-[#0e2a52] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        {children}
      </div>
    </header>
  )
}

export default async function AccordDetailPage({ params }: { params: { id: string } }) {
  const result = await loadAccord(params.id)

  if (!result) {
    return (
      <div className="min-h-screen bg-slate-50">
        <ShellHeader>
          <h1 className="font-black text-lg">Accord introuvable</h1>
          <Link href="/accord" className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition">
            ← Accords
          </Link>
        </ShellHeader>
        <main className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            Cet accord n&apos;existe pas ou a été supprimé.
          </div>
        </main>
      </div>
    )
  }

  const { accord, lignes } = result
  const telephone = await getTelPrincipal()
  const emetteur: EmetteurInfo = {
    raisonSociale: APRIME_EMETTEUR.raisonSociale,
    adresseLignes: APRIME_EMETTEUR.adresseLignes,
    email: APRIME_EMETTEUR.email,
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <ShellHeader>
        <div className="min-w-0">
          <h1 className="font-black text-lg sm:text-xl leading-tight truncate">
            🤝 {accord.reference || 'Accord'}
          </h1>
          <div className="text-[11px] opacity-70">{accord.client_nom || 'Client'}</div>
        </div>
        <Link
          href="/accord"
          className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition shrink-0"
        >
          ← Accords
        </Link>
      </ShellHeader>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* Statut & rattachement */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUT_BADGE[accord.statut]}`}>
              {STATUT_LABEL[accord.statut]}
            </span>
            <span className="text-xs text-slate-500">Créé le {fmtDateFR(accord.created_at)}</span>
          </div>
          <div className="flex items-center gap-4">
            {accord.intervention_id && (
              <Link
                href={`/intervention/${accord.intervention_id}`}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Voir l&apos;intervention liée →
              </Link>
            )}
            {accord.statut === 'BROUILLON' && <AnnulerAccordButton accordId={accord.id} />}
          </div>
        </section>

        {/* Aperçu du document */}
        <ApercuAccord accord={accord} lignes={lignes} emetteur={emetteur} telephone={telephone} />

        {/* Actions selon le statut */}
        {accord.statut === 'BROUILLON' && (
          <>
            <ValiderAccordLazy
              accord={accord}
              lignes={lignes}
              emetteur={emetteur}
              telephone={telephone}
            />
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Aperçu PDF</h3>
              <p className="text-xs text-slate-500">
                PDF non signé, pour relecture avant de recueillir la validation du client.
              </p>
              <GenererPdfButtonLazy
                accord={accord}
                lignes={lignes}
                emetteur={emetteur}
                telephone={telephone}
                pdfUrl={accord.pdf_url}
              />
            </section>
          </>
        )}

        {accord.statut === 'VALIDE' && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Document signé</h3>
            <p className="text-xs text-slate-500">
              Accord validé par signature — le PDF horodaté intègre la signature du client.
            </p>
            <GenererPdfButtonLazy
              accord={accord}
              lignes={lignes}
              emetteur={emetteur}
              telephone={telephone}
              pdfUrl={accord.pdf_url}
            />
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Copie au client
              </h4>
              <EnvoyerCopieButton
                accordId={accord.id}
                clientEmail={accord.client_email}
                pdfUrl={accord.pdf_url}
                copieEnvoyeeAt={accord.copie_envoyee_at}
              />
            </div>
          </section>
        )}

        {accord.statut === 'REFUSE' && (
          <section className="bg-white rounded-2xl shadow-sm border border-red-200 p-5 space-y-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-600">
              Accord refusé par le client
            </h3>
            <p className="text-sm text-slate-600">
              {accord.motif_refus ? `Motif : ${accord.motif_refus}` : 'Aucun motif renseigné.'}
            </p>
          </section>
        )}

        {accord.statut === 'ANNULE' && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Accord annulé.</p>
          </section>
        )}
      </main>
    </div>
  )
}
