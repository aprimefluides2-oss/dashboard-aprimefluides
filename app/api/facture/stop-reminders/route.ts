import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { Resend } from "resend"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("p")
  const exp = req.nextUrl.searchParams.get("exp")
  const sig = req.nextUrl.searchParams.get("sig")
  if (!p || !exp || !sig) {
    return new NextResponse("Lien invalide.", { status: 400 })
  }

  const secret = process.env.REVIEW_STOP_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) return new NextResponse("Configuration manquante.", { status: 500 })

  const expected = crypto.createHmac("sha256", secret).update(`${p}.${exp}`).digest("hex")
  if (sig !== expected || Date.now() > Number(exp)) {
    return new NextResponse("Lien expiré ou invalide.", { status: 403 })
  }

  let ids: string[] = []
  try {
    const parsed = JSON.parse(Buffer.from(p, "base64url").toString("utf-8"))
    if (parsed?.kind === "facture" && Array.isArray(parsed.ids)) ids = parsed.ids
  } catch {
    return new NextResponse("Payload invalide.", { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  let canceledCount = 0
  if (resendKey && ids.length > 0) {
    const resend = new Resend(resendKey)
    for (const id of ids) {
      try {
        await resend.emails.cancel(id)
        canceledCount++
      } catch {
        /* ignore */
      }
    }
  }

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relances arrêtées</title></head><body style="font-family:Arial,sans-serif;background:#f4f6fa;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;border:1px solid #e1e6ef"><h1 style="margin:0 0 10px;color:#0e2a52">Relances facture arrêtées</h1><p style="margin:0;color:#334155">C'est bon — les relances automatiques hebdomadaires ont été annulées (${canceledCount}/${ids.length}).</p></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  )
}
