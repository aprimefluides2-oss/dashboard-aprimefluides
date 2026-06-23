import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull, type AccordIntervention } from "@/lib/supabase"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { getTelPrincipal } from "@/lib/parametres"
import { fmtEUR, fmtDateFR } from "@/lib/format"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string } }

/**
 * POST /api/accords/[id]/envoyer — envoie au client une copie de l'accord
 * (PDF en pièce jointe) par email via Resend.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const accordId = params.id
  if (!accordId) return NextResponse.json({ error: 'ID accord manquant' }, { status: 400 })

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const { data: aData } = await sb
    .from('accords_intervention')
    .select('*')
    .eq('id', accordId)
    .maybeSingle()
  if (!aData) return NextResponse.json({ error: 'Accord introuvable' }, { status: 404 })
  const accord = aData as AccordIntervention

  const email = (body.email || accord.client_email || '').trim()
  const ctx = initResend(email)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { resend, fromEmail, recipient } = ctx

  if (!accord.pdf_url) {
    return NextResponse.json(
      { error: "Le PDF de l'accord n'est pas encore généré." },
      { status: 400 },
    )
  }

  // Récupération du PDF archivé pour le joindre à l'email.
  let pdfBase64: string
  try {
    const r = await fetch(accord.pdf_url, { cache: 'no-store' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    pdfBase64 = Buffer.from(await r.arrayBuffer()).toString('base64')
  } catch (e) {
    return NextResponse.json(
      { error: `Récupération du PDF échouée : ${e instanceof Error ? e.message : 'erreur'}` },
      { status: 502 },
    )
  }

  const tel = await getTelPrincipal()
  const subject = `Votre accord d'intervention${accord.reference ? ` ${accord.reference}` : ''} — Aprime fluides`

  const result = await resend.emails.send({
    from: `Aprime fluides <${fromEmail}>`,
    to: recipient,
    subject,
    html: emailAccord({
      clientNom: accord.client_nom,
      reference: accord.reference,
      valideAt: accord.valide_at,
      totalTTC: accord.total_ttc,
      tel,
    }),
    attachments: [
      { filename: `accord-${accord.reference || accord.id}.pdf`, content: pdfBase64 },
    ],
  })

  if (result.error) {
    return NextResponse.json(
      {
        error: `Resend a rejeté l'envoi : ${result.error.message || JSON.stringify(result.error)}`,
        hint:
          result.error.name === 'validation_error'
            ? 'Vérifie que le domaine est vérifié sur resend.com/domains, ou définis RESEND_TEST_EMAIL.'
            : undefined,
      },
      { status: 500 },
    )
  }

  // Trace l'envoi ; mémorise l'email utilisé s'il diffère de la fiche.
  const patch: Record<string, string> = { copie_envoyee_at: new Date().toISOString() }
  if (email && email !== accord.client_email) patch.client_email = email
  const { error: updError } = await sb
    .from('accords_intervention')
    .update(patch)
    .eq('id', accordId)

  return NextResponse.json({
    ok: true,
    id: result.data?.id,
    ...(updError ? { warning: 'Email envoyé mais le suivi n\'a pas été enregistré.' } : {}),
  })
}

function emailAccord({
  clientNom,
  reference,
  valideAt,
  totalTTC,
  tel,
}: {
  clientNom: string
  reference: string | null
  valideAt: string | null
  totalTTC: number
  tel: string
}): string {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const ref = escapeHtml(reference || '')
  const dateValide = valideAt ? escapeHtml(fmtDateFR(valideAt)) : ''
  const ttc = fmtEUR(totalTTC)
  const telEsc = escapeHtml(tel)

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Accord d'intervention</div>
        <h1 style="margin:0;font-size:22px">${ref ? `Accord ${ref}` : 'Votre accord d’intervention'}</h1>
        ${dateValide ? `<p style="margin:6px 0 0;opacity:.85;font-size:13px">Validé le ${dateValide}</p>` : ''}
      </td></tr>
      <tr><td style="padding:30px">
        <p>Bonjour ${cn},</p>
        <p>Vous trouverez ci-joint la copie de votre <strong>accord d'intervention</strong> :
        devis détaillé, demande expresse d'intervention en urgence et information sur le droit
        de rétractation.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <tr><td style="background:#f8fafc;padding:16px 20px;color:#475569;font-size:13px">Montant total</td>
              <td style="background:#f8fafc;padding:16px 20px;text-align:right;color:#0e2a52;font-size:18px;font-weight:bold">${ttc}</td></tr>
        </table>
        <p style="font-size:13px;color:#475569">Conservez ce document : il fait foi de votre accord
        avant le démarrage des travaux.</p>
        <p style="font-size:14px">Pour toute question, contactez-nous au <strong>${telEsc}</strong>
        ou répondez à ce mail.</p>
        <p style="margin-top:30px;font-size:13px;color:#666">Cordialement,<br>Aprime fluides</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Aprime fluides · ${telEsc} · www.aprime-fluides.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
