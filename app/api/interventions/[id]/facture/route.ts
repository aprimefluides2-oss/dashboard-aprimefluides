import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/**
 * Retourne la dernière facture liée à cette intervention (avec son payload complet).
 * Utilisé par le wizard Mode Terrain à l'étape d'envoi pour générer le PDF.
 *
 * GET /api/interventions/[id]/facture
 *   → { facture: { id, numero, montant_ht, montant_ttc, tva_taux, pdf_url, payload } | null }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  // range(0, 0) au lieu de limit(1) : avec limit + order + select large
  // (payload jsonb), PostgREST/supabase-js drop silencieusement la ligne la
  // plus récente (bug déjà documenté dans ce projet, cf. /api/historique).
  // Sur une intervention avec UNE seule facture → 0 résultat → "Facture
  // introuvable" à l'étape d'envoi du wizard. range() passe par le header
  // Range et n'est pas affecté.
  const { data, error } = await sb
    .from('documents')
    .select('id, numero, montant_ht, montant_ttc, tva_taux, pdf_url, payload, agence, date_emission, echeance, statut')
    .eq('intervention_id', params.id)
    .eq('type', 'facture')
    .order('created_at', { ascending: false })
    .range(0, 0)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ facture: data?.[0] || null })
}
