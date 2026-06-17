import Link from "next/link"
import { getSupabaseOrNull, type Tarif } from "@/lib/supabase"
import { getParametre } from "@/lib/parametres"
import AccordForm, { type AccordPrefill } from "@/components/accord/AccordForm"

export const dynamic = 'force-dynamic'

async function loadTarifs(): Promise<Tarif[]> {
  const sb = getSupabaseOrNull()
  if (!sb) return []
  const { data, error } = await sb
    .from('tarifs')
    .select('*')
    .eq('actif', true)
    .order('label', { ascending: true })
  if (error) {
    console.error('[accord/nouveau] loadTarifs', error)
    return []
  }
  return (data as Tarif[]) || []
}

/** Forme minimale d'une fiche client lue pour le pré-remplissage. */
type ClientRow = {
  nom: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  telephone: string | null
  email: string | null
}

/** Pré-remplissage client depuis une intervention existante (rattachement optionnel). */
async function loadPrefill(interventionId: string): Promise<AccordPrefill | null> {
  const sb = getSupabaseOrNull()
  if (!sb) return null

  const { data: itvData, error } = await sb
    .from('interventions')
    .select('adresse_chantier, ville, code_postal, client_id')
    .eq('id', interventionId)
    .maybeSingle()
  if (error || !itvData) {
    if (error) console.error('[accord/nouveau] loadPrefill intervention', error)
    return null
  }
  const itv = itvData as {
    adresse_chantier: string | null
    ville: string | null
    code_postal: string | null
    client_id: string | null
  }

  let client: ClientRow | null = null
  if (itv.client_id) {
    const { data: cData } = await sb
      .from('clients')
      .select('nom, adresse, code_postal, ville, telephone, email')
      .eq('id', itv.client_id)
      .maybeSingle()
    client = (cData as ClientRow | null) ?? null
  }

  return {
    client_id: itv.client_id ?? null,
    client_nom: client?.nom || '',
    client_adresse: client?.adresse || itv.adresse_chantier || '',
    client_code_postal: client?.code_postal || itv.code_postal || '',
    client_ville: client?.ville || itv.ville || '',
    client_telephone: client?.telephone || '',
    client_email: client?.email || '',
  }
}

export default async function NouvelAccordPage({
  searchParams,
}: {
  searchParams: { intervention?: string }
}) {
  const interventionParam = searchParams.intervention || null

  const [tarifs, tvaStr, validiteStr, prefill] = await Promise.all([
    loadTarifs(),
    getParametre('TVA_TRAVAUX', '0'),
    getParametre('ACCORD_VALIDITE_JOURS', '30'),
    interventionParam ? loadPrefill(interventionParam) : Promise.resolve(null),
  ])

  // Si le paramètre intervention ne correspond à aucune intervention, on bascule
  // en accord autonome plutôt que de risquer une violation de clé étrangère.
  const interventionId = prefill ? interventionParam : null
  const tauxTVA = Number(tvaStr) || 0
  const validiteJours = Number(validiteStr) || 30

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-black text-lg sm:text-xl leading-tight">🤝 Nouvel accord</h1>
            <div className="text-[11px] opacity-70">
              {interventionId
                ? 'Devis détaillé · rattaché à une intervention'
                : 'Devis détaillé · accord signé avant travaux'}
            </div>
          </div>
          <Link
            href="/accord"
            className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition shrink-0"
          >
            ← Accords
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5">
        <AccordForm
          tarifs={tarifs}
          interventionId={interventionId}
          prefill={prefill}
          tauxTVA={tauxTVA}
          validiteJours={validiteJours}
        />
      </main>
    </div>
  )
}
