/**
 * Calcul de date d'échéance depuis le texte libre stocké dans `documents.echeance`.
 * Formes connues côté UI : "Réglée", "À réception", "15/30/45/60 jours fin de mois".
 * Toute valeur non parseable → null (échéance inconnue, ne sort pas en "retard").
 */
export type EcheanceParsed = {
  /** Date d'échéance (YYYY-MM-DD) ou null si non calculable / déjà réglée. */
  dueDate: string | null
  /** true si la facture est marquée "Réglée" (paiement immédiat à l'émission). */
  isRegleeText: boolean
  /** Nombre de jours de retard si dueDate est dépassée (0 si à jour, null sinon). */
  daysOverdue: number | null
}

const REGLEE_RE = /^r[ée]gl[ée]e?$/i
const RECEPTION_RE = /^[àa]\s*r[ée]ception$/i
const FIN_MOIS_RE = /(\d+)\s*jours?\s*fin\s*de\s*mois/i

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n) }
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Dernier jour du mois contenant `d`. */
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

/**
 * Parse l'échéance d'un document.
 * @param echeance texte libre saisi côté UI
 * @param dateEmission YYYY-MM-DD (la date_emission du document)
 * @param today référence "aujourd'hui" (par défaut new Date()) — utile pour tester
 */
export function parseEcheance(
  echeance: string | null | undefined,
  dateEmission: string | null | undefined,
  today: Date = new Date(),
): EcheanceParsed {
  const txt = (echeance || '').trim()
  if (!txt) return { dueDate: null, isRegleeText: false, daysOverdue: null }

  if (REGLEE_RE.test(txt)) {
    return { dueDate: null, isRegleeText: true, daysOverdue: null }
  }

  if (!dateEmission) return { dueDate: null, isRegleeText: false, daysOverdue: null }
  const emission = new Date(dateEmission)
  if (isNaN(emission.getTime())) return { dueDate: null, isRegleeText: false, daysOverdue: null }

  let due: Date | null = null

  if (RECEPTION_RE.test(txt)) {
    due = emission
  } else {
    const m = FIN_MOIS_RE.exec(txt)
    if (m) {
      const days = parseInt(m[1], 10)
      const shifted = new Date(emission)
      shifted.setDate(shifted.getDate() + days)
      due = endOfMonth(shifted)
    }
  }

  if (!due) return { dueDate: null, isRegleeText: false, daysOverdue: null }

  // Comparaison sur jours civils (ignore l'heure)
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffMs = todayMidnight.getTime() - dueMidnight.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return {
    dueDate: ymd(due),
    isRegleeText: false,
    daysOverdue: days > 0 ? days : 0,
  }
}
