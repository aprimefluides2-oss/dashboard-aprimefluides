// Agences Aprime Fluides — zones desservies (siège : Bezons, 95).
export const AGENCES = [
  "Agence Paris & Île-de-France",
  "Agence Oise",
  "Agence Eure",
  "Agence Eure-et-Loir",
  "Agence Seine-Maritime",
  "Agence Aisne",
] as const

export type Agence = typeof AGENCES[number]
