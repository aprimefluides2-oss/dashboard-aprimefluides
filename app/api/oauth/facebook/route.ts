import { NextResponse } from "next/server"
import { getFacebookAuthUrl } from "@/lib/social"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.redirect(getFacebookAuthUrl())
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "OAuth Facebook init failed" }, { status: 500 })
  }
}
