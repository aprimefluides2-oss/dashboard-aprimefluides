import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { fmtEUR } from "@/lib/format"
import { getSupabaseOrNull } from "@/lib/supabase"
import { getTelPrincipal } from "@/lib/parametres"

export const maxDuration = 30

/**
 * Envoie un email de relance pour une facture impayée.
 * Le client régénère le PDF depuis le payload Supabase et le fournit en base64.
 * À l'envoi réussi : met à jour `envoye_at` du document (mais conserve son statut).
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const {
    documentId,
    clientEmail, clientNom, technicienNom, ville, dateFacture,
    numero, totalTTC, echeance, agence, pdfBase64, pdfFilename,
    daysOverdue, dueDate,
  } = body

  const ctx = initResend(clientEmail)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { resend, fromEmail, recipient } = ctx

  const tech = technicienNom || 'votre technicien'
  const attachments = pdfBase64 && pdfFilename
    ? [{ filename: pdfFilename, content: pdfBase64 }]
    : undefined

  const subject = numero
    ? `Relance — Facture ${numero} en attente de règlement`
    : `Relance — Facture en attente de règlement`

  const tel = await getTelPrincipal()

  const result = await resend.emails.send({
    from: `Aprime fluides <${fromEmail}>`,
    to: recipient,
    subject,
    html: emailRelance({
      clientNom, technicienNom: tech, ville, dateFacture, numero,
      totalTTC, echeance, agence, daysOverdue, dueDate, tel,
    }),
    attachments,
  })

  if (result.error) {
    return NextResponse.json({
      error: `Resend a rejeté l'envoi : ${result.error.message || JSON.stringify(result.error)}`,
    }, { status: 500 })
  }

  // Mise à jour `envoye_at` côté DB (best-effort, non bloquant)
  if (documentId) {
    const sb = getSupabaseOrNull()
    if (sb) {
      sb.from('documents')
        .update({ envoye_at: new Date().toISOString(), envoye_email: clientEmail || null })
        .eq('id', documentId)
        .then(({ error }) => {
          if (error) console.error('[notify-facture/relance] update envoye_at', error)
        })
    }
  }

  return NextResponse.json({ ok: true, id: result.data?.id })
}

function emailRelance({
  clientNom, technicienNom, ville, dateFacture, numero, totalTTC,
  echeance, agence, daysOverdue, dueDate, tel,
}: {
  clientNom?: string; technicienNom: string; ville?: string; dateFacture?: string;
  numero?: string; totalTTC?: number; echeance?: string; agence?: string;
  daysOverdue?: number; dueDate?: string; tel: string;
}) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || '')
  const dd = escapeHtml(dateFacture || '')
  const num = escapeHtml(numero || '')
  const ag = escapeHtml(agence || '')
  const ttc = typeof totalTTC === 'number' ? fmtEUR(totalTTC) : ''
  const ech = escapeHtml(echeance || 'À réception')
  const overdue = typeof daysOverdue === 'number' && daysOverdue > 0
  const overdueLabel = overdue
    ? `Échéance dépassée de ${daysOverdue} jour${daysOverdue > 1 ? 's' : ''}`
    : 'Règlement attendu'
  const dueLabel = dueDate ? escapeHtml(dueDate) : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#b91c1c,#dc2626);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Relance — Facture impayée</div>
        <h1 style="margin:0;font-size:22px">${num ? `Facture ${num}` : 'Votre facture'}</h1>
        <p style="margin:6px 0 0;opacity:.9;font-size:13px"><strong>${overdueLabel}</strong></p>
      </td></tr>
      <tr><td style="padding:30px">
        <p>Bonjour ${cn},</p>
        <p>Sauf erreur de notre part, nous n'avons pas encore reçu le règlement de la facture ci-jointe${num ? ` n°<strong>${num}</strong>` : ''}${v ? `, relative à notre intervention à <strong>${v}</strong>` : ''}${dd ? ` du ${dd}` : ''}.</p>
        ${ttc || dueLabel ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          ${ttc ? `<tr><td style="background:#f8fafc;padding:16px 20px;color:#475569;font-size:13px">Montant dû TTC</td>
              <td style="background:#f8fafc;padding:16px 20px;text-align:right;color:#b91c1c;font-size:18px;font-weight:bold">${ttc}</td></tr>` : ''}
          <tr><td style="padding:14px 20px;color:#475569;font-size:13px;border-top:1px solid #e2e8f0">Échéance</td>
              <td style="padding:14px 20px;text-align:right;color:#0e2a52;font-size:14px;font-weight:bold;border-top:1px solid #e2e8f0">${ech}${dueLabel ? ` — ${dueLabel}` : ''}</td></tr>
          ${overdue ? `<tr><td style="padding:14px 20px;color:#475569;font-size:13px;border-top:1px solid #e2e8f0">Retard</td>
              <td style="padding:14px 20px;text-align:right;color:#b91c1c;font-size:14px;font-weight:bold;border-top:1px solid #e2e8f0">${daysOverdue} jour${daysOverdue! > 1 ? 's' : ''}</td></tr>` : ''}
        </table>` : ''}
        <p style="font-size:14px">Si le règlement vient de nous parvenir, merci de ne pas tenir compte de cet email. Dans le cas contraire, merci de procéder au paiement dans les meilleurs délais.</p>
        <p style="font-size:14px">Pour toute question ou pour régler par téléphone, contactez-nous au <strong>${escapeHtml(tel)}</strong> ou répondez à ce mail.</p>
        <p style="margin-top:30px;font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong>${ag ? ` — ${ag}` : ''}<br>Aprime fluides</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Aprime fluides · ${escapeHtml(tel)} · www.aprime-fluide.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
