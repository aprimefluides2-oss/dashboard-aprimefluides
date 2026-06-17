import { NextRequest, NextResponse } from "next/server"
import { exchangeFacebookCode } from "@/lib/social"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const error = req.nextUrl.searchParams.get("error")
  if (error) {
    return NextResponse.redirect(new URL(`/?facebook_oauth=error&reason=${encodeURIComponent(error)}`, req.url))
  }
  if (!code) {
    return NextResponse.json({ error: "Code OAuth manquant" }, { status: 400 })
  }
  try {
    const { email } = await exchangeFacebookCode(code)
    const target = new URL("/", req.url)
    target.searchParams.set("facebook_oauth", "ok")
    if (email) target.searchParams.set("fb_page", encodeURIComponent(email))
    return NextResponse.redirect(target)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "OAuth Facebook callback failed" }, { status: 500 })
  }
}
