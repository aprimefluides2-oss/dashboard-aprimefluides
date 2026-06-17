import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/youtube"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const url = getAuthUrl()
    return NextResponse.redirect(url)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "OAuth init failed" }, { status: 500 })
  }
}
