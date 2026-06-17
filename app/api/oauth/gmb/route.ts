import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/gmb"

export const dynamic = "force-dynamic"

/** GET /api/oauth/gmb — démarre la connexion OAuth Google Business Profile. */
export async function GET() {
  try {
    return NextResponse.redirect(await getAuthUrl())
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OAuth GMB : initialisation impossible" },
      { status: 500 },
    )
  }
}
