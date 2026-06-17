import { getSupabaseOrNull } from "@/lib/supabase"

/**
 * Numéro de téléphone principal LTDB — source unique de vérité côté code.
 * La valeur de référence vit dans la table `parametres` (clé `TEL_PRINCIPAL`).
 * Cette constante sert uniquement de repli si la base est injoignable ou
 * pour les contextes synchrones (composants client / PDF).
 */
export const TEL_PRINCIPAL_FALLBACK = ''

/**
 * Lit un paramètre depuis la table `parametres`. Best-effort : en cas d'erreur
 * (Supabase non configuré, table absente, réseau) on retourne le fallback.
 */
export async function getParametre(cle: string, fallback = ''): Promise<string> {
  try {
    const sb = getSupabaseOrNull()
    if (!sb) return fallback
    const { data } = await sb
      .from('parametres')
      .select('valeur')
      .eq('cle', cle)
      .maybeSingle()
    return data?.valeur?.trim() || fallback
  } catch {
    return fallback
  }
}

/** Renvoie le téléphone principal LTDB (table `parametres`, repli sur la constante). */
export function getTelPrincipal(): Promise<string> {
  return getParametre('TEL_PRINCIPAL', TEL_PRINCIPAL_FALLBACK)
}
