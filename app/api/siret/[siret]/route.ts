import { NextRequest, NextResponse } from "next/server"
import { cleanSiret, isSiretShape, type SiretLookupResult } from "@/lib/siret"

export const dynamic = 'force-dynamic'

/**
 * Recherche d'entreprise par SIRET via l'API publique recherche-entreprises.api.gouv.fr
 * (pas de clé requise). Renvoie raison sociale + adresse + activité.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { siret: string } }
) {
  const siret = cleanSiret(params.siret)
  if (!isSiretShape(siret)) {
    return NextResponse.json({ error: 'SIRET invalide (14 chiffres attendus)' }, { status: 400 })
  }

  const url = `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1&minimal=false`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { accept: 'application/json' },
      // L'API publique répond en quelques centaines de ms ; cache court pour limiter les appels
      next: { revalidate: 60 },
    })
  } catch (e: any) {
    return NextResponse.json({
      error: `API recherche-entreprises injoignable : ${e?.message || e}`,
    }, { status: 502 })
  }

  if (!res.ok) {
    return NextResponse.json({
      error: `API recherche-entreprises HTTP ${res.status}`,
    }, { status: 502 })
  }

  const data = await res.json().catch(() => null) as any
  const first = data?.results?.[0]
  if (!first) {
    return NextResponse.json({ error: 'SIRET introuvable' }, { status: 404 })
  }

  // L'API renvoie soit un établissement matché précis, soit le siège social.
  const matching = Array.isArray(first.matching_etablissements) && first.matching_etablissements.length > 0
    ? first.matching_etablissements.find((e: any) => cleanSiret(e?.siret || '') === siret) || first.matching_etablissements[0]
    : null

  const etab = matching || first.siege || {}

  const result: SiretLookupResult = {
    siret: cleanSiret(etab.siret || siret),
    siren: first.siren || (etab.siret || siret).slice(0, 9),
    nom: first.nom_complet || first.nom_raison_sociale || etab.nom_commercial || '',
    adresse: etab.adresse || '',
    code_postal: etab.code_postal || '',
    ville: etab.libelle_commune || etab.commune || '',
    activite: first.activite_principale || etab.activite_principale || null,
    forme_juridique: first.nature_juridique || null,
    etat: etab.etat_administratif || first.etat_administratif || 'A',
  }

  return NextResponse.json(result)
}
