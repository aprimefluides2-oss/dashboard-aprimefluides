/**
 * Calcul du devis d'un accord d'intervention.
 * Module pur — importable côté client (calcul live) ET serveur (route POST,
 * qui ne fait jamais confiance aux totaux envoyés par le client).
 */

/** Une ligne de devis en cours de saisie (avant gel en base). */
export type LigneDraft = {
  tarif_type: string | null
  label: string
  prix_unitaire: number
  unite: string
  quantite: number
  urgent: boolean
}

export type DevisTotaux = {
  /** Somme des lignes de prestations (hors frais de déplacement). */
  sousTotalPrestations: number
  /** Total HT = prestations + frais de déplacement. */
  totalHT: number
  totalTVA: number
  totalTTC: number
}

/** Arrondi comptable à 2 décimales. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Montant d'une ligne : prix unitaire × quantité. */
export function totalLigne(ligne: { prix_unitaire: number; quantite: number }): number {
  const pu = Number(ligne.prix_unitaire) || 0
  const qte = Number(ligne.quantite) || 0
  return round2(pu * qte)
}

/**
 * Totaux du devis. `tauxTVA` en pourcentage — 0 pour Aprime fluides (franchise en base
 * de TVA, art. 293 B du CGI : totalHT = totalTTC).
 */
export function calculDevis(
  lignes: ReadonlyArray<{ prix_unitaire: number; quantite: number }>,
  fraisDeplacement: number,
  tauxTVA: number,
): DevisTotaux {
  const sousTotalPrestations = round2(
    lignes.reduce((somme, l) => somme + totalLigne(l), 0),
  )
  const frais = Number(fraisDeplacement) || 0
  const totalHT = round2(sousTotalPrestations + frais)
  const totalTVA = round2((totalHT * (Number(tauxTVA) || 0)) / 100)
  const totalTTC = round2(totalHT + totalTVA)
  return { sousTotalPrestations, totalHT, totalTVA, totalTTC }
}
