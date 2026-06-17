/**
 * Helpers SIRET : nettoyage, validation, types de la réponse.
 * L'appel à l'API publique recherche-entreprises.api.gouv.fr est fait
 * côté serveur via /api/siret/[siret] pour éviter les soucis CORS et
 * pouvoir filtrer la réponse.
 */

/** Retire tous les espaces / séparateurs d'un SIRET saisi. */
export function cleanSiret(input: string): string {
  return (input || '').replace(/[\s.-]/g, '')
}

/** Vrai si la chaîne est exactement 14 chiffres (pas de checksum Luhn). */
export function isSiretShape(input: string): boolean {
  const c = cleanSiret(input)
  return /^\d{14}$/.test(c)
}

export interface SiretLookupResult {
  siret: string
  siren: string
  nom: string                  // Raison sociale ou enseigne
  adresse: string              // Adresse de l'établissement
  code_postal: string
  ville: string
  activite: string | null      // Libellé activité principale (NAF)
  forme_juridique: string | null
  etat: 'A' | 'F' | string     // A = actif, F = fermé
}
