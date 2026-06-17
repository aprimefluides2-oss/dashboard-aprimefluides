import crypto from "crypto"
import { Resend } from "resend"
import { escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"
import { fmtEUR } from "@/lib/format"
import { getTelPrincipal } from "@/lib/parametres"

const SEMAINES_RELANCE = [1, 2, 3] as const
export type SemaineRelance = (typeof SEMAINES_RELANCE)[number]

export function signDevisStopPayload(ids: string[], secret: string): { payload: string; exp: number; sig: string } {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ ids, kind: "devis" }), "utf-8").toString("base64url")
  const sig = crypto.createHmac("sha256", secret).update(`${payload}.${exp}`).digest("hex")
  return { payload, exp, sig }
}

function buildStopUrl(baseUrl: string, reminderIds: string[], secret: string): string {
  if (reminderIds.length === 0) return ""
  const { payload, exp, sig } = signDevisStopPayload(reminderIds, secret)
  return `${baseUrl.replace(/\/+$/, "")}/api/quote-complementaire/stop-reminders?p=${encodeURIComponent(payload)}&exp=${exp}&sig=${sig}`
}

function emailDevisSemaine1({
  clientNom, technicienNom, ville, dateDevis, numero, totalTTC, validiteJours, tel, stopUrl,
}: {
  clientNom?: string
  technicienNom: string
  ville?: string
  dateDevis?: string
  numero?: string
  totalTTC?: number
  validiteJours?: number
  tel: string
  stopUrl?: string
}) {
  const cn = escapeHtml(clientNom || "Madame, Monsieur")
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || "")
  const dd = escapeHtml(dateDevis || "")
  const num = escapeHtml(numero || "")
  const ttc = typeof totalTTC === "number" ? fmtEUR(totalTTC) : ""
  const valid = typeof validiteJours === "number" && validiteJours > 0 ? `${validiteJours} jours` : "30 jours"
  const su = stopUrl ? encodeURI(stopUrl) : ""
  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Devis</div>
        <h1 style="margin:0;font-size:22px">${num ? `Devis ${num}` : "Votre devis"}</h1>
        ${dd ? `<p style="margin:6px 0 0;opacity:.85;font-size:13px">Établi le ${dd}</p>` : ""}
      </td></tr>
      <tr><td style="padding:30px">
        <p>Bonjour ${cn},</p>
        <p>Suite à notre échange${v ? ` concernant votre demande à <strong>${v}</strong>` : ""}, vous trouverez ci-joint votre <strong>devis détaillé</strong>.</p>
        <p style="background:#eff6ff;border-left:4px solid #2c5fa8;padding:14px 16px;border-radius:6px;font-size:14px;color:#1e3a5f">
          <strong>Bonne nouvelle :</strong> nos équipes interviennent actuellement dans votre secteur.
          Nous pouvons donc planifier une intervention <strong>rapidement</strong> dès validation du devis.
        </p>
        ${ttc ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <tr><td style="background:#f8fafc;padding:16px 20px;color:#475569;font-size:13px">Montant total TTC</td>
              <td style="background:#f8fafc;padding:16px 20px;text-align:right;color:#0e2a52;font-size:18px;font-weight:bold">${ttc}</td></tr>
        </table>` : ""}
        <p style="font-size:14px">Devis valable <strong>${valid}</strong>.</p>
        <p>Pour valider ou poser une question, contactez-nous au <strong>${escapeHtml(tel)}</strong> ou répondez à ce mail.</p>
        ${su ? `<p style="margin-top:18px;font-size:12px;color:#64748b">Vous avez déjà répondu ? <a href="${su}" style="color:#2c5fa8">Cliquez ici pour ne plus recevoir de relance</a>.</p>` : ""}
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

function emailDevisRelanceSecteur({
  clientNom, technicienNom, ville, numero, semaine, tel,
}: {
  clientNom?: string
  technicienNom: string
  ville?: string
  numero?: string
  semaine: 2 | 3
  tel: string
}) {
  const cn = escapeHtml(clientNom || "Madame, Monsieur")
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || "")
  const num = escapeHtml(numero || "")
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f6fa;padding:20px">
<div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e1e6ef;border-radius:10px;padding:24px">
<h1 style="margin:0 0 10px;color:#0e2a52;font-size:21px">Rappel — votre devis${num ? ` ${num}` : ""}</h1>
<p>Bonjour ${cn},</p>
<p>Nous repassons vers vous (relance ${semaine}/3) concernant votre devis${v ? ` pour <strong>${v}</strong>` : ""}.</p>
<p style="background:#eff6ff;border-left:4px solid #2c5fa8;padding:14px 16px;border-radius:6px;font-size:14px;color:#1e3a5f">
  Nos techniciens sont toujours <strong>présents dans votre secteur</strong> : nous pouvons intervenir
  <strong>rapidement</strong> après votre accord.
</p>
<p>Une question ou pour confirmer ? Appelez-nous au <strong>${escapeHtml(tel)}</strong> ou répondez à cet email.</p>
<p style="font-size:13px;color:#64748b">Cordialement,<br><strong>${tn}</strong> — Aprime fluides</p>
</div></body></html>`
}

function emailDevisRelanceRistourne({
  clientNom, technicienNom, ville, numero, totalTTC, tel,
}: {
  clientNom?: string
  technicienNom: string
  ville?: string
  numero?: string
  totalTTC?: number
  tel: string
}) {
  const cn = escapeHtml(clientNom || "Madame, Monsieur")
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || "")
  const num = escapeHtml(numero || "")
  const ttc = typeof totalTTC === "number" ? totalTTC : null
  const remise = ttc != null ? ttc * 0.9 : null
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f6fa;padding:20px">
<div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e1e6ef;border-radius:10px;padding:24px">
<h1 style="margin:0 0 10px;color:#0e2a52;font-size:21px">Dernière relance — offre -10 %</h1>
<p>Bonjour ${cn},</p>
<p>Dernier rappel (3/3) pour votre devis${num ? ` <strong>${num}</strong>` : ""}${v ? ` à <strong>${v}</strong>` : ""}.</p>
<p style="background:#ecfdf5;border-left:4px solid #10b981;padding:14px 16px;border-radius:6px;font-size:14px;color:#065f46">
  <strong>Offre valable en acceptant dès maintenant :</strong> <strong>10 % de remise</strong> sur le montant de l&apos;intervention.
  ${ttc != null && remise != null ? `<br><span style="font-size:13px">Soit <strong>${fmtEUR(remise)} TTC</strong> au lieu de ${fmtEUR(ttc)} TTC.</span>` : ""}
</p>
<p>Nous restons disponibles dans le secteur pour une intervention rapide. Contact : <strong>${escapeHtml(tel)}</strong>.</p>
<p style="font-size:13px;color:#64748b">Cordialement,<br><strong>${tn}</strong> — Aprime fluides</p>
</div></body></html>`
}

export type PlanifierDevisEnvoiInput = {
  baseUrl: string
  clientEmail: string
  clientNom?: string
  technicienNom?: string
  ville?: string
  dateDevis?: string
  numero?: string
  totalTTC?: number
  validiteJours?: number
  pdfBase64?: string
  pdfFilename?: string
  /** ISO 8601 — si absent ou passé : envoi immédiat du 1er mail */
  premierEnvoiAt?: string
}

export type PlanifierDevisEnvoiResult = {
  immediateId?: string
  reminderIds: string[]
  reminderErrors: string[]
  stopUrl: string
}

/**
 * Envoie le devis (semaine 1) puis planifie les relances J+7 et J+14 via Resend scheduledAt.
 */
export async function planifierDevisAvecRelances(input: PlanifierDevisEnvoiInput): Promise<PlanifierDevisEnvoiResult> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) throw new Error("RESEND_API_KEY manquante")

  const fromEmail = getResendFromEmail()
  const recipient = getResendRecipient(input.clientEmail)
  const tech = input.technicienNom || "votre technicien"
  const tel = await getTelPrincipal()
  const signSecret = process.env.REVIEW_STOP_SECRET || process.env.NEXTAUTH_SECRET || resendKey

  const attachments =
    input.pdfBase64 && input.pdfFilename
      ? [{ filename: input.pdfFilename, content: input.pdfBase64 }]
      : undefined

  const anchor = input.premierEnvoiAt ? new Date(input.premierEnvoiAt) : new Date()
  const now = Date.now()
  const firstAt = anchor.getTime() > now + 60_000 ? anchor : new Date()

  const resend = new Resend(resendKey)
  const subjectBase = input.numero
    ? `Votre devis ${input.numero}${input.ville ? ` — ${input.ville}` : ""}`
    : `Votre devis${input.ville ? ` — ${input.ville}` : ""}`

  const reminderIds: string[] = []
  const reminderErrors: string[] = []

  const scheduleAt = (daysAfterFirst: number) =>
    new Date(firstAt.getTime() + daysAfterFirst * 7 * 24 * 60 * 60 * 1000).toISOString()

  const isImmediate = firstAt.getTime() <= now + 60_000

  const relances = await Promise.all([
    resend.emails.send({
      from: `Aprime fluides <${fromEmail}>`,
      to: recipient,
      subject: `Rappel devis${input.numero ? ` ${input.numero}` : ""} — semaine 2`,
      html: emailDevisRelanceSecteur({
        clientNom: input.clientNom,
        technicienNom: tech,
        ville: input.ville,
        numero: input.numero,
        semaine: 2,
        tel,
      }),
      scheduledAt: scheduleAt(1),
    }),
    resend.emails.send({
      from: `Aprime fluides <${fromEmail}>`,
      to: recipient,
      subject: `Dernière relance devis${input.numero ? ` ${input.numero}` : ""} — -10 % si accord immédiat`,
      html: emailDevisRelanceRistourne({
        clientNom: input.clientNom,
        technicienNom: tech,
        ville: input.ville,
        numero: input.numero,
        totalTTC: input.totalTTC,
        tel,
      }),
      scheduledAt: scheduleAt(2),
    }),
  ])

  for (const r of relances) {
    if (r.data?.id) reminderIds.push(r.data.id)
    if (r.error) reminderErrors.push(r.error.message || "Erreur relance")
  }

  const stopUrl = buildStopUrl(input.baseUrl, reminderIds, signSecret)

  let immediateId: string | undefined
  const firstPayload = {
    from: `Aprime fluides <${fromEmail}>` as const,
    to: recipient,
    subject: subjectBase,
    html: emailDevisSemaine1({
      clientNom: input.clientNom,
      technicienNom: tech,
      ville: input.ville,
      dateDevis: input.dateDevis,
      numero: input.numero,
      totalTTC: input.totalTTC,
      validiteJours: input.validiteJours,
      tel,
      stopUrl: stopUrl || undefined,
    }),
    attachments,
    ...(isImmediate ? {} : { scheduledAt: firstAt.toISOString() }),
  }

  const first = await resend.emails.send(firstPayload)
  if (first.error) throw new Error(first.error.message || "Envoi devis échoué")
  immediateId = first.data?.id

  return { immediateId, reminderIds, reminderErrors, stopUrl }
}
