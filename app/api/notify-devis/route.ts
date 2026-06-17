import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { planifierDevisAvecRelances } from "@/lib/devis-relance"
import { fmtEUR } from "@/lib/format"
import { persistDevis } from "@/lib/persist"
import { getTelPrincipal } from "@/lib/parametres"

export const maxDuration = 30

function getBaseUrl(req: NextRequest): string {
  const configured = process.env.APP_BASE_URL
    || process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  if (configured) return configured.replace(/\/+$/, "")
  return req.nextUrl.origin.replace(/\/+$/, "")
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const clientEmail = typeof body.clientEmail === 'string' ? body.clientEmail : undefined
  if (!clientEmail) {
    return NextResponse.json({ error: 'Email client manquant' }, { status: 400 })
  }
  const {
    clientNom, technicienNom, ville, dateDevis, numero, totalTTC, validiteJours, pdfBase64, pdfFilename,
    devis, totalHT, tvaTaux, agence, clientAdresse, clientCP,
    interventionId, planRelances, premierEnvoiAt,
  } = body as {
    clientNom?: string
    technicienNom?: string
    ville?: string
    dateDevis?: string
    numero?: string
    totalTTC?: number
    validiteJours?: number
    pdfBase64?: string
    pdfFilename?: string
    devis?: object
    totalHT?: number
    tvaTaux?: number
    agence?: string
    clientAdresse?: string
    clientCP?: string
    interventionId?: string
    planRelances?: boolean
    premierEnvoiAt?: string
  }

  const ctx = initResend(clientEmail)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const avecRelances = planRelances !== false

  try {
    let immediateId: string | undefined
    let reminderIds: string[] = []
    let reminderErrors: string[] = []

    if (avecRelances) {
      const out = await planifierDevisAvecRelances({
        baseUrl: getBaseUrl(req),
        clientEmail,
        clientNom,
        technicienNom,
        ville,
        dateDevis,
        numero,
        totalTTC,
        validiteJours,
        pdfBase64,
        pdfFilename,
        premierEnvoiAt,
      })
      immediateId = out.immediateId
      reminderIds = out.reminderIds
      reminderErrors = out.reminderErrors
    } else {
      const { resend, fromEmail, recipient } = ctx
      const tech = technicienNom || 'votre technicien'
      const tel = await getTelPrincipal()
      const attachments = pdfBase64 && pdfFilename
        ? [{ filename: pdfFilename, content: pdfBase64 }]
        : undefined
      const subject = numero
        ? `Votre devis ${numero}${ville ? ` — ${ville}` : ''}`
        : `Votre devis${ville ? ` — ${ville}` : ''}`
      const result = await resend.emails.send({
        from: `Aprime fluides <${fromEmail}>`,
        to: recipient,
        subject,
        html: emailDevisSimple({ clientNom, technicienNom: tech, ville, dateDevis, numero, totalTTC, validiteJours, tel }),
        attachments,
      })
      if (result.error) {
        return NextResponse.json({ error: result.error.message || 'Envoi échoué' }, { status: 500 })
      }
      immediateId = result.data?.id
    }

    let docId: string | null = null
    let persistError: string | null = null
    if (devis) {
      try {
        docId = await persistDevis({
          devis,
          clientNom,
          clientEmail,
          clientAdresse,
          clientCP,
          ville,
          agence,
          numero,
          totalHT,
          totalTTC,
          tvaTaux,
          validiteJours,
          emailSent: true,
          interventionId: interventionId || null,
        })
        if (!docId) persistError = "Sauvegarde DB impossible (vérifie les logs serveur)"
      } catch (e: unknown) {
        persistError = e instanceof Error ? e.message : 'Erreur de sauvegarde DB'
        console.error('[notify-devis] persist', e)
      }
    }

    if (interventionId) {
      const { getSupabaseOrNull } = await import('@/lib/supabase')
      const sb = getSupabaseOrNull()
      if (sb) {
        await sb.from('interventions').update({ statut: 'en_cours' }).eq('id', interventionId)
      }
    }

    return NextResponse.json({
      ok: true,
      id: immediateId,
      docId,
      relances_planifiees: avecRelances,
      reminders_ids: reminderIds,
      ...(reminderErrors.length ? { reminder_errors: reminderErrors } : {}),
      ...(persistError ? { warning: `Email planifié mais devis non enregistré : ${persistError}` } : {}),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function emailDevisSimple({ clientNom, technicienNom, ville, dateDevis, numero, totalTTC, validiteJours, tel }: {
  clientNom?: string; technicienNom: string; ville?: string; dateDevis?: string;
  numero?: string; totalTTC?: number; validiteJours?: number; tel: string;
}) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || '')
  const dd = escapeHtml(dateDevis || '')
  const num = escapeHtml(numero || '')
  const ttc = typeof totalTTC === 'number' ? fmtEUR(totalTTC) : ''
  const valid = typeof validiteJours === 'number' && validiteJours > 0 ? `${validiteJours} jours` : '30 jours'
  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Devis</div>
        <h1 style="margin:0;font-size:22px">${num ? `Devis ${num}` : 'Votre devis'}</h1>
        ${dd ? `<p style="margin:6px 0 0;opacity:.85;font-size:13px">Établi le ${dd}</p>` : ''}
      </td></tr>
      <tr><td style="padding:30px">
        <p>Bonjour ${cn},</p>
        <p>Suite à notre échange${v ? ` concernant l'intervention prévue à <strong>${v}</strong>` : ''}, vous trouverez ci-joint votre <strong>devis détaillé</strong>.</p>
        ${ttc ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <tr><td style="background:#f8fafc;padding:16px 20px;color:#475569;font-size:13px">Montant total TTC</td>
              <td style="background:#f8fafc;padding:16px 20px;text-align:right;color:#0e2a52;font-size:18px;font-weight:bold">${ttc}</td></tr>
        </table>` : ''}
        <p style="font-size:14px">Devis valable <strong>${valid}</strong>.</p>
        <p>Pour valider ou poser une question, contactez-nous au <strong>${escapeHtml(tel)}</strong> ou répondez à ce mail.</p>
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
