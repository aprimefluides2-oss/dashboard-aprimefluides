import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import crypto from "crypto"

function verifySignature(payload: string, exp: number, sig: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(`${payload}.${exp}`).digest("hex")
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
}

export async function GET(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return new NextResponse("Configuration email manquante.", { status: 500 })

  const payload = req.nextUrl.searchParams.get("p") || ""
  const expRaw = req.nextUrl.searchParams.get("exp") || ""
  const sig = req.nextUrl.searchParams.get("sig") || ""
  if (!payload || !expRaw || !sig) return new NextResponse("Lien invalide.", { status: 400 })

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || Date.now() > exp) return new NextResponse("Lien expiré.", { status: 400 })

  const signSecret = process.env.REVIEW_STOP_SECRET || process.env.NEXTAUTH_SECRET || resendKey
  try {
    if (!verifySignature(payload, exp, sig, signSecret)) return new NextResponse("Signature invalide.", { status: 403 })
  } catch {
    return new NextResponse("Signature invalide.", { status: 403 })
  }

  let ids: string[] = []
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf-8")
    const parsed = JSON.parse(decoded) as { ids?: string[] }
    ids = Array.isArray(parsed.ids) ? parsed.ids.filter(Boolean) : []
  } catch {
    return new NextResponse("Lien invalide.", { status: 400 })
  }

  if (ids.length === 0) return new NextResponse("Aucune relance à annuler.", { status: 400 })

  const resend = new Resend(resendKey)
  const results = await Promise.all(ids.map((id) => resend.emails.cancel(id)))
  const canceledCount = results.filter((r) => !r.error).length

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relances devis arrêtées</title></head><body style="font-family:Arial,sans-serif;background:#f4f6fa;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;border:1px solid #e1e6ef"><h1 style="margin:0 0 10px;color:#0e2a52">Relances devis arrêtées</h1><p style="margin:0;color:#334155">C'est bon, vous ne recevrez plus de relance pour ce devis. Relances annulées: ${canceledCount}/${ids.length}.</p></div></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  )
}
