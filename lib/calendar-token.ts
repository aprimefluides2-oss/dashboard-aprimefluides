import { createHash } from "crypto"

/**
 * Token déterministe pour l'abonnement iCalendar.
 *
 * Dérivé de NEXTAUTH_SECRET (ou de APRIME_CALENDAR_TOKEN si fourni explicitement)
 * via SHA-256 — pas besoin d'ajouter une variable d'environnement supplémentaire,
 * mais la valeur reste imprévisible pour quelqu'un qui ne connaît pas le secret.
 *
 * Si aucun secret n'est configuré, retourne null (l'endpoint /api/calendar.ics
 * répondra alors 503 "non configuré").
 */
export function getCalendarToken(): string | null {
  const explicit = (process.env.APRIME_CALENDAR_TOKEN || '').trim()
  if (explicit) return explicit
  const secret = (process.env.NEXTAUTH_SECRET || '').trim()
  if (!secret) return null
  return createHash('sha256').update(secret + ':calendar:v1').digest('hex').slice(0, 32)
}
