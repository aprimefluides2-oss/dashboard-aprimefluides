import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { getTelPrincipal } from "@/lib/parametres"

type IntervSummary = {
  reference: string | null
  date: string | null
  type: string | null
  ville: string | null
  statut: string | null
}

type DocSummary = {
  type: string
  numero: string | null
  date: string | null
  montant_ttc: number | null
  statut: string | null
  pdf_url: string | null
}

const TYPE_LABEL: Record<string, string> = {
  facture: 'Facture',
  devis: 'Devis',
  attestation: 'Attestation',
  rapport: 'Rapport',
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function fmtMontant(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export async function POST(req: NextRequest) {
  let body: {
    email?: string
    clientNom?: string
    ville?: string
    interventions?: IntervSummary[]
    documents?: DocSummary[]
    caTotal?: number
    caPaye?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const email = (body.email || '').trim()
  const ctx = initResend(email)
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const clientNom = body.clientNom || 'Client'
  const ville = body.ville || ''
  const interventions = Array.isArray(body.interventions) ? body.interventions : []
  const documents = Array.isArray(body.documents) ? body.documents : []
  const caTotal = typeof body.caTotal === 'number' ? body.caTotal : 0
  const caPaye = typeof body.caPaye === 'number' ? body.caPaye : 0

  const tel = await getTelPrincipal()
  const html = renderRecap({ clientNom, ville, interventions, documents, caTotal, caPaye, tel })

  const result = await ctx.resend.emails.send({
    from: `Aprime fluides <${ctx.fromEmail}>`,
    to: ctx.recipient,
    subject: `Votre récapitulatif — ${clientNom}`,
    html,
  })

  if (result.error) {
    return NextResponse.json({
      error: `Resend a rejeté l'envoi : ${result.error.message || JSON.stringify(result.error)}`,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: result.data?.id })
}

function renderRecap({ clientNom, ville, interventions, documents, caTotal, caPaye, tel }: {
  clientNom: string; ville: string;
  interventions: IntervSummary[]; documents: DocSummary[];
  caTotal: number; caPaye: number; tel: string;
}): string {
  const cn = escapeHtml(clientNom)
  const v = escapeHtml(ville)

  const intervRows = interventions.length === 0
    ? `<tr><td colspan="4" style="padding:12px;text-align:center;color:#888;font-style:italic">Aucune intervention enregistrée.</td></tr>`
    : interventions.map(i => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(fmtDate(i.date))}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(i.reference || '—')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(i.type || '')}${i.ville ? ` — ${escapeHtml(i.ville)}` : ''}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(i.statut || '')}</td>
        </tr>`).join('')

  const docRows = documents.length === 0
    ? `<tr><td colspan="5" style="padding:12px;text-align:center;color:#888;font-style:italic">Aucun document.</td></tr>`
    : documents.map(d => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(TYPE_LABEL[d.type] || d.type)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(fmtDate(d.date))}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(d.numero || '—')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(fmtMontant(d.montant_ttc))}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(d.statut || '')}</td>
        </tr>`).join('')

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:28px;color:#fff">
        <h1 style="margin:0;font-size:22px">Votre récapitulatif</h1>
        <p style="margin:6px 0 0;opacity:.85;font-size:13px">Aprime fluides · ${cn}${v ? ` — ${v}` : ''}</p>
      </td></tr>
      <tr><td style="padding:24px 28px">
        <p style="margin:0 0 16px">Bonjour,</p>
        <p style="margin:0 0 16px">Vous trouverez ci-dessous le récapitulatif de vos interventions et documents.</p>

        <div style="background:#f4f6fa;border-radius:8px;padding:14px 16px;margin:18px 0">
          <table width="100%" style="font-size:13px"><tr>
            <td><strong>${interventions.length}</strong> intervention${interventions.length > 1 ? 's' : ''}</td>
            <td><strong>${documents.length}</strong> document${documents.length > 1 ? 's' : ''}</td>
            <td>CA total : <strong>${escapeHtml(fmtMontant(caTotal))}</strong></td>
            <td>Réglé : <strong>${escapeHtml(fmtMontant(caPaye))}</strong></td>
          </tr></table>
        </div>

        <h2 style="font-size:14px;color:#0e2a52;margin:22px 0 10px">Interventions</h2>
        <table width="100%" style="border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f4f6fa">
            <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #ddd">Date</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #ddd">Référence</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #ddd">Type / Ville</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #ddd">Statut</th>
          </tr></thead>
          <tbody>${intervRows}</tbody>
        </table>

        <h2 style="font-size:14px;color:#0e2a52;margin:24px 0 10px">Documents</h2>
        <table width="100%" style="border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f4f6fa">
            <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #ddd">Type</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #ddd">Date</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #ddd">N°</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #ddd">Montant TTC</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #ddd">Statut</th>
          </tr></thead>
          <tbody>${docRows}</tbody>
        </table>

        <p style="margin:24px 0 0;font-size:12px;color:#666">
          Pour toute question : ${escapeHtml(tel)} · contact@www.aprime-fluide.fr
        </p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:14px;text-align:center;font-size:11px">
        Aprime fluides · ${escapeHtml(tel)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
