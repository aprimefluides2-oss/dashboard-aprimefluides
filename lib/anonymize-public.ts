/**
 * Anonymisation des textes destinés à la PUBLICATION PUBLIQUE sur le site.
 *
 * Règle client (2026-08-06) : « quand tu publies les rapports sur le site
 * internet, ne mets JAMAIS les noms et adresses que je mets dans la dictée.
 * Mets juste la ville et le département. »
 *
 * Pourquoi un filtre en plus de la consigne dans le prompt : le prompt est
 * probabiliste, ce filtre est déterministe. La consigne évite 95 % des cas,
 * le filtre garantit que le reste ne finit pas en ligne. Les deux, pas l'un
 * ou l'autre.
 *
 * ⚠️ PÉRIMÈTRE — ne JAMAIS appliquer au rapport d'intervention, à la facture,
 * à l'attestation ni au PDF client : ces documents sont destinés au client
 * lui-même et DOIVENT porter son nom et son adresse. Ce filtre ne concerne
 * que les champs `seo_*` publiés sur aprime-fluides.fr.
 *
 * Ce qui est retiré : adresse numérotée (« 12 rue des Lilas »), civilité +
 * nom (« M. Dupont »), résidence nommée, code d'accès / digicode.
 * Ce qui est CONSERVÉ : ville, code postal, département, et tout le contenu
 * technique — y compris l'étage, qui décrit la colonne d'évacuation et
 * n'identifie personne sans l'adresse.
 *
 * ⚠️ LIMITE ASSUMÉE : un patronyme nu, sans civilité (« intervention chez
 * Dupont »), n'est pas détectable sans risque de casse — « Dupont » et un
 * nom de quartier ou de rue s'écrivent pareil. C'est le prompt qui couvre ce
 * cas ; le filtre couvre les formes marquées.
 *
 * INVARIANT : un texte déjà propre doit ressortir IDENTIQUE (idempotence).
 * Toute règle ajoutée doit être couverte par `scripts/test-anonymize-public.ts`.
 */

/** Bornes de mot conscientes des accents (cf. le piège `\b` de fix-transcription). */
const DEB = '(?<![A-Za-zÀ-ÖØ-öø-ÿ])'
const FIN = '(?![A-Za-zÀ-ÖØ-öø-ÿ])'

/** Types de voie reconnus dans une adresse postale française. */
const VOIE = [
  'rue', 'avenue', 'av\\.', 'boulevard', 'bd', 'impasse', 'all[ée]e', 'chemin',
  'place', 'square', 'route', 'quai', 'cours', 'sentier', 'villa', 'passage',
  'cit[ée]', 'clos', 'hameau', 'lotissement', 'r[ée]sidence', 'ruelle', 'venelle',
].join('|')

/**
 * Mots qui terminent le nom de voie : au-delà, on est reparti sur autre chose
 * (« 12 rue des Lilas À Argenteuil » → on ne doit pas manger « Argenteuil »,
 * qui est justement l'information à garder).
 */
const STOP = 'à|a|au|aux|dans|sur|vers|puis|où|ou|pour|avec|chez|le|la|les|et'

/** Un nom de voie = jusqu'à 5 mots, en s'arrêtant sur un mot de liaison. */
const NOM_VOIE = `(?:\\s+(?!(?:${STOP})${FIN})[A-Za-zÀ-ÖØ-öø-ÿ0-9'’-]+){0,5}`

/** « au 12 bis rue des Lilas », « sis 3 avenue Foch », « 1 Rue Jean Carasso ». */
const ADRESSE = new RegExp(
  `(?:${DEB}(?:au|aux|du|sis(?:e)?|situ[ée]e?s?\\s+(?:au|à))\\s+)?` +
  `\\d{1,4}\\s*(?:bis|ter|quater)?\\s*,?\\s*` +
  `(?:${VOIE})${NOM_VOIE}`,
  'gi',
)

/** « M. Dupont », « Mme et M. Durand », « Monsieur Jean Martin ». */
const CIVILITE = new RegExp(
  `${DEB}(?:M\\.|Mr|Mme|Mlle|Monsieur|Madame|Mademoiselle)` +
  `(?:\\s+et\\s+(?:M\\.|Mr|Mme|Mlle|Monsieur|Madame|Mademoiselle))?` +
  `(?:\\s+[A-ZÀ-Ö][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3}`,
  'g',
)

/**
 * « la résidence Les Tilleuls » → « une résidence » (le nom propre identifie
 * l'adresse aussi sûrement qu'un numéro de rue).
 * Le déterminant qui précède est avalé par le motif : sans ça, le remplacement
 * produit « La une résidence ».
 */
const RESIDENCE = new RegExp(
  // Déterminants énumérés dans les deux casses : le motif ne peut pas passer en
  // /i sans casser la détection du nom propre, qui repose justement sur la casse.
  `${DEB}(?:([Ll]a|[Uu]ne|[Cc]ette|[Ll]['’])\\s*)?(r[ée]sidence|copropri[ée]t[ée])\\s+(?:«\\s*)?(?:les?\\s+|la\\s+|l'|du\\s+|des\\s+)?` +
  `[A-ZÀ-Ö][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\\s+[A-ZÀ-Ö][A-Za-zÀ-ÖØ-öø-ÿ'’-]+)?(?:\\s*»)?`,
  'g',
)

/** « digicode 45B12 », « code d'accès : 1234 » → on garde le mot, jamais le code. */
const CODE_ACCES = new RegExp(
  `${DEB}(digicode|interphone|code\\s+d['’]?(?:acc[èe]s|entr[ée]e|immeuble))` +
  `\\s*(?:n°|:|=)?\\s*[A-Za-z0-9]{2,10}${FIN}`,
  'gi',
)

/** « bâtiment B », « escalier 3 », « appartement 12 », « porte droite ». */
const COMPLEMENT = new RegExp(
  `${DEB}(?:b[âa]timent|b[âa]t\\.|escalier|esc\\.|appartement|appt\\.?|apt\\.?|porte)` +
  `\\s+(?:n°\\s*)?[A-Za-z0-9]{1,4}${FIN}`,
  'gi',
)

/** Recolle la ponctuation et les espaces après une suppression. */
function nettoyerResidus(texte: string): string {
  return texte
    // « intervention  , à Argenteuil » → « intervention, à Argenteuil »
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    // virgules ou prépositions orphelines laissées par une suppression
    .replace(/(?<![A-Za-zÀ-ÖØ-öø-ÿ])(?:au|aux|du|sis|sise)\s+(?=[,.;:]|$)/gi, '')
    .replace(/,\s*,+/g, ',')
    // « digicode, . » (le complément qui suivait la virgule a été retiré)
    .replace(/,\s*([.;:!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/^[ \t,;]+/gm, '')
    .trimEnd()
}

/** Applique les règles à un segment de texte nu (jamais à du balisage). */
function anonymiserSegment(texte: string): string {
  let out = texte
  out = out.replace(CIVILITE, 'le client')
  out = out.replace(ADRESSE, '')
  out = out.replace(RESIDENCE, (_m, determinant: string | undefined, mot: string) => {
    const generique = `une ${mot.toLowerCase()}`
    // Conserve la majuscule quand le déterminant avalé ouvrait la phrase.
    const ouvraitLaPhrase = Boolean(determinant) && /^[A-ZÀ-Ö]/.test(determinant as string)
    return ouvraitLaPhrase ? generique.charAt(0).toUpperCase() + generique.slice(1) : generique
  })
  out = out.replace(CODE_ACCES, (_m, mot: string) => mot)
  out = out.replace(COMPLEMENT, '')
  return nettoyerResidus(out)
}

/**
 * Anonymise un texte public, éventuellement HTML : on ne traite que les
 * segments hors balises, pour ne jamais abîmer un href ou une classe.
 */
export function anonymizePublicText(texte: string | null | undefined): string {
  if (!texte) return ''
  const s = String(texte)
  if (!s.includes('<')) return anonymiserSegment(s)
  return s
    .split(/(<[^>]*>)/g)
    .map((part) => (part.startsWith('<') ? part : anonymiserSegment(part)))
    .join('')
}

/** Champs du FormData de publication qui finissent VISIBLES sur le site. */
const CHAMPS_PUBLICS = ['title', 'meta_title', 'description', 'content'] as const

/**
 * Champs d'identité que Django n'utilise PAS (vérifié : aucune occurrence de
 * `client_nom` / `client_adresse` / `transcription` dans le backend). Ils
 * partaient sur le réseau sans jamais servir — on cesse simplement de les
 * envoyer. Ils restent évidemment dans Supabase, qui est le CRM interne.
 */
const CHAMPS_IDENTITE = ['client_nom', 'client_email', 'client_adresse', 'transcription'] as const

/**
 * Dernière barrière avant l'envoi à Django : anonymise les champs publics et
 * retire l'identité du client du payload.
 *
 * Indispensable en plus du filtre appliqué à la génération : une intervention
 * enregistrée AVANT l'ajout de cette règle a un `seo_json` non filtré en base,
 * et peut être publiée n'importe quand.
 */
export function anonymizePublishFormData(fd: FormData): { fd: FormData; retires: string[] } {
  const sortie = new FormData()
  const retires = new Set<string>()

  fd.forEach((valeur, cle) => {
    if ((CHAMPS_IDENTITE as readonly string[]).includes(cle)) {
      if (typeof valeur === 'string' && valeur.trim()) retires.add(cle)
      return // non transmis
    }
    if (typeof valeur !== 'string') {
      sortie.append(cle, valeur) // fichiers : inchangés
      return
    }
    if ((CHAMPS_PUBLICS as readonly string[]).includes(cle)) {
      detectPersonalData(valeur).forEach((d) => retires.add(`${cle}:${d}`))
      sortie.append(cle, anonymizePublicText(valeur))
      return
    }
    if (cle === 'faq_json' || cle === 'seo_json' || cle === 'jsonld') {
      // JSON : on descend dans les valeurs texte plutôt que de filtrer la chaîne
      // sérialisée, pour ne pas risquer d'abîmer l'échappement.
      try {
        const parse = JSON.parse(valeur)
        const nettoye = anonymiserJson(parse, cle, retires)
        sortie.append(cle, JSON.stringify(nettoye))
      } catch {
        sortie.append(cle, valeur)
      }
      return
    }
    sortie.append(cle, valeur)
  })

  return { fd: sortie, retires: Array.from(retires) }
}

/** Parcourt récursivement un JSON et anonymise ses chaînes. */
function anonymiserJson(noeud: unknown, chemin: string, retires: Set<string>): unknown {
  if (typeof noeud === 'string') {
    detectPersonalData(noeud).forEach((d) => retires.add(`${chemin}:${d}`))
    return anonymizePublicText(noeud)
  }
  if (Array.isArray(noeud)) return noeud.map((n) => anonymiserJson(n, chemin, retires))
  if (noeud && typeof noeud === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(noeud as Record<string, unknown>)) {
      // Les URL et identifiants ne doivent jamais être réécrits.
      out[k] = /^(url|@id|@type|@context|image|logo|sameAs)$/i.test(k) ? v : anonymiserJson(v, chemin, retires)
    }
    return out
  }
  return noeud
}

/**
 * Signale ce qui a été retiré, pour journaliser côté serveur sans avoir à
 * comparer les textes à la main. Retourne [] quand le texte était déjà propre.
 */
export function detectPersonalData(texte: string | null | undefined): string[] {
  if (!texte) return []
  const s = String(texte).replace(/<[^>]*>/g, ' ')
  const trouves: string[] = []
  for (const [label, rx] of [
    ['adresse', ADRESSE], ['civilité+nom', CIVILITE], ['résidence nommée', RESIDENCE],
    ['code d\'accès', CODE_ACCES], ['complément d\'adresse', COMPLEMENT],
  ] as const) {
    const copie = new RegExp(rx.source, rx.flags)
    if (copie.test(s)) trouves.push(label)
  }
  return trouves
}
