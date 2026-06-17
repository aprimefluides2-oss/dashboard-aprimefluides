/**
 * Textes légaux du document « Accord d'Intervention » (PRD §7).
 * Source de vérité unique des formulations — partagée par l'aperçu écran
 * (ApercuAccord) et le PDF (AccordPDF).
 *
 * ⚠ Modèles à faire valider par un juriste / l'assureur RC pro avant prod.
 */
import type { AccordIntervention } from "@/lib/supabase"

type AdresseSource = Pick<
  AccordIntervention,
  'client_adresse' | 'client_code_postal' | 'client_ville'
>

export const ACCORD_TITRE = "Accord d'intervention"

/** Adresse complète du client sur une ligne (adresse, CP ville). */
export function adresseClientComplete(a: AdresseSource): string {
  const ligne2 = [a.client_code_postal, a.client_ville]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join(' ')
  return [(a.client_adresse || '').trim(), ligne2].filter(Boolean).join(', ')
}

/** "21/05/2026 à 14h30" — date + heure pour le Bloc A. */
export function formatDateHeureFR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const heure = d
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .replace(':', 'h')
  return `${date} à ${heure}`
}

/** Bloc A — demande expresse d'intervention en urgence. */
export function blocADemandeExpresse(accord: AccordIntervention, dateHeure: string): string {
  const nom = (accord.client_nom || '').trim() || '[nom du client]'
  const adresse = adresseClientComplete(accord) || '[adresse du client]'
  return (
    `Je soussigné(e) ${nom}, demeurant ${adresse}, sollicite expressément ` +
    `Aprime fluides pour une intervention de dépannage à réaliser ` +
    `en urgence à mon domicile ce jour, le ${dateHeure || '[date — heure]'}. Je demande ` +
    `que les travaux strictement nécessaires pour répondre à cette urgence soient ` +
    `exécutés immédiatement, avant l'expiration du délai de rétractation.`
  )
}

/** Bloc C — paragraphe d'information + renonciation (toujours affiché). */
export const BLOC_C_INFORMATION =
  `Information : la prestation étant conclue à mon domicile, je dispose en principe ` +
  `d'un délai de rétractation de 14 jours (art. L221-18 du Code de la consommation). ` +
  `Toutefois, s'agissant de travaux de réparation / entretien réalisés en urgence à mon ` +
  `domicile et expressément sollicités par moi, le droit de rétractation ne s'applique pas, ` +
  `dans la limite des pièces et travaux strictement nécessaires pour répondre à l'urgence ` +
  `(art. L221-28 8° du Code de la consommation). Je reconnais en avoir été informé(e) et ` +
  `renoncer à mon droit de rétractation pour ces travaux urgents dont je demande ` +
  `l'exécution immédiate.`

/** Bloc C — paragraphe additionnel, affiché uniquement si des travaux non urgents existent. */
export const BLOC_C_TRAVAUX_NON_URGENTS =
  `Pour les travaux complémentaires non strictement nécessaires à l'urgence, identifiés ` +
  `« non urgent » au devis ci-dessus, je conserve mon délai de rétractation de 14 jours. ` +
  `Un formulaire type de rétractation m'est remis avec le présent document.`

/** Mention TVA portée sur le devis quand le taux est nul (franchise en base). */
export const MENTION_TVA_FRANCHISE = 'TVA non applicable — art. 293 B du CGI'
