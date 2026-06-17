import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull, type DocumentStatut } from "@/lib/supabase"
import { cascadeDeleteDocument } from "@/lib/cascadeDelete"
import { annulerRelancesFacture } from "@/lib/facture-relance"

export const dynamic = 'force-dynamic'

const ALLOWED_STATUTS: DocumentStatut[] = [
  'brouillon', 'envoye', 'paye', 'annule', 'accepte', 'refuse', 'expire',
]

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }
  const id = ctx.params.id
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const { data, error } = await sb
    .from('documents')
    .select('id, type, numero, agence, date_emission, echeance, statut, montant_ht, montant_ttc, tva_taux, payload, pdf_url, envoye_email, envoye_at, intervention_id, client_id, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  // Décoration client : indispensable pour que ResendEmailButton / DocumentDownloadButton
  // puissent regénérer un PDF avec nom + adresse. Sans ça, les PDFs sortent vides.
  let client_nom: string | null = null
  let client_email: string | null = null
  let client_adresse: string | null = null
  let client_code_postal: string | null = null
  let client_ville: string | null = null
  if (data.client_id) {
    const { data: c } = await sb
      .from('clients')
      .select('nom, email, adresse, code_postal, ville')
      .eq('id', data.client_id)
      .maybeSingle()
    if (c) {
      client_nom = c.nom || null
      client_email = c.email || null
      client_adresse = c.adresse || null
      client_code_postal = c.code_postal || null
      client_ville = c.ville || null
    }
  }

  return NextResponse.json({
    document: {
      ...data,
      client_nom, client_email, client_adresse, client_code_postal, client_ville,
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const id = ctx.params.id
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  // Cascade : si le document est lié à une intervention, on efface l'intervention
  // complète (rapport + autres docs + photos + PDFs). Sinon, on efface juste le
  // document orphelin (rare : devis sans intervention par ex).
  const result = await cascadeDeleteDocument(id)

  if (result.kind === 'intervention') {
    if (!result.result.ok) {
      return NextResponse.json({
        error: 'Échec suppression en cascade',
        warnings: result.result.warnings,
      }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      cascade: 'intervention',
      intervention_id: result.result.intervention_id,
      deleted_documents: result.result.deleted_documents,
      deleted_photos: result.result.deleted_photos,
      deleted_pdfs: result.result.deleted_pdfs,
      warnings: result.result.warnings,
    })
  }

  if (!result.ok) {
    const isNotFound = result.warnings.some(w => w.includes('introuvable'))
    return NextResponse.json({
      error: result.warnings.join('; ') || 'Suppression échouée',
    }, { status: isNotFound ? 404 : 500 })
  }
  return NextResponse.json({ ok: true, cascade: 'document', warnings: result.warnings })
}

/**
 * Mise à jour partielle d'un document — typiquement le statut (paye, annule, envoye…).
 * Body attendu : { statut?: DocumentStatut, envoye_at?: string|null, envoye_email?: string|null }
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  const id = ctx.params.id
  if (!id) {
    return NextResponse.json({ error: 'id manquant' }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const update: Record<string, any> = {}
  if (typeof body.statut === 'string') {
    if (!ALLOWED_STATUTS.includes(body.statut as DocumentStatut)) {
      return NextResponse.json({ error: `Statut invalide. Attendus : ${ALLOWED_STATUTS.join(', ')}` }, { status: 400 })
    }
    update.statut = body.statut
  }
  if ('envoye_at' in body) update.envoye_at = body.envoye_at || null
  if ('envoye_email' in body) update.envoye_email = body.envoye_email || null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  if (update.statut === 'paye' || update.statut === 'annule') {
    try {
      await annulerRelancesFacture(id)
    } catch (e) {
      console.error('[historique PATCH] annuler relances facture', e)
    }
  }

  const { data, error } = await sb
    .from('documents')
    .update(update)
    .eq('id', id)
    .select('id, statut, envoye_at, envoye_email')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, document: data })
}
