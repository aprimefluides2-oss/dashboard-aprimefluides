import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

const UPDATABLE = new Set(['nom', 'email', 'telephone', 'adresse', 'code_postal', 'ville'])

/** GET /api/clients/[id] — fiche client. */
export async function GET(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const { data, error } = await sb
    .from('clients')
    .select('id, nom, email, telephone, adresse, code_postal, ville')
    .eq('id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  return NextResponse.json({ client: data })
}

/**
 * PATCH /api/clients/[id] — met à jour les champs autorisés d'un client.
 * Body : { nom?, email?, telephone?, adresse?, code_postal?, ville? }
 * Utilisé notamment par le wizard Mode Terrain pour compléter un nom manquant
 * sans quitter le flux d'envoi.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!UPDATABLE.has(k)) continue
    if (typeof v === 'string') {
      const trimmed = v.trim()
      update[k] = trimmed === '' ? null : trimmed
    } else if (v === null) {
      update[k] = null
    }
  }

  if (typeof update.nom === 'string' && update.nom.length === 0) {
    return NextResponse.json({ error: 'Le nom ne peut pas être vide' }, { status: 400 })
  }
  if ('nom' in update && update.nom === null) {
    return NextResponse.json({ error: 'Le nom ne peut pas être vide' }, { status: 400 })
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('clients')
    .update(update)
    .eq('id', params.id)
    .select('id, nom, email, telephone, adresse, code_postal, ville')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  return NextResponse.json({ client: data })
}

/**
 * DELETE /api/clients/[id] — supprime un client.
 * Refuse (409) si le client a des interventions ou documents liés :
 * il faut d'abord les supprimer pour préserver la cohérence de l'historique.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const id = params.id
  if (!id) return NextResponse.json({ error: 'ID client manquant' }, { status: 400 })

  // Garde : refuse la suppression si des entités sont rattachées
  const [{ count: nbInterventions }, { count: nbDocuments }] = await Promise.all([
    sb.from('interventions').select('id', { count: 'exact', head: true }).eq('client_id', id),
    sb.from('documents').select('id', { count: 'exact', head: true }).eq('client_id', id),
  ])
  const interventions = nbInterventions || 0
  const documents = nbDocuments || 0
  if (interventions > 0 || documents > 0) {
    const parts: string[] = []
    if (interventions > 0) parts.push(`${interventions} intervention${interventions > 1 ? 's' : ''}`)
    if (documents > 0) parts.push(`${documents} document${documents > 1 ? 's' : ''} (factures/devis)`)
    return NextResponse.json({
      error: `Impossible de supprimer ce client : ${parts.join(' et ')} y ${interventions + documents > 1 ? 'sont' : 'est'} rattaché${interventions + documents > 1 ? 's' : ''}. Supprime-les d'abord.`,
      interventions,
      documents,
    }, { status: 409 })
  }

  const { data: deleted, error } = await sb
    .from('clients')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: 'Client introuvable (peut-être déjà supprimé)' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
