import { NextResponse } from "next/server"
import { listGmbLocations } from "@/lib/gmb"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * GET /api/gmb/locations — liste les comptes Google Business connectés
 * et leurs fiches d'établissement (pour récupérer le location ID à publier).
 */
export async function GET() {
  try {
    const locations = await listGmbLocations()
    return NextResponse.json({ ok: true, count: locations.length, locations })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur GMB" },
      { status: 500 },
    )
  }
}
