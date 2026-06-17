import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/**
 * POST /api/accords/[id]/annuler — annule un accord encore en brouillon.
 * Un accord VALIDE (signé) ou REFUSE n'est pas annulable depuis l'app : il
 * constitue une preuve et reste tel quel.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const accordId = params.id
  if (!accordId) return NextResponse.json({ error: 'ID accord manquant' }, { status: 400 })

  const { data: accord } = await sb
    .from('accords_intervention')
    .select('id, statut')
    .eq('id', accordId)
    .maybeSingle()
  if (!accord) return NextResponse.json({ error: 'Accord introuvable' }, { status: 404 })
  if (accord.statut !== 'BROUILLON') {
    return NextResponse.json(
      { error: `Accord « ${String(accord.statut).toLowerCase()} » — annulation impossible.` },
      { status: 409 },
    )
  }

  const { error } = await sb
    .from('accords_intervention')
    .update({ statut: 'ANNULE' })
    .eq('id', accordId)
  if (error) {
    return NextResponse.json({ error: `DB update échouée : ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
