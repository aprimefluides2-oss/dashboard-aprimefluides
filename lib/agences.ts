export const AGENCES = [
  "Agence de Toulon",
  "Agence d'Aubagne",
  "Agence de Marseille",
  "Agence de Fréjus",
  "Agence d'Aix-en-Provence",
  "Agence de Brignoles",
  "Agence de Lattes",
] as const

export type Agence = typeof AGENCES[number]
