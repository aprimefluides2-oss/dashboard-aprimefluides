import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { fmtEUR } from "@/lib/format"
import { getSupabaseOrNull } from "@/lib/supabase"
import { getTelPrincipal } from "@/lib/parametres"

export const maxDuration = 60

function getBaseUrl(req: NextRequest): string {
  const configured = process.env.APP_BASE_URL
    || process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  if (configured) return configured.replace(/\/+$/, "")
  return req.nextUrl.origin.replace(/\/+$/, "")
}

function signStopPayload(payload: string, exp: number, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${payload}.${exp}`).digest("hex")
}

async function fetchPdfAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return Buffer.from(buf).toString('base64')
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  let body: {
    interventionId?: string
    clientEmail?: string
    skipReviews?: boolean
    /** PDF rapport en base64, fourni par le wizard Mode Terrain — bypass le besoin de pdf_rapport_url */
    pdfRapportBase64?: string
    /** PDF facture en base64, fourni par le wizard — bypass le besoin de facture.pdf_url */
    pdfFactureBase64?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const interventionId = (body.interventionId || '').trim()
  if (!interventionId) {
    return NextResponse.json({ error: 'interventionId requis' }, { status: 400 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, reference, type_intervention, ville, date_realisee, date_prevue, agence, client_id, technicien_id, pdf_rapport_url, rapport_json, mail_envoye_at')
    .eq('id', interventionId)
    .single()
  if (intErr || !interv) {
    return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })
  }
  // Idempotence : si le mail a déjà été envoyé dans les 30 dernières minutes,
  // on ne re-spamme pas Resend + relances avis. Retourne 200 OK silencieux.
  if (interv.mail_envoye_at) {
    const ageMs = Date.now() - new Date(interv.mail_envoye_at).getTime()
    if (ageMs < 30 * 60 * 1000) {
      return NextResponse.json({ ok: true, alreadySent: true, mail_envoye_at: interv.mail_envoye_at })
    }
  }
  if (!interv.pdf_rapport_url && !body.pdfRapportBase64) {
    return NextResponse.json({ error: 'Aucun PDF rapport publié pour cette intervention. Publie le rapport d\'abord.' }, { status: 400 })
  }

  // range(0, 0) au lieu de limit(1) : limit + order drop silencieusement la
  // ligne la plus récente sur supabase-js (bug documenté, cf. /api/historique).
  const { data: factures } = await sb
    .from('documents')
    .select('id, numero, montant_ht, montant_ttc, date_emission, echeance, statut, agence, pdf_url')
    .eq('intervention_id', interventionId)
    .eq('type', 'facture')
    .order('created_at', { ascending: false })
    .range(0, 0)
  const facture = factures && factures[0]
  if (!facture) {
    return NextResponse.json({ error: 'Aucune facture trouvée pour cette intervention. Crée la facture d\'abord.' }, { status: 400 })
  }
  if (!facture.pdf_url && !body.pdfFactureBase64) {
    return NextResponse.json({ error: 'La facture n\'a pas de PDF stocké.' }, { status: 400 })
  }

  let clientNom = ''
  let clientEmailFromDb = ''
  if (interv.client_id) {
    const { data: cl } = await sb
      .from('clients')
      .select('nom, email')
      .eq('id', interv.client_id)
      .single()
    if (cl) { clientNom = cl.nom || ''; clientEmailFromDb = cl.email || '' }
  }
  const clientEmail = (body.clientEmail || clientEmailFromDb).trim()
  if (!clientEmail) {
    return NextResponse.json({ error: 'Email client manquant. Renseigne-le côté UI.' }, { status: 400 })
  }

  let technicienNom = 'votre technicien'
  if (interv.technicien_id) {
    const { data: t } = await sb
      .from('techniciens')
      .select('nom')
      .eq('id', interv.technicien_id)
      .single()
    if (t?.nom) technicienNom = t.nom
  }

  const ctx = initResend(clientEmail)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { resend, fromEmail, recipient } = ctx

  // Priorité aux PDF fournis en base64 (wizard Mode Terrain).
  // Fallback : fetch depuis les URLs Storage (flux historique /nouveau).
  const [rapportB64, factureB64] = await Promise.all([
    body.pdfRapportBase64 || (interv.pdf_rapport_url ? fetchPdfAsBase64(interv.pdf_rapport_url) : null),
    body.pdfFactureBase64 || (facture.pdf_url ? fetchPdfAsBase64(facture.pdf_url) : null),
  ])
  if (!rapportB64) return NextResponse.json({ error: 'PDF rapport indisponible' }, { status: 502 })
  if (!factureB64) return NextResponse.json({ error: 'PDF facture indisponible' }, { status: 502 })

  const dateInterv = interv.date_realisee || interv.date_prevue || ''
  const ville = interv.ville || ''
  const reference = interv.reference || interv.id.slice(0, 8)
  const factureNum = facture.numero || ''
  const totalTTC = typeof facture.montant_ttc === 'number' ? facture.montant_ttc : null

  // URL avis Google : priorité table parametres > env var > fallback recherche Maps
  let reviewUrl = process.env.GOOGLE_REVIEW_URL
    || 'https://g.page/r/CR4wdMkwcd1QEBM/review'
  try {
    const { data: paramRow } = await sb
      .from('parametres')
      .select('valeur')
      .eq('cle', 'google_review_url')
      .maybeSingle()
    if (paramRow?.valeur) reviewUrl = paramRow.valeur
  } catch {
    // best-effort, on garde le fallback
  }

  // Planifie les relances avis (J+2, J+4, J+6) — même logique que /api/notify-client
  const tel = await getTelPrincipal()
  const skipReviews = !!body.skipReviews
  const days = [2, 4, 6]
  const followUps = skipReviews ? [] : await Promise.all(
    days.map(d => {
      const scheduledAt = new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString()
      return resend.emails.send({
        from: `Aprime fluides <${fromEmail}>`,
        to: recipient,
        subject: relanceSubject(d, (clientNom || 'Client').split(' ').slice(-1)[0]),
        html: emailRelance({ clientNom, technicienNom, ville, reviewUrl, jour: d, tel }),
        scheduledAt,
      })
    })
  )

  const relanceIds = followUps.map(f => f.data?.id).filter(Boolean) as string[]
  const signSecret = process.env.REVIEW_STOP_SECRET || process.env.NEXTAUTH_SECRET || process.env.RESEND_API_KEY || ''
  const stopExp = Date.now() + 10 * 24 * 60 * 60 * 1000
  const stopPayload = relanceIds.length > 0
    ? Buffer.from(JSON.stringify({ ids: relanceIds }), 'utf-8').toString('base64url')
    : ''
  const stopSig = stopPayload && signSecret ? signStopPayload(stopPayload, stopExp, signSecret) : ''
  const stopUrl = stopPayload && stopSig
    ? `${getBaseUrl(req)}/api/notify-client/stop-review?p=${encodeURIComponent(stopPayload)}&exp=${stopExp}&sig=${stopSig}`
    : ''

  const subject = `Votre rapport et facture${factureNum ? ` ${factureNum}` : ''}${ville ? ` — ${ville}` : ''}`

  const immediate = await resend.emails.send({
    from: `Aprime fluides <${fromEmail}>`,
    to: recipient,
    subject,
    html: emailCombine({
      clientNom, technicienNom, ville, dateIntervention: dateInterv,
      reference, factureNumero: factureNum, totalTTC, reviewUrl, stopUrl, tel,
    }),
    attachments: [
      { filename: `rapport-${reference}.pdf`, content: rapportB64 },
      { filename: `facture${factureNum ? `-${factureNum}` : ''}.pdf`, content: factureB64 },
    ],
  })

  if (immediate.error) {
    return NextResponse.json({
      error: `Resend a rejeté l'envoi : ${immediate.error.message || JSON.stringify(immediate.error)}`,
    }, { status: 500 })
  }

  // Marque la facture comme envoyée (best-effort)
  try {
    await sb
      .from('documents')
      .update({ envoye_email: clientEmail, envoye_at: new Date().toISOString(), statut: facture.statut === 'paye' ? 'paye' : 'envoye' })
      .eq('id', facture.id)
  } catch {}

  // Marque l'intervention : mail envoyé + bump terrain_step à 7 (= diffusion OK, étape réseaux)
  try {
    await sb
      .from('interventions')
      .update({
        mail_envoye_at: new Date().toISOString(),
        terrain_step: 7,
      })
      .eq('id', interventionId)
  } catch {}

  return NextResponse.json({
    ok: true,
    immediate_id: immediate.data?.id,
    followUp_ids: relanceIds,
  })
}

function relanceSubject(jour: number, prenom: string) {
  if (jour === 2) return `${prenom}, tout est rentré dans l'ordre ?`
  if (jour === 4) return `Un petit avis pour Aprime fluides ?`
  return `Dernière chance — partagez votre expérience`
}

function emailCombine({ clientNom, technicienNom, ville, dateIntervention, reference, factureNumero, totalTTC, reviewUrl, stopUrl, tel }: {
  clientNom: string; technicienNom: string; ville: string; dateIntervention: string;
  reference: string; factureNumero: string; totalTTC: number | null; reviewUrl: string; stopUrl: string; tel: string;
}) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville)
  const di = escapeHtml(dateIntervention)
  const ref = escapeHtml(reference)
  const num = escapeHtml(factureNumero)
  const ttc = typeof totalTTC === 'number' ? fmtEUR(totalTTC) : ''
  const ru = encodeURI(reviewUrl)
  const su = stopUrl ? encodeURI(stopUrl) : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:28px;color:#fff">
        <h1 style="margin:0;font-size:22px">Votre rapport et votre facture</h1>
        <p style="margin:6px 0 0;opacity:.85;font-size:13px">Aprime fluides</p>
      </td></tr>
      <tr><td style="padding:28px">
        <p>Bonjour ${cn},</p>
        <p>Suite à notre intervention du <strong>${di}</strong>${v ? ` à <strong>${v}</strong>` : ''}, vous trouverez ci-joint :</p>
        <ul style="font-size:14px">
          <li>📝 Votre rapport d'intervention détaillé (réf. ${ref})</li>
          <li>🧾 Votre facture${num ? ` ${num}` : ''}${ttc ? ` — ${ttc} TTC` : ''}</li>
        </ul>
        <p>Pour tout règlement ou question : <strong>${escapeHtml(tel)}</strong>.</p>

        <div style="margin:30px 0;padding:20px;background:#fef0e0;border-left:4px solid #e67e22;border-radius:4px">
          <p style="margin:0 0 10px;font-weight:bold;color:#a04e09">Votre avis compte</p>
          <p style="margin:0 0 14px;font-size:14px">Si vous êtes satisfait, prenez 30 secondes pour laisser un avis Google.</p>
          <a href="${ru}" style="display:inline-block;background:#e67e22;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">⭐ Laisser un avis Google</a>
          ${su ? `<p style="margin:12px 0 0;font-size:12px;color:#6b7280">Vous avez déjà laissé un avis ? <a href="${su}" style="color:#2c5fa8">Cliquez ici pour ne plus recevoir de relance</a>.</p>` : ''}
        </div>

        <p style="margin-top:30px;font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong> — Expert en assainissement<br>Aprime fluides</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Aprime fluides · ${escapeHtml(tel)} · www.aprime-fluides.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function emailRelance({ clientNom, technicienNom, ville, reviewUrl, jour, tel }: { clientNom: string; technicienNom: string; ville: string; reviewUrl: string; jour: number; tel: string }) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville)
  const ru = encodeURI(reviewUrl)
  const accroche = jour === 2
    ? `Nous espérons que tout est rentré dans l'ordre depuis notre intervention${v ? ` à ${v}` : ''}.`
    : jour === 4
    ? `Votre satisfaction est notre priorité. Un petit retour de votre part ferait toute la différence.`
    : `Nous ne voudrions pas vous solliciter davantage — c'est la dernière fois.`

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
        <p>${accroche}</p>
        <p>Une petite étoile prend moins d'<strong>une minute</strong> et nous aide énormément.</p>
        <div style="text-align:center;margin:30px 0">
          <a href="${ru}" style="display:inline-block;background:#e67e22;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px">⭐ Laisser un avis sur Google</a>
        </div>
        <p style="font-size:13px;color:#666">Merci pour votre confiance,<br><strong>${tn}</strong> — Expert en assainissement</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:14px;text-align:center;font-size:11px">
        Aprime fluides · ${escapeHtml(tel)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
