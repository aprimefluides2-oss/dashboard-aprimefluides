import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import crypto from "crypto"
import { EMAIL_RE, escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"

function getBaseUrl(req: NextRequest): string {
  const configured = process.env.APP_BASE_URL
    || process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  if (configured) return configured.replace(/\/+$/, "")
  return req.nextUrl.origin.replace(/\/+$/, "")
}

function signPayload(payload: string, exp: number, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${payload}.${exp}`).digest("hex")
}

function quoteRef() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `QC-${y}${m}${day}-${hh}${mm}`
}

async function saveExternalQuote(payload: any) {
  const externalUrl = process.env.EXTERNAL_DB_API_URL
  const externalToken = process.env.EXTERNAL_DB_API_TOKEN || ""
  if (!externalUrl) throw new Error("EXTERNAL_DB_API_URL manquante")

  const res = await fetch(externalUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(externalToken ? { authorization: `Bearer ${externalToken}` } : {}),
    },
    body: JSON.stringify(payload),
  })
  const txt = await res.text()
  if (!res.ok) {
    throw new Error(`Stockage externe refusé (${res.status}) ${txt.slice(0, 250)}`)
  }
  try {
    return JSON.parse(txt)
  } catch {
    return { ok: true, raw: txt }
  }
}

export async function POST(req: NextRequest) {
  const {
    clientEmail,
    clientNom,
    technicienNom,
    ville,
    dateIntervention,
    rapportReference,
    prestations,
    prestations_detail,
    operationsSpeciales,
  } = await req.json()

  if (!clientEmail || typeof clientEmail !== "string" || !EMAIL_RE.test(clientEmail)) {
    return NextResponse.json({ error: "Email client invalide" }, { status: 400 })
  }
  if (!Array.isArray(prestations) || prestations.length === 0) {
    return NextResponse.json({ error: "Sélectionnez au moins une prestation" }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY manquante" }, { status: 500 })
  const fromEmail = getResendFromEmail()

  const quoteId = quoteRef()
  const recipient = getResendRecipient(clientEmail)
  const tech = technicienNom || "Votre technicien"
  const quotePayload = {
    quote_id: quoteId,
    created_at: new Date().toISOString(),
    client_nom: clientNom || "",
    client_email: clientEmail,
    technicien_nom: tech,
    ville: ville || "",
    date_intervention: dateIntervention || "",
    rapport_reference: rapportReference || "",
    prestations,
    prestations_detail: Array.isArray(prestations_detail) ? prestations_detail : [],
    operations_speciales: operationsSpeciales || "",
    source: "app-realisations-ltdb",
  }

  let externalResp: any = null
  try {
    externalResp = await saveExternalQuote(quotePayload)
  } catch (e: any) {
    return NextResponse.json({ error: `Erreur stockage externe: ${e.message || e.toString()}` }, { status: 500 })
  }

  const resend = new Resend(resendKey)
  const semaines = [7, 14, 21]
  const reminders = await Promise.all(
    semaines.map((days) => resend.emails.send({
      from: `Aprime fluides <${fromEmail}>`,
      to: recipient,
      subject: `Relance devis ${quoteId} — semaine ${days / 7}`,
      html: emailWeeklyReminder({ clientNom, technicienNom: tech, quoteId, ville, prestations, operationsSpeciales, week: days / 7 }),
      scheduledAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    }))
  )

  const reminderIds = reminders.map((r) => r.data?.id).filter(Boolean) as string[]
  const signSecret = process.env.REVIEW_STOP_SECRET || process.env.NEXTAUTH_SECRET || resendKey
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ ids: reminderIds, kind: "quote" }), "utf-8").toString("base64url")
  const sig = signPayload(payload, exp, signSecret)
  const stopUrl = `${getBaseUrl(req)}/api/quote-complementaire/stop-reminders?p=${encodeURIComponent(payload)}&exp=${exp}&sig=${sig}`

  const immediate = await resend.emails.send({
    from: `Aprime fluides <${fromEmail}>`,
    to: recipient,
    subject: `Votre devis complémentaire ${quoteId}`,
    html: emailQuote({
      clientNom,
      technicienNom: tech,
      quoteId,
      ville,
      dateIntervention,
      rapportReference,
      prestations,
      prestationsDetail: Array.isArray(prestations_detail) ? prestations_detail : [],
      operationsSpeciales,
      stopUrl,
    }),
  })

  if (immediate.error) {
    return NextResponse.json({ error: immediate.error.message || "Envoi devis échoué" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    quote_id: quoteId,
    immediate_id: immediate.data?.id,
    reminders_ids: reminderIds,
    external: externalResp,
    reminder_errors: reminders.filter((r) => r.error).map((r) => r.error?.message),
  })
}

function emailQuote({
  clientNom, technicienNom, quoteId, ville, dateIntervention, rapportReference, prestations, prestationsDetail, operationsSpeciales, stopUrl,
}: {
  clientNom: string; technicienNom: string; quoteId: string; ville: string; dateIntervention: string;
  rapportReference: string; prestations: string[]; prestationsDetail: Array<{ prestation: string; qte: number; puHT: number }>; operationsSpeciales: string; stopUrl: string
}) {
  const cn = escapeHtml(clientNom || "Madame, Monsieur")
  const tn = escapeHtml(technicienNom)
  const q = escapeHtml(quoteId)
  const v = escapeHtml(ville || "")
  const di = escapeHtml(dateIntervention || "")
  const rr = escapeHtml(rapportReference || "N/A")
  const prestationsHtml = prestations.map((p) => `<li>${escapeHtml(p)}</li>`).join("")
  const detailRows = prestationsDetail.map((d) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(d.prestation)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${Number(d.qte || 0)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${Number(d.puHT || 0).toFixed(2)} €</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${(Number(d.qte || 0) * Number(d.puHT || 0)).toFixed(2)} €</td></tr>`).join("")
  const totalHT = prestationsDetail.reduce((sum, d) => sum + Number(d.qte || 0) * Number(d.puHT || 0), 0)
  const tva = totalHT * 0.1
  const ttc = totalHT + tva
  const ops = escapeHtml(operationsSpeciales || "")
  const su = encodeURI(stopUrl)

  return `<!doctype html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 0"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e1e6ef">
<tr><td style="background:#0e2a52;color:#fff;padding:24px">
<h1 style="margin:0;font-size:22px">Devis complémentaire</h1>
<p style="margin:8px 0 0;opacity:.9">Référence ${q}</p>
</td></tr>
<tr><td style="padding:24px;color:#1a1a1a">
<p>Bonjour ${cn},</p>
<p>Suite à notre intervention à <strong>${v}</strong> du <strong>${di}</strong>, voici les prestations recommandées.</p>
<p style="font-size:13px;color:#64748b">Référence rapport: <strong>${rr}</strong></p>
<div style="margin:18px 0;padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc">
<p style="margin:0 0 8px;font-weight:bold;color:#0e2a52">Prestations sélectionnées</p>
<ul style="margin:0;padding-left:18px">${prestationsHtml}</ul>
${ops ? `<p style="margin:12px 0 0"><strong>Opérations spéciales:</strong><br>${ops}</p>` : ""}
</div>
${prestationsDetail.length > 0 ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:18px 0"><thead><tr style="background:#0e2a52;color:#fff"><th style="padding:8px;text-align:left">Prestation</th><th style="padding:8px;text-align:right">Qté</th><th style="padding:8px;text-align:right">PU HT</th><th style="padding:8px;text-align:right">Total HT</th></tr></thead><tbody>${detailRows}</tbody><tfoot><tr><td colspan="3" style="padding:8px;text-align:right;font-weight:bold">Total HT</td><td style="padding:8px;text-align:right;font-weight:bold">${totalHT.toFixed(2)} €</td></tr><tr><td colspan="3" style="padding:8px;text-align:right">TVA 10%</td><td style="padding:8px;text-align:right">${tva.toFixed(2)} €</td></tr><tr><td colspan="3" style="padding:8px;text-align:right;font-weight:bold;color:#0e2a52">Total TTC</td><td style="padding:8px;text-align:right;font-weight:bold;color:#0e2a52">${ttc.toFixed(2)} €</td></tr></tfoot></table>` : ""}
<p>Nous restons à votre disposition pour valider ce devis et planifier l'intervention.</p>
<p style="margin-top:18px;font-size:13px;color:#64748b">Vous avez déjà répondu ? <a href="${su}" style="color:#2c5fa8">Cliquez ici pour annuler les relances devis</a>.</p>
<p style="margin-top:18px">Cordialement,<br><strong>${tn}</strong><br>Aprime fluides</p>
</td></tr>
</table></td></tr></table></body></html>`
}

function emailWeeklyReminder({
  clientNom, technicienNom, quoteId, ville, prestations, operationsSpeciales, week,
}: {
  clientNom: string; technicienNom: string; quoteId: string; ville: string;
  prestations: string[]; operationsSpeciales: string; week: number
}) {
  const cn = escapeHtml(clientNom || "Madame, Monsieur")
  const tn = escapeHtml(technicienNom)
  const prestationsHtml = prestations.map((p) => `<li>${escapeHtml(p)}</li>`).join("")
  const ops = escapeHtml(operationsSpeciales || "")
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f6fa;padding:20px">
<div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e1e6ef;border-radius:10px;padding:24px">
<h1 style="margin:0 0 10px;color:#0e2a52;font-size:21px">Relance devis complémentaire</h1>
<p>Bonjour ${cn},</p>
<p>Petit rappel concernant votre devis <strong>${escapeHtml(quoteId)}</strong> (semaine ${week}) pour <strong>${escapeHtml(ville)}</strong>.</p>
<ul style="padding-left:18px">${prestationsHtml}</ul>
${ops ? `<p><strong>Opérations spéciales:</strong><br>${ops}</p>` : ""}
<p>Nous restons disponibles pour toute précision.</p>
<p style="font-size:13px;color:#64748b">Merci,<br><strong>${tn}</strong> — Aprime fluides</p>
</div></body></html>`
}
