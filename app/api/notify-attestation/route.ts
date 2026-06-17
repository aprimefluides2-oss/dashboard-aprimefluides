import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { persistAttestation } from "@/lib/persist"
import { getTelPrincipal } from "@/lib/parametres"

export const maxDuration = 30

const VARIANT_LABELS: Record<string, string> = {
  'tout-a-legout': 'Tout-à-l\'égout',
  'fosse-septique': 'Fosse septique',
  'non-conforme': 'Non-conforme',
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const {
    clientEmail, clientNom, technicienNom, ville, dateAttestation, numero, variante, pdfBase64, pdfFilename,
    attestation, agence, clientAdresse, clientCP,
  } = body

  const ctx = initResend(clientEmail)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { resend, fromEmail, recipient } = ctx

  const tech = technicienNom || 'votre technicien'
  const attachments = pdfBase64 && pdfFilename
    ? [{ filename: pdfFilename, content: pdfBase64 }]
    : undefined

  const variantLabel = VARIANT_LABELS[variante] || variante || 'Inspection'

  const subject = numero
    ? `Votre attestation ${numero} — ${variantLabel}`
    : `Votre attestation d'inspection — ${variantLabel}`

  const tel = await getTelPrincipal()

  const result = await resend.emails.send({
    from: `Aprime fluides <${fromEmail}>`,
    to: recipient,
    subject,
    html: emailAttestation({ clientNom, technicienNom: tech, ville, dateAttestation, variantLabel, numero, tel }),
    attachments,
  })

  if (result.error) {
    return NextResponse.json({
      error: `Resend a rejeté l'envoi : ${result.error.message || JSON.stringify(result.error)}`,
      hint: result.error.name === 'validation_error'
        ? "Vérifie que ton domaine est bien vérifié sur https://resend.com/domains, ou définis RESEND_TEST_EMAIL pour rediriger les envois en attendant."
        : undefined,
    }, { status: 500 })
  }

  let docId: string | null = null
  let persistError: string | null = null
  if (attestation || numero || variante) {
    try {
      docId = await persistAttestation({
        attestation, clientNom, clientEmail, clientAdresse, clientCP, ville,
        agence, numero, variante, dateAttestation,
        emailSent: true,
      })
      if (!docId) persistError = "Sauvegarde DB impossible (vérifie les logs serveur)"
    } catch (e: any) {
      persistError = e?.message || 'Erreur de sauvegarde DB'
      console.error('[notify-attestation] persist', e)
    }
  }

  return NextResponse.json({
    ok: true,
    id: result.data?.id,
    docId,
    ...(persistError ? { warning: `Email envoyé mais l'attestation n'a PAS été enregistrée en base : ${persistError}` } : {}),
  })
}

function emailAttestation({ clientNom, technicienNom, ville, dateAttestation, variantLabel, numero, tel }: {
  clientNom?: string; technicienNom: string; ville?: string; dateAttestation?: string; variantLabel: string; numero?: string; tel: string;
}) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || '')
  const di = escapeHtml(dateAttestation || '')
  const vl = escapeHtml(variantLabel)
  const num = escapeHtml(numero || '')
  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0f2e5c,#25477f);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Document officiel</div>
        <h1 style="margin:0;font-size:22px">Votre attestation d'inspection</h1>
        ${num ? `<p style="margin:6px 0 0;opacity:.85;font-size:13px">Référence ${num}</p>` : ''}
      </td></tr>
      <tr><td style="padding:30px">
        <p>Bonjour ${cn},</p>
        <p>Suite à l'inspection${v ? ` réalisée à <strong>${v}</strong>` : ''}${di ? ` le <strong>${di}</strong>` : ''}, vous trouverez ci-joint votre <strong>attestation officielle</strong> (variante : ${vl}).</p>
        <p>Ce document peut être transmis à votre notaire, à votre syndic ou à toute partie qui en ferait la demande dans le cadre d'une transaction immobilière ou d'un suivi technique.</p>
        <p>Pour toute question, n'hésitez pas à nous contacter au <strong>${escapeHtml(tel)}</strong>.</p>
        <p style="margin-top:30px;font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong> — Expert en assainissement<br>Aprime fluides</p>
      </td></tr>
      <tr><td style="background:#0f2e5c;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Aprime fluides · ${escapeHtml(tel)} · www.aprime-fluide.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
