/**
 * Hygiène orthographique des textes issus de la dictée vocale.
 *
 * Pourquoi (audit 2026-07-30) : la réalisation « sanibroyeur Clichy » publiée en
 * prod contenait « pannes d'apparuits sanitaires » et « sanibroyeur qui
 * disjonc te ». Ces coquilles viennent de la chaîne dictée → Whisper → LLM :
 * Whisper invente des mots plausibles sur le vocabulaire métier, et le LLM les
 * recopie fidèlement (le prompt lui interdit d'inventer, donc il n'ose pas
 * corriger). Une coquille visible coûte double : confiance du lecteur ET
 * confiance d'extraction des moteurs IA, qui dévaluent une source mal écrite.
 *
 * Deux fonctions volontairement distinctes :
 *  - `fixTranscription` : nettoie la dictée AVANT de la donner au LLM (le modèle
 *    reçoit alors le bon mot et le réutilise partout) ;
 *  - `fixGeneratedText` : filet de sécurité sur les textes produits, applicable
 *    à du HTML (ne touche jamais aux balises ni aux attributs).
 *
 * Règle : on ne corrige QUE des formes qui n'existent pas en français. Aucune
 * réécriture de style, aucun mot ajouté — la fidélité à la dictée reste la règle.
 */

/**
 * Mots inexistants observés en sortie de transcription → forme correcte.
 * Clé = motif insensible à la casse et aux limites de mot.
 */
const GLOSSAIRE: Array<[RegExp, string]> = [
  // Observés en prod
  [/\bapparuits?\b/gi, 'appareils'],
  [/\bappar[ée]ils?\s+sanitaires?\b/gi, 'appareils sanitaires'],
  // Vocabulaire métier fréquemment mal transcrit
  [/\bsani\s*-?\s*broyeur/gi, 'sanibroyeur'],
  [/\bsanibroyeurs?\s+broyeur/gi, 'sanibroyeur'],
  [/\bsanni?broyeur/gi, 'sanibroyeur'],
  [/\bhydro\s*-?\s*curage/gi, 'hydrocurage'],
  [/\bsyphon/gi, 'siphon'],
  [/\bcanalisations?\s+bouch[ée]s\b/gi, 'canalisations bouchées'],
  [/\bfosse\s+toute\s+eaux?\b/gi, 'fosse toutes eaux'],
  [/\bbac\s+[àa]\s+graisses\b/gi, 'bac à graisse'],
  [/\bpompe\s+de\s+relevement\b/gi, 'pompe de relevage'],
  [/\beaux?\s+us[ée]s?\b/gi, 'eaux usées'],
  [/\bregard\s+de\s+visites?\b/gi, 'regard de visite'],
  [/\bcolonne\s+e\.?\s?u\.?\b/gi, 'colonne EU'],
  [/\bdisjoncteurs?\s+diff[ée]rentiels?\b/gi, 'disjoncteur différentiel'],
]

/**
 * Radicaux métier jamais autonomes en français : s'ils sont suivis d'un espace
 * puis d'une terminaison, c'est un mot coupé par la transcription
 * (« disjonc te » → « disjoncte »). Recoller est donc toujours correct.
 */
const RADICAUX_COUPES = [
  'disjonc',
  'd[ée]bouch',
  'install',
  'remplac',
  '[ée]vacu',
  'raccord',
  'fonctionn',
  'branch',
  'colmat',
  'obstru',
  'curag',
  'vidang',
]
const TERMINAISONS =
  '(?:e|es|ent|é|ée|és|ées|er|ez|ait|aient|era|eront|age|ages|ement|ements|tion|tions|teur|teurs)'
const MOTS_COUPES = new RegExp(
  `\\b(${RADICAUX_COUPES.join('|')})\\s+(${TERMINAISONS})\\b`,
  'gi',
)

/** Applique glossaire + recollage de mots coupés à du texte brut. */
function corrigerTexte(texte: string): string {
  let out = texte
  out = out.replace(MOTS_COUPES, (_m, radical, fin) => `${radical}${fin}`)
  for (const [motif, remplacement] of GLOSSAIRE) out = out.replace(motif, remplacement)
  // Espaces parasites avant ponctuation faible + espaces doublés
  out = out.replace(/\s+([,.;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ')
  return out
}

/** Nettoie une dictée (texte brut) avant de l'envoyer au LLM. */
export function fixTranscription(transcription: string | null | undefined): string {
  if (!transcription) return ''
  return corrigerTexte(String(transcription))
}

/**
 * Nettoie un texte GÉNÉRÉ, éventuellement HTML : on ne corrige que les segments
 * hors balises, pour ne jamais toucher un href, une classe ou un attribut.
 */
export function fixGeneratedText(texte: string | null | undefined): string {
  if (!texte) return ''
  const s = String(texte)
  if (!s.includes('<')) return corrigerTexte(s)
  return s
    .split(/(<[^>]*>)/g)
    .map((part) => (part.startsWith('<') ? part : corrigerTexte(part)))
    .join('')
}
