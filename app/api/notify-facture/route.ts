import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { fmtEUR } from "@/lib/format"
import {
  isFactureReglee,
  planifierFactureRelances,
  SEMAINES_RELANCE_FACTURE,
} from "@/lib/facture-relance"
import { persistFacture } from "@/lib/persist"
import { getTelPrincipal } from "@/lib/parametres"

export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const {
    clientEmail, clientNom, technicienNom, ville, dateFacture,
    numero, totalTTC, echeance, agence, pdfBase64, pdfFilename,
    facture, totalHT, tvaTaux, clientAdresse, clientCP,
  } = body

  const ctx = initResend(clientEmail)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { resend, fromEmail, recipient } = ctx

  const tech = technicienNom || 'votre technicien'
  const attachments = pdfBase64 && pdfFilename
    ? [{ filename: pdfFilename, content: pdfBase64 }]
    : undefined

  const subject = numero
    ? `Votre facture ${numero}${ville ? ` — ${ville}` : ''}`
    : `Votre facture${ville ? ` — ${ville}` : ''}`

  const tel = await getTelPrincipal()

  const result = await resend.emails.send({
    from: `Aprime fluides <${fromEmail}>`,
    to: recipient,
    subject,
    html: emailFacture({ clientNom, technicienNom: tech, ville, dateFacture, numero, totalTTC, echeance, agence, tel }),
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
  let relanceIds: string[] = []
  let relanceErrors: string[] = []

  const reglee = isFactureReglee(echeance)
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(req.url).origin

  if (facture && !reglee) {
    try {
      const rel = await planifierFactureRelances({
        baseUrl,
        clientEmail: recipient,
        clientNom,
        technicienNom: tech,
        ville,
        dateFacture,
        numero,
        totalTTC,
        echeance,
        anchorAt: new Date().toISOString(),
      })
      relanceIds = rel.reminderIds
      relanceErrors = rel.reminderErrors
    } catch (e: any) {
      relanceErrors.push(e?.message || "Planification relances échouée")
      console.error("[notify-facture] relances", e)
    }
  }

  if (facture) {
    try {
      docId = await persistFacture({
        facture, clientNom, clientEmail, clientAdresse, clientCP, ville,
        agence, numero, totalHT, totalTTC, tvaTaux, echeance,
        emailSent: true,
        relanceIds: reglee ? [] : relanceIds,
      })
      if (!docId) persistError = "Sauvegarde DB impossible (vérifie les logs serveur)"
    } catch (e: any) {
      persistError = e?.message || 'Erreur de sauvegarde DB'
      console.error('[notify-facture] persist', e)
    }
  }

  return NextResponse.json({
    ok: true,
    id: result.data?.id,
    docId,
    ...(reglee
      ? {}
      : {
          relances_planifiees: relanceIds.length,
          relances_semaines: SEMAINES_RELANCE_FACTURE,
          relance_ids: relanceIds,
          ...(relanceErrors.length ? { relance_warnings: relanceErrors } : {}),
        }),
    ...(persistError ? { warning: `Email envoyé mais la facture n'a PAS été enregistrée en base : ${persistError}` } : {}),
  })
}

function emailFacture({ clientNom, technicienNom, ville, dateFacture, numero, totalTTC, echeance, agence, tel }: {
  clientNom?: string; technicienNom: string; ville?: string; dateFacture?: string;
  numero?: string; totalTTC?: number; echeance?: string; agence?: string; tel: string;
}) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || '')
  const dd = escapeHtml(dateFacture || '')
  const num = escapeHtml(numero || '')
  const ag = escapeHtml(agence || '')
  const ttc = typeof totalTTC === 'number' ? fmtEUR(totalTTC) : ''
  const ech = escapeHtml(echeance || 'À réception')
  const isRegle = /^r[ée]gl[ée]e?$/i.test((echeance || '').trim())

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Facture</div>
        <h1 style="margin:0;font-size:22px">${num ? `Facture ${num}` : 'Votre facture'}</h1>
        ${dd ? `<p style="margin:6px 0 0;opacity:.85;font-size:13px">Date : ${dd}</p>` : ''}
      </td></tr>
      <tr><td style="padding:30px">
        <p>Bonjour ${cn},</p>
        <p>Suite à notre intervention${v ? ` à <strong>${v}</strong>` : ''}, vous trouverez ci-joint votre <strong>facture détaillée</strong>${ag ? ` (${ag})` : ''}.</p>
        ${ttc ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <tr><td style="background:#f8fafc;padding:16px 20px;color:#475569;font-size:13px">Montant total TTC</td>
              <td style="background:#f8fafc;padding:16px 20px;text-align:right;color:#0e2a52;font-size:18px;font-weight:bold">${ttc}</td></tr>
          <tr><td style="padding:14px 20px;color:#475569;font-size:13px;border-top:1px solid #e2e8f0">Échéance</td>
              <td style="padding:14px 20px;text-align:right;color:${isRegle ? '#0f7a3b' : '#0e2a52'};font-size:14px;font-weight:bold;border-top:1px solid #e2e8f0">${ech}</td></tr>
        </table>` : ''}
        ${isRegle
          ? '<p style="font-size:14px">Cette intervention a déjà été réglée — aucun solde restant dû.</p>'
          : `<p style="font-size:14px">Pour tout règlement ou question, contactez-nous au <strong>${escapeHtml(tel)}</strong> ou répondez à ce mail.</p>`}
        <p style="margin-top:30px;font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong> — Expert en assainissement<br>Aprime fluides</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Aprime fluides · ${escapeHtml(tel)} · www.aprime-fluide.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
