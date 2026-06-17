import { NextRequest, NextResponse } from "next/server"
import { persistAttestation } from "@/lib/persist"

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body?.attestation || typeof body.attestation !== 'object') {
    return NextResponse.json({ error: 'Champ attestation manquant' }, { status: 400 })
  }

  try {
    const id = await persistAttestation({ ...body, emailSent: false })
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
