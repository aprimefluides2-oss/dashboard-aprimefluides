import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { getCalendarToken } from "@/lib/calendar-token"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/* ============ ICS HELPERS ============ */
function escapeICS(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Pliage RFC 5545 (75 octets max par ligne). */
function fold(line: string): string {
  const max = 73
  if (line.length <= max) return line
  const parts: string[] = [line.slice(0, max)]
  let i = max
  while (i < line.length) {
    parts.push(' ' + line.slice(i, i + max - 1))
    i += max - 1
  }
  return parts.join('\r\n')
}

function fmtUTCStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Bloc VTIMEZONE Europe/Paris (CET/CEST). */
const VTIMEZONE_PARIS = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Paris',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
].join('\r\n')

/* ============ HANDLER ============ */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = (url.searchParams.get('token') || '').trim()
  const expected = getCalendarToken()

  if (!expected) {
    return new NextResponse(
      'Calendar feed désactivé : NEXTAUTH_SECRET ou LTDB_CALENDAR_TOKEN manquant côté serveur.',
      { status: 503 },
    )
  }
  if (!token || token !== expected) {
    return new NextResponse('Token invalide.', { status: 401 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return new NextResponse('Supabase non configuré.', { status: 503 })
  }

  const { data: interventions, error } = await sb
    .from('interventions')
    .select('id, reference, type_intervention, adresse_chantier, ville, code_postal, date_prevue, heure_prevue, duree_estimee_min, urgence, statut, notes_internes, agence, client_id, technicien_id, updated_at')
    .order('date_prevue', { ascending: true })
    .range(0, 1999)

  if (error) {
    return new NextResponse(`Erreur Supabase : ${error.message}`, { status: 500 })
  }

  // Charge les clients & techniciens référencés en deux requêtes
  const clientIds = Array.from(new Set((interventions || []).map(i => i.client_id).filter(Boolean) as string[]))
  const techIds = Array.from(new Set((interventions || []).map(i => i.technicien_id).filter(Boolean) as string[]))
  const [{ data: clients }, { data: techniciens }] = await Promise.all([
    clientIds.length
      ? sb.from('clients').select('id, nom, telephone, email').in('id', clientIds)
      : Promise.resolve({ data: [] as any[] }),
    techIds.length
      ? sb.from('techniciens').select('id, nom, telephone').in('id', techIds)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const clientMap = new Map((clients || []).map((c: any) => [c.id, c]))
  const techMap = new Map((techniciens || []).map((t: any) => [t.id, t]))

  const origin = url.origin
  const now = fmtUTCStamp(new Date())

  const lines: string[] = []
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//LTDB CRM//Interventions//FR')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push('X-WR-CALNAME:LTDB Interventions')
  lines.push('X-WR-CALDESC:Planning des interventions LTDB — synchronisé depuis le CRM')
  lines.push('X-WR-TIMEZONE:Europe/Paris')
  lines.push('REFRESH-INTERVAL;VALUE=DURATION:PT15M')
  lines.push('X-PUBLISHED-TTL:PT15M')
  lines.push(VTIMEZONE_PARIS)

  for (const i of interventions || []) {
    if (!i.date_prevue) continue

    const client = i.client_id ? clientMap.get(i.client_id) : null
    const tech = i.technicien_id ? techMap.get(i.technicien_id) : null

    const summary = [
      i.urgence ? '🚨' : '',
      i.type_intervention || 'Intervention',
      client?.nom ? `— ${client.nom}` : '',
      i.ville ? `(${i.ville})` : '',
    ].filter(Boolean).join(' ').trim()

    const location = [
      i.adresse_chantier,
      [i.code_postal, i.ville].filter(Boolean).join(' '),
    ].filter(Boolean).join(', ')

    const descParts: string[] = []
    descParts.push(`Référence : ${i.reference || i.id.slice(0, 8)}`)
    descParts.push(`Statut : ${i.statut}`)
    if (client?.nom) {
      descParts.push(`Client : ${client.nom}${client.telephone ? ` — ${client.telephone}` : ''}${client.email ? ` — ${client.email}` : ''}`)
    }
    if (tech?.nom) {
      descParts.push(`Technicien : ${tech.nom}${tech.telephone ? ` — ${tech.telephone}` : ''}`)
    }
    if (i.agence) descParts.push(`Agence : ${i.agence}`)
    if (i.notes_internes) descParts.push(`Notes : ${i.notes_internes}`)
    descParts.push('')
    descParts.push(`Fiche : ${origin}/intervention/${i.id}`)
    const description = descParts.join('\n')

    // DTSTART / DTEND
    let dtstartLine: string, dtendLine: string
    if (i.heure_prevue) {
      const ymd = String(i.date_prevue).replaceAll('-', '')
      const hm = String(i.heure_prevue).slice(0, 5).replace(':', '')
      const dtstart = `${ymd}T${hm}00`

      // calc end = start + duree (default 60 min)
      const [y, mo, d] = String(i.date_prevue).split('-').map(Number)
      const [h, m] = String(i.heure_prevue).slice(0, 5).split(':').map(Number)
      const dur = i.duree_estimee_min ?? 60
      const endTs = new Date(y, mo - 1, d, h, m + dur)
      const ey = endTs.getFullYear()
      const em = String(endTs.getMonth() + 1).padStart(2, '0')
      const ed = String(endTs.getDate()).padStart(2, '0')
      const eh = String(endTs.getHours()).padStart(2, '0')
      const emin = String(endTs.getMinutes()).padStart(2, '0')
      const dtend = `${ey}${em}${ed}T${eh}${emin}00`

      dtstartLine = `DTSTART;TZID=Europe/Paris:${dtstart}`
      dtendLine = `DTEND;TZID=Europe/Paris:${dtend}`
    } else {
      // toute la journée
      const ymd = String(i.date_prevue).replaceAll('-', '')
      const next = new Date(i.date_prevue + 'T00:00:00Z')
      next.setUTCDate(next.getUTCDate() + 1)
      const nextYmd = next.toISOString().slice(0, 10).replaceAll('-', '')
      dtstartLine = `DTSTART;VALUE=DATE:${ymd}`
      dtendLine = `DTEND;VALUE=DATE:${nextYmd}`
    }

    let icsStatus = 'CONFIRMED'
    if (i.statut === 'annulee') icsStatus = 'CANCELLED'
    else if (i.statut === 'planifiee') icsStatus = 'TENTATIVE'

    let lastMod = now
    if (i.updated_at) {
      try { lastMod = fmtUTCStamp(new Date(i.updated_at)) } catch {}
    }

    lines.push('BEGIN:VEVENT')
    lines.push(fold(`UID:intervention-${i.id}@ltdb`))
    lines.push(fold(`DTSTAMP:${now}`))
    lines.push(fold(`LAST-MODIFIED:${lastMod}`))
    lines.push(fold(dtstartLine))
    lines.push(fold(dtendLine))
    lines.push(fold(`SUMMARY:${escapeICS(summary)}`))
    if (location) lines.push(fold(`LOCATION:${escapeICS(location)}`))
    lines.push(fold(`DESCRIPTION:${escapeICS(description)}`))
    lines.push(fold(`URL:${origin}/intervention/${i.id}`))
    if (i.urgence) lines.push('PRIORITY:1')
    lines.push(`STATUS:${icsStatus}`)
    if (i.type_intervention) lines.push(fold(`CATEGORIES:${escapeICS(i.type_intervention)}`))
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  // RFC 5545 : CRLF
  const ics = lines.join('\r\n') + '\r\n'

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="ltdb-interventions.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
