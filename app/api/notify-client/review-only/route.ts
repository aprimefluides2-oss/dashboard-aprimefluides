import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { EMAIL_RE, escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"
import { getTelPrincipal } from "@/lib/parametres"

/**
 * Envoie UNIQUEMENT un email de demande d'avis Google (sans rapport en pièce jointe,
 * sans les 3 relances programmées de /api/notify-client). Utilisé depuis /historique
 * pour relancer manuellement un client à la demande de l'admin, sans risquer de
 * spammer un client qui a déjà reçu la séquence complète au moment de l'envoi du rapport.
 */
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const { clientEmail, clientNom, ville, technicienNom } = body || {}

  if (!clientEmail || typeof clientEmail !== 'string' || !EMAIL_RE.test(clientEmail)) {
    return NextResponse.json({ error: 'Email client invalide' }, { status: 400 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY manquante' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmail = getResendFromEmail()
  const recipient = getResendRecipient(clientEmail)
  const reviewUrl = process.env.GOOGLE_REVIEW_URL
    || 'https://www.google.com/maps/place/Les+Techniciens+du+Débouchage'
  const tech = technicienNom || 'votre technicien'

  const tel = await getTelPrincipal()

  const result = await resend.emails.send({
    from: `Aprime fluides <${fromEmail}>`,
    to: recipient,
    subject: 'Votre avis nous serait précieux',
    html: emailReviewOnly({ clientNom, technicienNom: tech, ville, reviewUrl, tel }),
  })

  if (result.error) {
    return NextResponse.json({
      error: `Resend a rejeté l'envoi : ${result.error.message || JSON.stringify(result.error)}`,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: result.data?.id })
}

function emailReviewOnly({ clientNom, technicienNom, ville, reviewUrl, tel }: {
  clientNom?: string | null
  technicienNom: string
  ville?: string | null
  reviewUrl: string
  tel: string
}) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || '')
  const ru = encodeURI(reviewUrl)

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:#0e2a52;padding:24px;color:#fff;text-align:center">
        <div style="font-size:36px">⭐⭐⭐⭐⭐</div>
        <h1 style="margin:10px 0 0;font-size:20px">Votre avis compte pour nous</h1>
      </td></tr>
      <tr><td style="padding:30px;color:#1a1a1a">
        <p>Bonjour ${cn},</p>
        <p>Suite à notre intervention${v ? ` à <strong>${v}</strong>` : ''}, votre satisfaction est notre priorité.</p>
        <p>Si vous êtes satisfait, prenez <strong>moins d'une minute</strong> pour partager votre expérience sur Google. Cela nous aide énormément à faire connaître notre travail.</p>
        <div style="text-align:center;margin:30px 0">
          <a href="${ru}" style="display:inline-block;background:#e67e22;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px">⭐ Laisser un avis sur Google</a>
        </div>
        <p style="font-size:13px;color:#666">Merci pour votre confiance,<br><strong>${tn}</strong> — Expert en assainissement<br>Aprime fluides</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:14px;text-align:center;font-size:11px">
        Aprime fluides · ${escapeHtml(tel)} · www.aprime-fluide.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
