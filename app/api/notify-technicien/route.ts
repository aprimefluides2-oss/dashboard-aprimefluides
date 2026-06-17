import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { EMAIL_RE, escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"
import { getTelPrincipal } from "@/lib/parametres"

export const maxDuration = 30

// Helpers locaux : on retourne `''` (pas `'—'`) car ces valeurs alimentent
// directement des templates HTML où une chaîne vide est plus propre.
function fmtDateFREmpty(iso?: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function fmtEUREmpty(n: number) {
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

type NotifyBody = {
  intervention_id?: string
  technicien_email?: string
  technicien_nom?: string
  client_nom?: string | null
  client_telephone?: string | null
  client_email?: string | null
  adresse_chantier?: string | null
  ville?: string | null
  code_postal?: string | null
  date_prevue?: string | null
  heure_prevue?: string | null
  type_intervention?: string | null
  urgence?: boolean
  prix_prevu?: number | null
  notes_internes?: string | null
}

export async function POST(req: NextRequest) {
  let body: NotifyBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const {
    intervention_id, technicien_email, technicien_nom,
    client_nom, client_telephone, client_email,
    adresse_chantier, ville, code_postal,
    date_prevue, heure_prevue, type_intervention,
    urgence, prix_prevu, notes_internes,
  } = body

  if (!intervention_id) {
    return NextResponse.json({ error: 'intervention_id requis' }, { status: 400 })
  }
  if (!technicien_email || !EMAIL_RE.test(technicien_email)) {
    return NextResponse.json({ error: 'Email technicien invalide' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY manquante' }, { status: 500 })
  }

  const requestOrigin = req.nextUrl?.origin
  const baseUrl = requestOrigin
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXTAUTH_URL
    || 'https://app-realisations.vercel.app'
  const lien = `${baseUrl.replace(/\/+$/, '')}/intervention/${intervention_id}`

  const fromEmail = getResendFromEmail()
  const recipient = getResendRecipient(technicien_email)
  const resend = new Resend(resendKey)

  const subject = `${urgence ? '🚨 URGENT — ' : ''}Nouvelle intervention${ville ? ` à ${ville}` : ''}${date_prevue ? ` (${fmtDateFREmpty(date_prevue)})` : ''}`

  const tel = await getTelPrincipal()

  const result = await resend.emails.send({
    from: `Aprime fluides <${fromEmail}>`,
    to: recipient,
    subject,
    html: emailTechHtml({
      lien,
      tel,
      technicienNom: technicien_nom || 'Technicien',
      clientNom: client_nom,
      clientTelephone: client_telephone,
      clientEmail: client_email,
      adresseChantier: adresse_chantier,
      ville,
      codePostal: code_postal,
      datePrevue: date_prevue,
      heurePrevue: heure_prevue,
      typeIntervention: type_intervention,
      urgence: !!urgence,
      prixPrevu: typeof prix_prevu === 'number' ? prix_prevu : null,
      notesInternes: notes_internes,
    }),
  })

  if (result.error) {
    return NextResponse.json({
      error: `Resend a rejeté l'envoi : ${result.error.message || JSON.stringify(result.error)}`,
      hint: result.error.name === 'validation_error'
        ? "Vérifie que ton domaine est bien vérifié sur https://resend.com/domains, ou définis RESEND_TEST_EMAIL pour rediriger les envois en attendant."
        : undefined,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: result.data?.id })
}

function emailTechHtml(p: {
  lien: string
  tel: string
  technicienNom: string
  clientNom?: string | null
  clientTelephone?: string | null
  clientEmail?: string | null
  adresseChantier?: string | null
  ville?: string | null
  codePostal?: string | null
  datePrevue?: string | null
  heurePrevue?: string | null
  typeIntervention?: string | null
  urgence: boolean
  prixPrevu?: number | null
  notesInternes?: string | null
}): string {
  const tn = escapeHtml(p.technicienNom)
  const cn = escapeHtml(p.clientNom || '—')
  const tel = escapeHtml(p.clientTelephone || '')
  const cem = escapeHtml(p.clientEmail || '')
  const adr = escapeHtml(p.adresseChantier || '')
  const v = escapeHtml(p.ville || '')
  const cp = escapeHtml(p.codePostal || '')
  const dp = escapeHtml(fmtDateFREmpty(p.datePrevue))
  const hp = escapeHtml(p.heurePrevue ? p.heurePrevue.slice(0, 5) : '')
  const ti = escapeHtml(p.typeIntervention || 'Intervention')
  const prix = typeof p.prixPrevu === 'number' ? fmtEUREmpty(p.prixPrevu) : ''
  const notes = escapeHtml(p.notesInternes || '')
  const urgenceBanner = p.urgence
    ? `<div style="background:#fee2e2;color:#b91c1c;padding:14px 20px;font-weight:bold;text-align:center;letter-spacing:1px;text-transform:uppercase;font-size:13px">🚨 URGENT — À traiter en priorité</div>`
    : ''

  const adresseLigne = [adr, [cp, v].filter(Boolean).join(' ')].filter(Boolean).join(' — ')
  const mapsHref = adresseLigne
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([adr, cp, v].filter(Boolean).join(' '))}`
    : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Nouvelle intervention</div>
        <h1 style="margin:0;font-size:22px">${ti}${v ? ` — ${v}` : ''}</h1>
        ${dp ? `<p style="margin:6px 0 0;opacity:.9;font-size:13px">${dp}${hp ? ` à ${hp}` : ''}</p>` : ''}
      </td></tr>
      ${urgenceBanner}
      <tr><td style="padding:30px">
        <p>Bonjour ${tn},</p>
        <p>Une nouvelle intervention t&rsquo;est assignée. Voici les détails :</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:14px">
          <tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;width:140px">Type</td>
              <td style="padding:10px 16px;font-weight:bold;color:#0e2a52">${ti}</td></tr>
          ${dp ? `<tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Date</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0">${dp}${hp ? ` — ${hp}` : ''}</td></tr>` : ''}
          <tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Client</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0">${cn}</td></tr>
          ${tel ? `<tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Téléphone</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0"><a href="tel:${tel}" style="color:#0e2a52;font-weight:bold;text-decoration:none">${tel}</a></td></tr>` : ''}
          ${cem ? `<tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Email</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0">${cem}</td></tr>` : ''}
          ${adresseLigne ? `<tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Adresse</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0">
                ${adresseLigne}
                ${mapsHref ? ` &middot; <a href="${mapsHref}" style="color:#2563eb;text-decoration:underline">Maps</a>` : ''}
              </td></tr>` : ''}
          ${prix ? `<tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Prix prévu</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0;font-weight:bold;color:#0e2a52">${prix}</td></tr>` : ''}
        </table>

        ${notes ? `<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:14px 18px;margin:14px 0">
          <div style="font-size:11px;font-weight:bold;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Notes internes</div>
          <div style="font-size:14px;color:#451a03;white-space:pre-wrap">${notes}</div>
        </div>` : ''}

        <div style="text-align:center;margin:30px 0 10px">
          <a href="${p.lien}" style="display:inline-block;background:#0e2a52;color:#fff;font-weight:bold;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px">Voir l&rsquo;intervention →</a>
        </div>
        <p style="text-align:center;font-size:12px;color:#64748b;margin:0">Lien direct : <a href="${p.lien}" style="color:#2563eb">${p.lien}</a></p>

        <p style="margin-top:30px;font-size:13px;color:#666">À bientôt sur le terrain,<br>L&rsquo;équipe LTDB</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Aprime fluides · ${escapeHtml(p.tel)} · www.aprime-fluide.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
