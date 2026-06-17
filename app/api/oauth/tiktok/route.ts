import { NextResponse } from "next/server"
import { getTikTokAuthUrl } from "@/lib/social"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.redirect(getTikTokAuthUrl())
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "OAuth TikTok init failed" }, { status: 500 })
  }
}
