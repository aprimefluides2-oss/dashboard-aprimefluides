// Secteurs d'intervention Aprime Fluides, par département.
//
// Volontairement SANS NOM D'INTERVENANT : chaque rapport est signé
// « Agent de secteur — <département> », déduit du code postal saisi, et
// accompagné de la signature enregistrée sur l'appareil.
//
// Le code postal saisi sur /nouveau pilote automatiquement :
//   - le département (2 premiers chiffres du CP),
//   - l'agence rattachée (onglets « Département / Agence »),
//   - le libellé de l'agent porté par le rapport / le devis PDF.

import { AGENCES, type Agence } from "@/lib/agences"

export type DepartementSecteur = {
  /** Code département sur 2 caractères, tel qu'extrait du code postal. */
  code: string
  /** Nom du département : « Val-d'Oise ». */
  nom: string
  /** Agence de rattachement (doit exister dans lib/agences.ts). */
  agence: Agence
}

const [IDF, OISE, EURE, EURE_ET_LOIR, SEINE_MARITIME, AISNE] = AGENCES

/** Libellé générique, quand le département n'est pas encore connu. */
export const LIBELLE_AGENT = "Agent de secteur"

/**
 * Les 8 départements franciliens + les 5 zones limitrophes couvertes par les
 * agences. Ordre = ordre d'affichage sur la page /agents.
 */
export const SECTEURS: DepartementSecteur[] = [
  { code: "75", nom: "Paris", agence: IDF },
  { code: "77", nom: "Seine-et-Marne", agence: IDF },
  { code: "78", nom: "Yvelines", agence: IDF },
  { code: "91", nom: "Essonne", agence: IDF },
  { code: "92", nom: "Hauts-de-Seine", agence: IDF },
  { code: "93", nom: "Seine-Saint-Denis", agence: IDF },
  { code: "94", nom: "Val-de-Marne", agence: IDF },
  { code: "95", nom: "Val-d'Oise", agence: IDF },
  { code: "60", nom: "Oise", agence: OISE },
  { code: "27", nom: "Eure", agence: EURE },
  { code: "28", nom: "Eure-et-Loir", agence: EURE_ET_LOIR },
  { code: "76", nom: "Seine-Maritime", agence: SEINE_MARITIME },
  { code: "02", nom: "Aisne", agence: AISNE },
]

const PAR_CODE: Record<string, DepartementSecteur> = Object.fromEntries(
  SECTEURS.map(s => [s.code, s])
)

/**
 * Extrait le code département d'un code postal.
 * Renvoie null tant que la saisie ne contient pas au moins 2 chiffres.
 * Gère les DOM (971xx…) sur 3 chiffres pour ne pas les confondre avec le 97.
 */
export function departementFromCodePostal(cp?: string | null): string | null {
  const digits = (cp || "").replace(/\D/g, "")
  if (digits.length < 2) return null
  const deux = digits.slice(0, 2)
  if ((deux === "97" || deux === "98") && digits.length >= 3) return digits.slice(0, 3)
  return deux
}

/** Secteur (département + agence) correspondant à un code postal. */
export function secteurForCodePostal(cp?: string | null): DepartementSecteur | null {
  const code = departementFromCodePostal(cp)
  return code ? PAR_CODE[code] ?? null : null
}

/** Secteur correspondant à un code département déjà extrait. */
export function secteurForDepartement(code?: string | null): DepartementSecteur | null {
  return code ? PAR_CODE[code] ?? null : null
}

/** Agence à sélectionner automatiquement pour ce code postal. */
export function agenceForCodePostal(cp?: string | null): Agence | null {
  return secteurForCodePostal(cp)?.agence ?? null
}

/** Libellé lisible du département : « Val-d'Oise (95) ». */
export function labelSecteur(s: DepartementSecteur): string {
  return `${s.nom} (${s.code})`
}

/** Libellé porté par le rapport : « Agent de secteur — Val-d'Oise (95) ». */
export function libelleAgentSecteur(s: DepartementSecteur): string {
  return `${LIBELLE_AGENT} — ${labelSecteur(s)}`
}

/**
 * Libellé d'agent à poser sur un rapport d'après le code postal saisi.
 * Retombe sur « Agent de secteur » tant que le département est inconnu, pour
 * qu'un rapport ne parte jamais sans intervenant renseigné.
 */
export function libelleAgentForCodePostal(cp?: string | null): string {
  const secteur = secteurForCodePostal(cp)
  return secteur ? libelleAgentSecteur(secteur) : LIBELLE_AGENT
}

/** Vrai si le nom porté par un rapport est un libellé « Agent de secteur… ». */
export function estLibelleAgentSecteur(nom?: string | null): boolean {
  return (nom || "").trim().startsWith(LIBELLE_AGENT)
}
