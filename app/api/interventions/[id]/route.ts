import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { isCanalAcquisition } from "@/lib/canaux"
import { cascadeDeleteIntervention } from "@/lib/cascadeDelete"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

const UPDATABLE = new Set([
  'statut',
  'technicien_id',
  'agence',
  'type_intervention',
  'adresse_chantier',
  'ville',
  'code_postal',
  'date_prevue',
  'heure_prevue',
  'duree_estimee_min',
  'urgence',
  'prix_prevu',
  'notes_internes',
  'date_realisee',
  'canal_acquisition',
])

const ALLOWED_STATUTS = new Set(['planifiee', 'en_cours', 'terminee', 'annulee'])

export async function GET(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  const id = params.id
  const { data: intervention, error } = await sb
    .from('interventions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!intervention) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  let client = null
  if (intervention.client_id) {
    const { data: c } = await sb
      .from('clients')
      .select('id, nom, email, telephone, adresse, code_postal, ville')
      .eq('id', intervention.client_id)
      .maybeSingle()
    client = c || null
  }

  let technicien = null
  if (intervention.technicien_id) {
    const { data: t } = await sb
      .from('techniciens')
      .select('id, nom, email, telephone, agence')
      .eq('id', intervention.technicien_id)
      .maybeSingle()
    technicien = t || null
  }

  const { data: devisDoc } = await sb
    .from('documents')
    .select('id')
    .eq('intervention_id', id)
    .eq('type', 'devis')
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    intervention,
    client,
    technicien,
    has_devis: !!devisDoc?.id,
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  // Champs texte : trim + '' → null. Évite de stocker des chaînes vides et
  // qu'un PUT partiel mal formé n'écrase une colonne avec du vide brut. Les
  // autres champs (statut, ids, nombres, urgence) passent tels quels.
  const TEXT_FIELDS = new Set([
    'agence', 'type_intervention', 'adresse_chantier', 'ville', 'code_postal',
    'date_prevue', 'heure_prevue', 'notes_internes', 'date_realisee',
  ])
  const update: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!UPDATABLE.has(k) || v === undefined) continue
    if (typeof v === 'string' && TEXT_FIELDS.has(k)) {
      const trimmed = v.trim()
      update[k] = trimmed === '' ? null : trimmed
    } else {
      update[k] = v
    }
  }

  if (typeof update.statut === 'string' && !ALLOWED_STATUTS.has(update.statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  if ('canal_acquisition' in update) {
    const v = update.canal_acquisition
    update.canal_acquisition = (v === null || v === '') ? null : (isCanalAcquisition(v) ? v : null)
  }

  // Auto-set date_realisee when moving to terminee
  if (update.statut === 'terminee' && !('date_realisee' in update)) {
    update.date_realisee = new Date().toISOString().slice(0, 10)
  }

  if (typeof update.heure_prevue === 'string' && /^\d{2}:\d{2}/.test(update.heure_prevue)) {
    update.heure_prevue = (update.heure_prevue as string).slice(0, 5)
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('interventions')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ intervention: data })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const hard = url.searchParams.get('hard') === '1'

  if (hard) {
    // Suppression définitive en cascade : intervention + documents liés + photos
    // + PDFs Storage. Préférence utilisateur explicite (UI "Tout effacer").
    const result = await cascadeDeleteIntervention(params.id)
    if (!result.ok) {
      return NextResponse.json({
        error: 'Échec suppression en cascade',
        warnings: result.warnings,
      }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      hard: true,
      cascade: true,
      deleted_documents: result.deleted_documents,
      deleted_photos: result.deleted_photos,
      deleted_pdfs: result.deleted_pdfs,
      warnings: result.warnings,
    })
  }

  // Soft delete : statut=annulee (par défaut, préserve l'historique)
  const { data, error } = await sb
    .from('interventions')
    .update({ statut: 'annulee' })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ intervention: data, soft: true })
}
