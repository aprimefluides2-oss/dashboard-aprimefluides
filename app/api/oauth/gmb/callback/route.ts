import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeAndStore } from "@/lib/gmb"

export const dynamic = "force-dynamic"

/** GET /api/oauth/gmb/callback — réception du code OAuth, stockage du jeton. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const error = req.nextUrl.searchParams.get("error")
  if (error) {
    return NextResponse.redirect(
      new URL(`/?gmb_oauth=error&reason=${encodeURIComponent(error)}`, req.url),
    )
  }
  if (!code) {
    return NextResponse.json({ error: "Code OAuth manquant" }, { status: 400 })
  }
  try {
    const { email } = await exchangeCodeAndStore(code)
    const target = new URL("/", req.url)
    target.searchParams.set("gmb_oauth", "ok")
    if (email) target.searchParams.set("email", email)
    return NextResponse.redirect(target)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OAuth GMB callback échoué" },
      { status: 500 },
    )
  }
}
