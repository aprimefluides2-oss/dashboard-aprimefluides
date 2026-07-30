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
 * ⚠ PIÈGE `\b` + ACCENTS (vécu : « eaux usées » → « eaux uséeses »).
 * En JS, `é` n'est PAS un caractère de mot : `\b` place donc une frontière
 * ENTRE « usé » et « es », si bien que /us[ée]s?\b/ matche « usé » au milieu de
 * « usées » et la réécriture duplique la fin du mot. On n'utilise donc JAMAIS
 * `\b` en fin de motif ici : on borne avec FIN (lookahead « aucune lettre
 * ensuite ») et DEB (lookbehind), qui connaissent les accents.
 *
 * INVARIANT NON NÉGOCIABLE : un texte déjà correct doit ressortir IDENTIQUE
 * (idempotence). Toute règle ajoutée doit être couverte dans
 * `scripts/test-fix-transcription.ts` (cas à corriger + cas témoins intacts).
 */

/** Bornes de mot conscientes des accents (≠ \b, cf. en-tête). */
const DEB = '(?<![A-Za-zÀ-ÖØ-öø-ÿ])'
const FIN = '(?![A-Za-zÀ-ÖØ-öø-ÿ])'

/** Construit /DEB + corps + FIN/gi. */
function motif(corps: string): RegExp {
  return new RegExp(`${DEB}(?:${corps})${FIN}`, 'gi')
}

/**
 * Mots inexistants observés en sortie de transcription → forme correcte.
 * On ne liste QUE des formes fausses en français : jamais un motif qui pourrait
 * matcher une orthographe déjà valide.
 */
const GLOSSAIRE: Array<[RegExp, string]> = [
  // Observés en prod
  [motif('apparuits?'), 'appareils'],
  // Vocabulaire métier fréquemment mal transcrit (formes fausses uniquement)
  [motif('sani\\s+broyeurs?|sani-broyeurs?|sannibroyeurs?|sanibroyeurs?\\s+broyeurs?'), 'sanibroyeur'],
  [motif('hydro\\s+curages?|hydro-curages?'), 'hydrocurage'],
  [motif('syphons?'), 'siphon'],
  [motif('fosses?\\s+toute\\s+eaux?'), 'fosse toutes eaux'],
  [motif('bacs?\\s+[àa]\\s+graisses'), 'bac à graisse'],
  [motif('pompes?\\s+de\\s+relevement'), 'pompe de relevage'],
  [motif('regards?\\s+de\\s+visites'), 'regard de visite'],
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
  'colmat',
  'obstru',
]
/**
 * Terminaisons triées du plus long au plus court : la borne FIN interdit déjà un
 * match partiel (« ation » dans « ations » échoue faute de fin de mot), mais
 * l'ordre garde le motif lisible et robuste si FIN évolue.
 */
const TERMINAISONS = [
  'ements', 'ations', 'aient', 'ement', 'ation', 'eront', 'tions', 'teurs',
  'ants', 'ents', 'ages', 'tion', 'teur', 'tent', 'ant', 'ent', 'ées', 'era',
  'age', 'ait', 'tes', 'és', 'ée', 'té', 'es', 'er', 'ez', 'te', 'e',
].join('|')
const MOTS_COUPES = new RegExp(
  `${DEB}(${RADICAUX_COUPES.join('|')})\\s+(${TERMINAISONS})${FIN}`,
  'gi',
)

/** Applique glossaire + recollage de mots coupés à du texte brut. */
function corrigerTexte(texte: string): string {
  let out = texte
  out = out.replace(MOTS_COUPES, (_m, radical, fin) => `${radical}${fin}`)
  for (const [m, remplacement] of GLOSSAIRE) out = out.replace(m, remplacement)
  // Espace parasite avant virgule / point SEULEMENT : en typographie française,
  // « ; : ! ? » prennent au contraire une espace avant — ne pas y toucher.
  out = out.replace(/[ \t]+([,.])(\s|$)/g, '$1$2').replace(/[ \t]{2,}/g, ' ')
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
