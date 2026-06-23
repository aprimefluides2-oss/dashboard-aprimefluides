import type { EmetteurData } from "@/components/DevisPDF"
import type { Agence } from "@/lib/agences"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

/**
 * Identité émetteur Aprime fluides — source unique pour tous les PDFs.
 */
export const APRIME_EMETTEUR: EmetteurData = {
  raisonSociale: 'Aprime fluides',
  adresseLignes: ['1, rue Jean Carasso', '95000 Bezons'],
  telephone: TEL_PRINCIPAL_FALLBACK,
  email: 'contact@aprime-fluides.fr',
  rcs: '',
  capital: '',
  siret: '48477517600023',
}

export type FactureEmetteurDataLite = EmetteurData & { agence?: Agence | string }

export function aprimeFactureEmetteur(agence?: Agence | string, telephone?: string): FactureEmetteurDataLite {
  return {
    ...APRIME_EMETTEUR,
    telephone: telephone?.trim() || APRIME_EMETTEUR.telephone,
    agence: agence || undefined,
  }
}
