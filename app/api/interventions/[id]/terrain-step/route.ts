import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

type Action = 'debut' | 'fin' | 'set'

/**
 * Endpoint atomique pour faire avancer l'intervention dans le wizard Mode Terrain.
 *
 * Body JSON :
 *   { action: 'debut' }                       → heure_debut_reelle = now(), statut=en_cours, step=2
 *   { action: 'fin' }                         → heure_fin_reelle = now(), statut=terminee
 *   { action: 'set', step: 0..8 }             → set explicite (utile pour "Passer" / revenir en arrière)
 *
 * Réponse : { intervention: <row complète> }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: 'ID intervention manquant' }, { status: 400 })
  }

  let body: { action?: Action; step?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const action = body.action
  if (action !== 'debut' && action !== 'fin' && action !== 'set') {
    return NextResponse.json({ error: 'Action invalide (debut | fin | set)' }, { status: 400 })
  }

  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, terrain_step, statut')
    .eq('id', interventionId)
    .maybeSingle()
  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  const update: Record<string, unknown> = {}
  const now = new Date().toISOString()

  if (action === 'debut') {
    update.heure_debut_reelle = now
    update.statut = 'en_cours'
    // Avance le step à 2 (= en cours / travaux) si pas déjà plus loin
    if ((interv.terrain_step ?? 0) < 2) update.terrain_step = 2
  } else if (action === 'fin') {
    update.heure_fin_reelle = now
    update.statut = 'terminee'
    update.date_realisee = now.slice(0, 10)
    // On NE bump PAS terrain_step ici : la fin du chrono ≠ fin du wizard.
    // Le wizard continue ensuite : photo après, rapport, facture, envoi.
  } else if (action === 'set') {
    const step = Number(body.step)
    if (!Number.isInteger(step) || step < 0 || step > 8) {
      return NextResponse.json({ error: 'step doit être un entier entre 0 et 8' }, { status: 400 })
    }
    update.terrain_step = step
  }

  const { data, error } = await sb
    .from('interventions')
    .update(update)
    .eq('id', interventionId)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ intervention: data })
}
