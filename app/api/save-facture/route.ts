import { NextRequest, NextResponse } from "next/server"
import { persistFacture } from "@/lib/persist"

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body?.facture || typeof body.facture !== 'object') {
    return NextResponse.json({ error: 'Champ facture manquant' }, { status: 400 })
  }

  try {
    const id = await persistFacture({ ...body, emailSent: false })
    if (!id) {
      return NextResponse.json({
        error: "Sauvegarde impossible (Supabase non configuré ou erreur d'insertion)",
      }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur de sauvegarde' }, { status: 500 })
  }
}
