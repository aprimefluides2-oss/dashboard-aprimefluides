import { NextRequest, NextResponse } from "next/server"
import { getCalendarToken } from "@/lib/calendar-token"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Renvoie l'URL d'abonnement iCalendar pour Google Agenda / Apple Calendar / Outlook.
 *
 * Le secret réel est le token dans l'URL (dérivé de NEXTAUTH_SECRET) — pas
 * la connaissance de cet endpoint. Si tu veux révoquer l'accès, change la
 * variable d'environnement LTDB_CALENDAR_TOKEN (ou rotate NEXTAUTH_SECRET).
 */
export async function GET(req: NextRequest) {
  const token = getCalendarToken()
  if (!token) {
    return NextResponse.json({
      configured: false,
      error: 'NEXTAUTH_SECRET (ou LTDB_CALENDAR_TOKEN) non configuré côté serveur.',
    })
  }

  const url = new URL(req.url)
  const origin = url.origin
  const icsUrl = `${origin}/api/calendar.ics?token=${encodeURIComponent(token)}`
  const webcalUrl = icsUrl.replace(/^https?:\/\//, 'webcal://')
  const gcalDeeplink = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(webcalUrl)}`

  return NextResponse.json({
    configured: true,
    icsUrl,
    webcalUrl,
    gcalDeeplink,
  })
}
