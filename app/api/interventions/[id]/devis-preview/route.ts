import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { buildDevisFromRapport } from "@/lib/rapportToDevis"

export const dynamic = "force-dynamic"

type Params = { params: { id: string } }

/** GET — préremplit un devis à partir du rapport (sans persister). */
export async function GET(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const interventionId = params.id
  if (!interventionId) return NextResponse.json({ error: "ID intervention manquant" }, { status: 400 })

  const { data: interv, error: intErr } = await sb
    .from("interventions")
    .select(
      "id, reference, client_id, agence, type_intervention, adresse_chantier, ville, code_postal, date_realisee, date_prevue, rapport_json",
    )
    .eq("id", interventionId)
    .maybeSingle()
  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  if (!interv.rapport_json || Object.keys(interv.rapport_json).length === 0) {
    return NextResponse.json({ error: "Aucun rapport — complète l'étape rapport d'abord." }, { status: 400 })
  }

  let client: {
    nom: string | null
    email: string | null
    adresse: string | null
    code_postal: string | null
    ville: string | null
  } | null = null
  if (interv.client_id) {
    const { data: c } = await sb
      .from("clients")
      .select("nom, email, adresse, code_postal, ville")
      .eq("id", interv.client_id)
      .maybeSingle()
    client = c || null
  }

  const prefill = buildDevisFromRapport({
    rapport: interv.rapport_json,
    client_nom: client?.nom || null,
    client_email: client?.email || null,
    client_adresse: client?.adresse || null,
    client_code_postal: client?.code_postal || null,
    client_ville: client?.ville || null,
    adresse_chantier: interv.adresse_chantier || null,
    type_intervention: interv.type_intervention || null,
    date_intervention: interv.date_realisee || interv.date_prevue || null,
    reference: interv.reference || null,
  })

  return NextResponse.json({ prefill, agence: interv.agence })
}
