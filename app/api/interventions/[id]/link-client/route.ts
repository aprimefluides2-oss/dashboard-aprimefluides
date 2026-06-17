import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull, upsertClient, patchClient } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/**
 * (Re)lie un client à une intervention depuis le wizard Mode Terrain.
 *
 * - Intervention déjà liée à un client → patch non destructif de la fiche
 *   (le technicien a saisi / corrigé le nom ou l'email à l'étape d'envoi).
 * - Intervention sans client → upsert d'un client (dédup par email puis
 *   nom+ville) puis rattachement via `client_id`.
 *
 * Filet de sécurité pour les interventions arrivées à l'étape d'envoi sans
 * client lié (interventions saisies avant le correctif du wipe `persistRapport`).
 *
 * Body     : { nom: string, email?: string }
 * Réponse  : { client: { id, nom, email, telephone, adresse, code_postal, ville } }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  let body: { nom?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const nom = (body.nom || '').trim()
  const email = (body.email || '').trim()
  if (!nom) {
    return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 })
  }

  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, client_id, ville, code_postal')
    .eq('id', params.id)
    .maybeSingle()
  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  let clientId: string | null = interv.client_id

  if (clientId) {
    // Client déjà lié → patch non destructif (nom / email saisis dans le wizard).
    await patchClient(clientId, { nom, email: email || null })
  } else {
    // Pas de client → upsert puis rattachement.
    clientId = await upsertClient({
      nom,
      email: email || null,
      ville: interv.ville || null,
      code_postal: interv.code_postal || null,
    })
    if (!clientId) {
      return NextResponse.json({ error: 'Création du client impossible' }, { status: 500 })
    }
    const { error: linkErr } = await sb
      .from('interventions')
      .update({ client_id: clientId })
      .eq('id', params.id)
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
  }

  const { data: client } = await sb
    .from('clients')
    .select('id, nom, email, telephone, adresse, code_postal, ville')
    .eq('id', clientId)
    .maybeSingle()

  return NextResponse.json({ client })
}
