import crypto from "crypto"
import { Resend } from "resend"
import { escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"
import { fmtEUR } from "@/lib/format"
import { getTelPrincipal } from "@/lib/parametres"
import { getSupabaseOrNull } from "@/lib/supabase"

/** Relances hebdomadaires planifiées à l'envoi de la facture (si non réglée). */
export const SEMAINES_RELANCE_FACTURE = 8

export type RelanceFactureTone = "cordial" | "neutre" | "ferme" | "ferme_plus"

export function toneForSemaine(semaine: number): RelanceFactureTone {
  const tones: RelanceFactureTone[] = ["cordial", "neutre", "ferme", "ferme_plus"]
  return tones[(semaine - 1) % tones.length]
}

export function isFactureReglee(echeance?: string | null): boolean {
  return /^r[ée]gl[ée]e?$/i.test((echeance || "").trim())
}

export function mergeFacturePayloadMeta(
  facture: Record<string, unknown>,
  meta: { relance_ids?: string[]; relance_planifiees?: number },
): Record<string, unknown> {
  const { _ltdb_meta, ...rest } = facture
  return {
    ...rest,
    _ltdb_meta: { ...(typeof _ltdb_meta === "object" && _ltdb_meta ? _ltdb_meta : {}), ...meta },
  }
}

export function relanceIdsFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return []
  const meta = (payload as { _ltdb_meta?: { relance_ids?: string[] } })._ltdb_meta
  return Array.isArray(meta?.relance_ids) ? meta.relance_ids.filter(Boolean) : []
}

export async function annulerRelancesFacture(documentId: string): Promise<number> {
  const sb = getSupabaseOrNull()
  if (!sb) return 0
  const { data } = await sb.from("documents").select("payload").eq("id", documentId).maybeSingle()
  const ids = relanceIdsFromPayload(data?.payload)
  if (ids.length === 0) return 0

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return 0

  const resend = new Resend(resendKey)
  let canceled = 0
  for (const id of ids) {
    try {
      await resend.emails.cancel(id)
      canceled++
    } catch {
      /* déjà envoyé ou id invalide */
    }
  }

  const payload = data?.payload as Record<string, unknown>
  await sb
    .from("documents")
    .update({
      payload: mergeFacturePayloadMeta(payload || {}, { relance_ids: [], relance_planifiees: 0 }),
    })
    .eq("id", documentId)

  return canceled
}

function buildStopUrl(baseUrl: string, reminderIds: string[], secret: string): string {
  if (reminderIds.length === 0) return ""
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ ids: reminderIds, kind: "facture" }), "utf-8").toString("base64url")
  const sig = crypto.createHmac("sha256", secret).update(`${payload}.${exp}`).digest("hex")
  return `${baseUrl.replace(/\/+$/, "")}/api/facture/stop-reminders?p=${encodeURIComponent(payload)}&exp=${exp}&sig=${sig}`
}

function emailRelanceFacture(input: {
  clientNom?: string
  technicienNom: string
  ville?: string
  numero?: string
  totalTTC?: number
  echeance?: string
  dateFacture?: string
  semaine: number
  tone: RelanceFactureTone
  tel: string
  stopUrl?: string
}): string {
  const cn = escapeHtml(input.clientNom || "Madame, Monsieur")
  const tn = escapeHtml(input.technicienNom)
  const v = escapeHtml(input.ville || "")
  const num = escapeHtml(input.numero || "")
  const ttc = typeof input.totalTTC === "number" ? fmtEUR(input.totalTTC) : ""
  const ech = escapeHtml(input.echeance || "À réception")
  const dd = escapeHtml(input.dateFacture || "")
  const su = input.stopUrl ? encodeURI(input.stopUrl) : ""

  const intros: Record<RelanceFactureTone, string> = {
    cordial: `<p>Bonjour ${cn},</p>
<p>Nous nous permettons de vous adresser un <strong>petit rappel amical</strong> concernant la facture${num ? ` n°<strong>${num}</strong>` : ""}${v ? ` relative à notre intervention à <strong>${v}</strong>` : ""}${dd ? ` du ${dd}` : ""}.</p>
<p>Sauf erreur de notre part, le règlement n'apparaît pas encore sur notre comptabilité. N'hésitez pas à nous signaler tout virement en cours.</p>`,
    neutre: `<p>Bonjour ${cn},</p>
<p>Nous revenons vers vous (relance ${input.semaine}/${SEMAINES_RELANCE_FACTURE}) au sujet de la facture${num ? ` <strong>${num}</strong>` : ""}${v ? ` pour <strong>${v}</strong>` : ""}.</p>
<p>À ce jour, nous n'avons pas enregistré le paiement correspondant à l'échéance indiquée.</p>`,
    ferme: `<p>Bonjour ${cn},</p>
<p><strong>Relance de paiement</strong> — facture${num ? ` ${num}` : ""}${v ? ` (${v})` : ""} toujours en attente de règlement.</p>
<p>Merci de procéder au paiement dans les meilleurs délais ou de nous contacter si un élément bloque le règlement.</p>`,
    ferme_plus: `<p>Bonjour ${cn},</p>
<p><strong>Dernier rappel avant relance contentieuse</strong> : la facture${num ? ` <strong>${num}</strong>` : ""} demeure impayée malgré nos précédents messages.</p>
<p>Nous vous remercions de régulariser la situation sous 7 jours ou de nous appeler pour convenir d'un échéancier.</p>`,
  }

  const headerColors: Record<RelanceFactureTone, string> = {
    cordial: "linear-gradient(135deg,#0e2a52,#2c5fa8)",
    neutre: "linear-gradient(135deg,#334155,#475569)",
    ferme: "linear-gradient(135deg,#b45309,#d97706)",
    ferme_plus: "linear-gradient(135deg,#b91c1c,#dc2626)",
  }

  const subjectLabels: Record<RelanceFactureTone, string> = {
    cordial: "Rappel amical",
    neutre: "Rappel",
    ferme: "Relance paiement",
    ferme_plus: "Relance urgente",
  }

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
<tr><td style="background:${headerColors[input.tone]};padding:28px;color:#fff">
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">${subjectLabels[input.tone]} — semaine ${input.semaine}</div>
<h1 style="margin:0;font-size:21px">${num ? `Facture ${num}` : "Facture en attente"}</h1>
</td></tr>
<tr><td style="padding:28px">
${intros[input.tone]}
${ttc ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:8px">
<tr><td style="padding:14px 18px;color:#475569;font-size:13px">Montant TTC</td>
<td style="padding:14px 18px;text-align:right;font-size:17px;font-weight:bold;color:#0e2a52">${ttc}</td></tr>
<tr><td style="padding:14px 18px;color:#475569;font-size:13px;border-top:1px solid #e2e8f0">Échéance</td>
<td style="padding:14px 18px;text-align:right;font-size:14px;border-top:1px solid #e2e8f0">${ech}</td></tr>
</table>` : ""}
<p style="font-size:14px">La facture détaillée vous a été transmise par email précédemment. Pour toute question : <strong>${escapeHtml(input.tel)}</strong> ou réponse à ce message.</p>
${su ? `<p style="margin-top:16px;font-size:12px;color:#64748b">Déjà réglé ? <a href="${su}" style="color:#2c5fa8">Cliquez ici pour arrêter les relances</a>.</p>` : ""}
<p style="margin-top:24px;font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong><br>Aprime fluides</p>
</td></tr>
<tr><td style="background:#0e2a52;color:#a0c0ff;padding:16px;text-align:center;font-size:11px">
Aprime fluides · ${escapeHtml(input.tel)}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

export type PlanifierFactureRelancesInput = {
  baseUrl: string
  clientEmail: string
  clientNom?: string
  technicienNom?: string
  ville?: string
  dateFacture?: string
  numero?: string
  totalTTC?: number
  echeance?: string
  /** ISO — ancrage des relances (défaut : maintenant) */
  anchorAt?: string
}

export type PlanifierFactureRelancesResult = {
  reminderIds: string[]
  reminderErrors: string[]
  stopUrl: string
}

export async function planifierFactureRelances(
  input: PlanifierFactureRelancesInput,
): Promise<PlanifierFactureRelancesResult> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) throw new Error("RESEND_API_KEY manquante")

  const fromEmail = getResendFromEmail()
  const recipient = getResendRecipient(input.clientEmail)
  const tech = input.technicienNom || "votre technicien"
  const tel = await getTelPrincipal()
  const signSecret = process.env.REVIEW_STOP_SECRET || process.env.NEXTAUTH_SECRET || resendKey

  const anchor = input.anchorAt ? new Date(input.anchorAt) : new Date()
  const resend = new Resend(resendKey)

  const reminderIds: string[] = []
  const reminderErrors: string[] = []

  const scheduleAt = (weekIndex: number) =>
    new Date(anchor.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000).toISOString()

  for (let w = 1; w <= SEMAINES_RELANCE_FACTURE; w++) {
    const tone = toneForSemaine(w)
    const toneLabel =
      tone === "cordial" ? "rappel amical" : tone === "neutre" ? "rappel" : tone === "ferme" ? "relance" : "relance urgente"

    const result = await resend.emails.send({
      from: `Aprime fluides <${fromEmail}>`,
      to: recipient,
      subject: input.numero
        ? `${toneLabel} — Facture ${input.numero}${input.ville ? ` — ${input.ville}` : ""}`
        : `${toneLabel} — facture en attente`,
      html: emailRelanceFacture({
        clientNom: input.clientNom,
        technicienNom: tech,
        ville: input.ville,
        numero: input.numero,
        totalTTC: input.totalTTC,
        echeance: input.echeance,
        dateFacture: input.dateFacture,
        semaine: w,
        tone,
        tel,
      }),
      scheduledAt: scheduleAt(w),
    })

    if (result.data?.id) reminderIds.push(result.data.id)
    if (result.error) reminderErrors.push(`S${w}: ${result.error.message || "erreur"}`)
  }

  const stopUrl = buildStopUrl(input.baseUrl, reminderIds, signSecret)
  return { reminderIds, reminderErrors, stopUrl }
}
