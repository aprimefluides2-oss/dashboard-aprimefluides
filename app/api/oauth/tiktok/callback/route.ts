import { NextRequest, NextResponse } from "next/server"
import { exchangeTikTokCode } from "@/lib/social"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const error = req.nextUrl.searchParams.get("error")
  if (error) {
    return NextResponse.redirect(new URL(`/?tiktok_oauth=error&reason=${encodeURIComponent(error)}`, req.url))
  }
  if (!code) {
    return NextResponse.json({ error: "Code OAuth manquant" }, { status: 400 })
  }
  try {
    const { email } = await exchangeTikTokCode(code)
    const target = new URL("/", req.url)
    target.searchParams.set("tiktok_oauth", "ok")
    if (email) target.searchParams.set("tiktok_user", encodeURIComponent(email))
    return NextResponse.redirect(target)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "OAuth TikTok callback failed" }, { status: 500 })
  }
}
