import { NextRequest, NextResponse } from "next/server"
import { persistRapport } from "@/lib/persist"

export const dynamic = 'force-dynamic'

/**
 * Enregistre un rapport d'intervention dans Supabase sans le publier sur le site.
 * Permet à l'utilisateur de retrouver son brouillon dans l'historique pour le
 * télécharger / le facturer plus tard.
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body?.rapport || typeof body.rapport !== 'object') {
    return NextResponse.json({ error: 'Champ rapport manquant' }, { status: 400 })
  }

  const result = await persistRapport({
    interventionId: body.interventionId || null,
    clientNom: body.clientNom,
    clientEmail: body.clientEmail,
    clientAdresse: body.clientAdresse,
    ville: body.ville,
    codePostal: body.codePostal,
    typeIntervention: body.typeIntervention,
    dateIntervention: body.dateIntervention,
    transcription: body.transcription,
    rapport: body.rapport,
    seo: body.seo,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: result.id, mode: result.mode })
}
