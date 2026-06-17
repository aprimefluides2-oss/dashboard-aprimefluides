import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

type Body = { motif?: string | null }

/**
 * POST /api/accords/[id]/refus — le client refuse de valider l'accord.
 * Trace le refus (statut REFUSE + motif), protection en cas de litige inverse.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const accordId = params.id
  if (!accordId) return NextResponse.json({ error: 'ID accord manquant' }, { status: 400 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const { data: accord } = await sb
    .from('accords_intervention')
    .select('id, statut')
    .eq('id', accordId)
    .maybeSingle()
  if (!accord) return NextResponse.json({ error: 'Accord introuvable' }, { status: 404 })
  if (accord.statut !== 'BROUILLON') {
    return NextResponse.json(
      { error: `Accord déjà « ${String(accord.statut).toLowerCase()} » — refus impossible.` },
      { status: 409 },
    )
  }

  const motif = (body.motif || '').trim() || null

  const { error } = await sb
    .from('accords_intervention')
    .update({ statut: 'REFUSE', motif_refus: motif })
    .eq('id', accordId)
  if (error) {
    return NextResponse.json({ error: `DB update échouée : ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
