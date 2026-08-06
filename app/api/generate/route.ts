import { NextRequest, NextResponse } from "next/server"
import { deepseek } from "@/lib/deepseek"
import { parseAiJson } from "@/lib/parseAiJson"
import { fixTranscription, fixGeneratedText } from "@/lib/fix-transcription"
import { anonymizePublicText, detectPersonalData } from "@/lib/anonymize-public"
import {
  SITE,
  SERVICE_LINKS,
  HUB_DEBOUCHAGE,
  absolute,
  citySlug,
  isReachable,
  pillarForType,
  resolveCityPath,
} from "@/lib/site-links"

export const maxDuration = 60

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6"

function slugify(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: any
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      lastErr = e
      const status = e?.status || e?.response?.status
      const msg = String(e?.message || '')
      const retryable =
        status === 529 || status === 503 || status === 500 || status === 429 ||
        /529|overloaded|503|500|429|rate.?limit/i.test(msg)
      if (!retryable || attempt === maxAttempts) throw e
      const delay = Math.min(1500 * Math.pow(2, attempt - 1), 10000) + Math.random() * 800
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

function extractText(msg: { content: { type: string; text?: string }[] }): string {
  return (msg.content as { type: string; text?: string }[])
    .filter(block => block.type === "text")
    .map(block => block.text || "")
    .join("")
}

/**
 * Le slug publié ne doit PAS porter d'horodatage (URL sale, non canonique à
 * l'œil). Mais `gallery/publish` fait un upsert PAR SLUG : deux interventions
 * même jour / même ville / même type écraseraient la première. On vérifie donc
 * l'existence côté site et on suffixe `-2`, `-3`… uniquement en cas de collision.
 * Réseau KO → on rend le slug de base (le risque d'écrasement reste
 * théorique : 2 fois le même service, la même ville, le même jour).
 */
async function slugDisponible(slug: string): Promise<string> {
  for (let i = 1; i <= 5; i++) {
    const candidat = i === 1 ? slug : `${slug}-${i}`
    const existe = await isReachable(`/api/gallery/${candidat}/`)
    if (!existe) return candidat
  }
  return `${slug}-${Date.now().toString().slice(-4)}`
}

export async function POST(req: NextRequest) {
  const { transcription: transcriptionBrute, type_intervention, ville, code_postal } = await req.json()
  if (!transcriptionBrute || !type_intervention || !ville) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })
  }

  // Dictée nettoyée des mots inexistants / coupés par la transcription vocale :
  // le LLM reçoit le bon mot et le réutilise partout (cf. lib/fix-transcription).
  const transcription = fixTranscription(transcriptionBrute)

  // Pré-calculs (utilisés par les 2 prompts en parallèle)
  const villeSlug = citySlug(ville)
  const cp = code_postal || '95870'
  const typeSlug = slugify(type_intervention)
  const today = new Date()
  const dateSlug = String(today.getDate()).padStart(2, '0') + String(today.getMonth() + 1).padStart(2, '0') + today.getFullYear()
  // Numérotation séquentielle basée sur l'heure : garde la `ref` interne unique
  // (table interventions) — mais elle ne pollue PLUS le slug public.
  const seq = String(today.getHours()).padStart(2, '0') + String(today.getMinutes()).padStart(2, '0') + String(today.getSeconds()).padStart(2, '0')
  const reference = `APR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${seq}`

  // Liens internes RÉELS (200 sans redirection) + page pilier du type.
  // Avant : URLs codées en dur et périmées → 1 lien ville 404 + 6 liens 308 sur
  // chaque réalisation publiée (audit 2026-07-30).
  const pilier = pillarForType(type_intervention)
  const [cityPath, realisationSlug] = await Promise.all([
    resolveCityPath(ville, cp),
    slugDisponible(`${typeSlug}-${villeSlug}-${cp}-${dateSlug}`),
  ])
  const cityUrl = absolute(cityPath)

  // === APPEL 1 — RAPPORT TECHNIQUE COMPLET (pour PDF détaillé) ===
  const rapportPrompt = `Tu es un rédacteur expert de rapports d'intervention de plomberie/assainissement professionnels (style bureau d'études, rapport d'expertise BTP). À partir d'une dictée vocale d'un technicien, tu produis un document détaillé et exhaustif destiné à un client professionnel (syndic, bailleur, gestionnaire de copropriété).

Dictée technicien: "${transcription}"
Type d'intervention: ${type_intervention}
Ville: ${ville} (${cp})
Date: ${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}

⛔ RÈGLES DE FIDÉLITÉ — ZÉRO INVENTION ⛔
- INTERDIT d'ajouter un outil, une technique, un matériel ou une action non prononcés par le technicien.
  Exemples INTERDITS si non dictés : furet (électrique ou manuel), hydrocurage, caméra, pompe, produit chimique, regard, colonne, siphon, etc.
- Si le technicien ne dit pas « furet » → n'écris JAMAIS « furet ». Idem pour hydrocurage, caméra, mécanique, pression en bars, durée, etc.
- N'invente AUCUN fait, action, mesure, prix explicite, matériel, durée qui n'est pas dans la dictée.
- Tu peux REFORMULER en langage professionnel UNIQUEMENT ce qui est déjà dit — pas compléter par déduction métier.
- ✍ ORTHOGRAPHE : la dictée est une transcription vocale automatique. Si un mot est manifestement mal transcrit (ex. « apparuits » = « appareils ») ou coupé en deux (ex. « disjonc te » = « disjoncte »), écris la forme française correcte. Corriger une coquille n'est PAS inventer un fait — mais ne change ni le sens, ni le vocabulaire technique choisi par le technicien.
- "materiel_utilise" : UNIQUEMENT les outils/matériels nommés explicitement dans la dictée, sinon [].
- "phases" : une phase par étape RÉELLEMENT décrite ; pas de phase inventée pour « faire joli ».
- "analyse_table" : une ligne par problème/constat EXPLICITE ; pas de ligne pour combler.
- Si un champ ne peut pas être rempli → "" ou [].
- "devis": null sauf si le technicien mentionne explicitement des prix/montants.
- "avis_technique": null sauf si le technicien exprime une préoccupation ou un diagnostic critique.

⚠ RÈGLE STATUT "ok" / CONFORME ⚠
N'utilise JAMAIS "statut": "ok" (qui affichera "CONFORME" dans le rapport) par défaut ou pour combler. Ce statut est réservé aux cas où le technicien DIT EXPLICITEMENT que quelque chose est en bon état / conforme / sans problème / fonctionne correctement.
- Dans le doute → "statut": "neutral" (affichera "N/A") ou "statut": "info" (affichera "À PRÉVOIR").
- Pour une simple étape de contrôle final sans anomalie ET confirmée par le technicien : OK pour "ok".
- Ne met JAMAIS "ok" sur un élément dont le technicien n'a pas parlé explicitement.

📝 RÈGLES DE RÉDACTION — RAPPORT ÉTOFFÉ
- Ton : professionnel, technique, précis (éviter le langage parlé)
- Paragraphes développés : chaque champ texte doit contenir 4-6 phrases complètes minimum (sauf commentaire_technicien qui reste court)
- Vocabulaire métier : utilise les termes techniques UNIQUEMENT s'ils figurent dans la dictée (EU, EP, colonne, etc.) — ne pas en ajouter d'autres par habitude.
- Structure : chaque section doit être autonome et compréhensible isolément
- Développe le contexte, la méthodologie, les résultats intermédiaires, sans inventer de données chiffrées

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks) :
{
  "objet": "objet complet et explicite du rapport (ex: 'Débouchage d'une colonne d'eaux usées et diagnostic réseau — Immeuble collectif')",
  "contexte": "paragraphe de 3-5 phrases qui plante le décor : qui a mandaté, quel type de site, quelle problématique initiale signalée, date et objectif de l'intervention",
  "localisation": {
    "zone": "description détaillée de la zone d'intervention (3-4 phrases) : nature du lieu, niveau, configuration, point d'accès utilisé",
    "configuration": "description technique du réseau / installation (3-4 phrases) : âge apparent, matériaux, état général, particularités d'accès, absence ou présence de points de visite"
  },
  "diagnostic": "diagnostic complet en 5-7 phrases : constat initial, observations techniques, nature exacte du dysfonctionnement, cause probable, éléments aggravants si pertinents",
  "travaux_realises": "description détaillée des opérations effectuées en 5-7 phrases : ordre chronologique, techniques utilisées, outillage mis en œuvre, vérifications et contrôles intermédiaires, résultats obtenus à chaque étape",
  "materiel_utilise": ["liste du matériel effectivement utilisé ou cité", "sinon tableau vide"],
  "duree_intervention": "durée si mentionnée, sinon \\"\\"",
  "conditions_intervention": "conditions particulières rencontrées (accès, contraintes, présence client, difficultés) — 2-3 phrases si pertinent, sinon \\"\\"",
  "recommandations": "préconisations préventives détaillées en 3-5 phrases — si le technicien n'en a pas donné, laisse vide",
  "commentaire_technicien": "note interne courte — 1 phrase",
  "phases": [
    {
      "titre": "Phase N : Titre explicite",
      "statut": "ok|warn|critical",
      "contexte": "2-3 phrases : contexte de la phase, raison d'être de l'étape",
      "action": "2-3 phrases : actions précises entreprises",
      "resultat": "2-3 phrases : résultat obtenu et validation"
    }
  ],
  "avis_technique": null,
  "analyse_table": [
    { "probleme": "intitulé court", "localisation": "précision géographique", "description": "description en 1-2 phrases", "statut": "critical|warn|info|ok|neutral", "label": "✗ Urgent | ⚠ Attention | ⓘ À prévoir | ✓ Conforme | - N/A" }
  ],
  "preconisations": [],
  "devis": null
}

Si et seulement si le technicien mentionne explicitement des prix/montants/devis, remplace "devis": null par :
{
  "numero": "DV-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${seq}",
  "validite_jours": 30,
  "lignes": [
    { "section": "A · Titre section", "designation": "Libellé court", "description": "", "qte": 1, "pu_ht": 850 }
  ],
  "tva_taux": 10,
  "conditions": ["Validité 30 jours.", "Acompte 30 % à la signature."]
}`

  // === APPEL 2 — SEO unique (contenu différent à chaque génération) ===
  const seoPrompt = `Tu es un rédacteur web expérimenté en plomberie/assainissement local. Tu écris une page de réalisation client UNIQUE qui sera publiée sur ${SITE}.

🎙 TON ET VOIX — PRIORITÉ ABSOLUE 🎙
Cette page doit SONNER COMME UN ARTISAN QUI RACONTE SON CHANTIER, pas comme une brochure commerciale ni comme une fiche SEO générique. Objectif : que le lecteur se dise "ok, ces gens font vraiment le métier, je peux leur faire confiance".

Règles de ton :
- Utilise "on" (et "nous" parfois). Jamais "notre entreprise s'est déplacée", plutôt "on est arrivés sur place".
- Phrases courtes, rythmées, orales mais pas relâchées. Pas d'argot, pas de "tu".
- Raconte CE chantier précis comme une histoire : le contexte, ce qu'on a trouvé, ce qu'on a fait, ce qu'on a conseillé.
- Vocabulaire technique présent mais expliqué ("on a passé la caméra — l'inspection vidéo — pour voir à l'intérieur de la canalisation").
- Pas de superlatifs commerciaux vides ("intervention ultra-rapide", "professionnels reconnus", "qualité premium"). Bannis-les.
- Pas d'urgence agressive type "APPELEZ MAINTENANT 24H/24 !!". La crédibilité fait le travail.
- Si la dictée nomme un repère local (rue, quartier), reprends-le — ça ancre la page.
- Reste factuel : si la dictée ne dit pas combien de temps ça a pris, ne l'invente pas.
- ZÉRO COQUILLE : la dictée vient d'une transcription vocale. Un mot manifestement mal transcrit (« apparuits » → « appareils ») ou coupé en deux (« disjonc te » → « disjoncte ») doit être écrit correctement. Une faute visible sur la page détruit la confiance du lecteur ET la valeur de la page comme source citable.

Exemples d'ouvertures correctes :
- "Appel en fin de matinée : un client de ${ville} a son évier qui ne s'évacue plus depuis la veille."
- "Sur cette intervention à ${ville}, le problème venait plus loin qu'on ne le pensait au premier coup d'œil."
- "Quand on arrive sur un regard bouché, on commence toujours par la même chose : repérer où est l'arrivée et où est la sortie."

⚠️ UNICITÉ SEO
La page doit être unique même si ville+service reviennent. Pour ça : ANCRE sur les détails concrets de la dictée (type de bâtiment, nature exacte du problème, méthode, résultat). ÉVITE les intros génériques interchangeables. VARIE la structure d'une page à l'autre (commence parfois par le contexte, parfois par le problème, parfois par la méthode).

CONTEXTE — DICTÉE DU TECHNICIEN (source de vérité, reformule pro mais sans inventer d'actions) :
"""
${transcription}
"""

Intervention : ${type_intervention} à ${ville} (${cp})
Référence unique : ${reference}

⛔ URLS AUTORISÉES — LISTE FERMÉE ⛔
N'écris JAMAIS une URL absente de cette liste (pas de /debouchage/…, pas de
/${villeSlug}-${cp}, pas de /urgence-debouchage, pas de /tarifs). Toute autre URL
est un 404 sur le site. Copie-les caractère pour caractère.

PAGE PILIER DU SERVICE (à lier au moins 1 fois, c'est le lien le plus pertinent) :
- ${pilier.label} → ${absolute(pilier.path)}

AUTRES PAGES SERVICE (pour maillage interne) :
${SERVICE_LINKS.filter(s => s.path !== pilier.path).map(s => `- ${s.label} → ${absolute(s.path)}`).join('\n')}

PAGE LOCALE DE DESTINATION (OBLIGATOIRE) :
- Page "${ville}" → ${cityUrl}
- Page débouchage (hub) → ${absolute(HUB_DEBOUCHAGE.path)}

URL FINALE : ${SITE}/etudes-de-cas/${realisationSlug}

⛔ NE PAS INVENTER D'ACTIONS TECHNIQUES absentes de la dictée.
- Interdit d'écrire qu'on a utilisé furet, hydrocurage, caméra, etc. si la dictée ne le dit pas.
- Tu peux contextualiser avec du savoir métier général, mais sans affirmer que le technicien a fait X si ce n'est pas dans la dictée.

RÈGLES SEO + GEO (rigoureuses, mais invisibles au lecteur)

🎯 PRIORITÉ ABSOLUE — CITABILITÉ LLM
Les 3 champs "titre_h1", "meta_description" et "resume_rich_snippet" doivent pouvoir être COPIÉS-COLLÉS TELS QUELS comme réponse par un moteur IA (Perplexity, ChatGPT search, Google AI Overviews) à une question d'internaute. Imagine qu'un LLM cite ton texte ENTRE GUILLEMETS : ça doit tenir debout seul, sans contexte, sans promo, comme une phrase factuelle d'article de presse local.

- Titre H1 (champ "titre_h1") : 55-75 caractères. PHRASE DÉCLARATIVE COMPLÈTE, lisible isolément.
  Construction obligatoire : action concrète + élément distinctif tiré de la dictée + ${ville}.
  ✅ "Débouchage d'une colonne d'eaux usées à ${ville} après accumulation de lingettes"
  ✅ "Hydrocurage d'un regard extérieur à ${ville} : racines retirées, évacuation rétablie"
  ✅ "Inspection caméra du réseau EP d'une copropriété à ${ville} — fissure repérée à 18 m"
  ❌ "DÉBOUCHAGE URGENT 24H/24 À ${ville} !!"            (promo, majuscules, points d'exclamation)
  ❌ "Comment déboucher une canalisation à ${ville} ?"   (question, pas citable comme fait)
  ❌ "Plombier expert ${ville} — intervention rapide"    (slogan vide, pas de fait précis)
  ❌ "Débouchage canalisation"                            (générique, ni ville ni angle)
  Interdits stricts : majuscules en bloc, "!", "?", "24/7", "urgent", "expert", "n°1", chiffres marketing.

- Meta description (champ "meta_description") : 150 à 160 caractères MAXIMUM (jamais plus de 160), format RÉPONSE-D'ABORD.
  Les LLMs citent surtout les 12-15 PREMIERS MOTS — donc l'info clé doit y être.
  Structure en 2 phrases :
    Phrase 1 (60-85 car.) — LE QUOI + OÙ : action principale au passé, lieu précis, élément distinctif.
    Phrase 2 (60-80 car.) — LE COMMENT + RÉSULTAT : méthode utilisée + résultat mesurable ou observable.
  Densité d'entités obligatoire : ≥ 3 entités nommées (lieu, problème, technique, ou mesure).
  Inclure si possible 1 chiffre concret (durée, pression, distance, niveau).
  ✅ "Débouchage d'une colonne EU à ${ville} après bouchon de lingettes au 3ᵉ étage. Hydrocurage 200 bars, contrôle caméra, évacuation rétablie en 1 h 30."
  ✅ "Inspection caméra du réseau d'eaux pluviales d'une copropriété à ${ville}. Fissure repérée à 18 m du regard, plan de réparation transmis au syndic."
  ❌ "Plombier ${ville} 24/7, devis gratuit, intervention rapide. Appelez-nous !"
  Interdits : "!", phrases d'appel à l'action, urgence forcée, majuscules en bloc, "contactez-nous".

- Résumé "resume_rich_snippet" : 2 à 3 phrases, 200-320 caractères. C'EST LE PASSAGE QUI SERA CITÉ comme extrait riche par les moteurs IA.
  Doit répondre seul, sans le reste de la page, à : QUI a fait QUOI, OÙ, COMMENT, avec quel RÉSULTAT.
  Inclure si la dictée le permet : 1 mesure (durée, pression, longueur, niveau d'étage), 1 lieu précis, 1 nom de méthode technique exact.
  Ton de bulletin local, pas de promo, pas de "nous", style "rapport bref" à la 3ᵉ personne ou "on" sobre.
  ✅ "Intervention sur une colonne d'eaux usées d'un immeuble collectif à ${ville}. Hydrocurage haute pression à 200 bars puis inspection vidéo du réseau ; le bouchon de lingettes situé au niveau du 3ᵉ étage a été retiré et l'évacuation rétablie en moins de deux heures."
- Meta title (champ "meta_title") : 45 à 58 caractères MAXIMUM. C'est le titre affiché dans Google, DIFFÉRENT du H1 (plus court, orienté requête).
  N'AJOUTE JAMAIS " | Aprime Fluides" ni le nom de la marque : le site l'ajoute lui-même.
  Construction : intention de recherche (le service tel qu'on le tape) + ${ville} + (${cp}) si ça tient dans 58 caractères.
  ✅ "Remplacement sanibroyeur ${ville} (${cp}) — cas réel"
  ✅ "Débouchage colonne EU ${ville} — intervention réelle"
  ❌ "${type_intervention} ${ville} ${cp}"                (juste des mots-clés empilés, aucune intention)
  ❌ "…| Aprime Fluides"                                  (suffixe ajouté par le site = doublon)
  Interdits : "!", "24/7", "urgent", "pas cher", "n°1", majuscules en bloc.
- Contenu HTML : 700-1100 mots, h2/h3 (4-6 h2 minimum), paragraphes courts (2-4 phrases), strong sur mots-clés locaux utilisés NATURELLEMENT dans la phrase, listes <ul> quand c'est pertinent (étapes, symptômes, causes).
- ⚠ 2 H2 EN FORME DE QUESTION OBLIGATOIRES, portant sur LE problème réel de cette intervention (pas de question générique). Juste sous chaque question : la réponse en 2-3 phrases, 1ʳᵉ phrase = la réponse directe, citable hors contexte.
  ✅ "<h2>Pourquoi un sanibroyeur fait-il disjoncter l'électricité ?</h2><p>Un sanibroyeur qui disjoncte signale presque toujours…</p>"
  ✅ "<h2>Faut-il réparer ou remplacer un sanibroyeur qui disjoncte ?</h2><p>…</p>"
- ⚠ ÉTAPES : une section "Étapes de l'intervention" avec un <ol> des étapes RÉELLEMENT décrites dans la dictée (3 à 6 <li>, une action par <li>). Ce <ol> doit correspondre exactement au champ "howto_steps".
- TABLEAU COMPARATIF : si — et seulement si — cette intervention comportait un vrai arbitrage (réparer vs remplacer, curage vs chemisage, réparation ponctuelle vs rénovation), ajoute UN <table> à 3-4 colonnes (Critère / Option A / Option B / Ce qu'on a retenu) avec <thead><tr><th>… Pas d'arbitrage réel dans la dictée → PAS de tableau (aucun tableau inventé pour "faire riche").
- DURÉE : si la dictée donne une durée, écris-la en clair (chiffre + unité) dans le résumé ET dans le corps. Si elle ne la donne pas, n'en écris aucune, même approximative.
- PRIX : n'écris un montant QUE si le technicien a dicté un montant, et alors écris-le en clair (ex. "240 € TTC"). N'écris JAMAIS de placeholder du type {PRIX_MIN} : il serait publié tel quel sur le site. Aucun montant dicté → renvoie vers la page tarifs par un lien, sans chiffre.
- ATTRIBUTION : parle de "notre technicien" / "nos techniciens". Ne donne JAMAIS de prénom ni de nom d'intervenant (règle interne : les intervenants terrain restent anonymes).
- 🔒 CLIENT ANONYME (règle absolue — cette page est PUBLIQUE) : ne reprends JAMAIS le nom, le prénom ni l'adresse du client, même dictés. Interdits : "M./Mme X", un patronyme, un numéro + nom de rue, une résidence nommée, un bâtiment/escalier/appartement, un digicode. Écris "le client", "la copropriété", "le syndic". La SEULE localisation autorisée est la VILLE (${ville}) et son département ; le code postal est autorisé, l'adresse précise jamais. Exemple : dictée "chez M. Dupont au 12 rue des Lilas à ${ville}" → écris "chez un client à ${ville}".
- Intertitres orientés récit ou bénéfice lecteur, pas sloganesques. Ex : "Ce qu'on a trouvé sur place", "Pourquoi la canalisation s'était rebouchée", "Comment éviter que ça recommence".
- Conteneurs HTML à utiliser : <section class=\\"content-block\\">, <div class=\\"info-box\\"> (pour un point-clé ou conseil), <div class=\\"checklist-box\\"> (pour une liste d'étapes).
- MAILLAGE INTERNE : ≥ 3 liens vers les SERVICES + ≥ 2 liens vers la page ville (${cityUrl}) + 1 lien vers le hub débouchage. Les liens doivent apparaître naturellement dans une phrase, pas collés en fin de paragraphe comme une liste SEO.
- Prix : placeholders {PRIX_MIN}/{PRIX_MAX} uniquement si un tarif est mentionné par le technicien.
- FAQ : 6 questions que de VRAIS clients se posent à ${ville} (longue traîne). Chaque réponse est AUTO-PORTANTE et ANSWER-FIRST : la 1ʳᵉ phrase donne directement le fait/la solution (une IA doit pouvoir la citer telle quelle, hors contexte, sans lire le reste de la page), puis 1 phrase de précision si utile. 40 à 320 caractères, ton factuel, honnête, sans langue de bois. Pas de "contactez-nous vite !" ni de renvoi promo en fin de réponse.
- 8-12 mots-clés longue traîne, vrais termes de recherche humains.
- GEO / citabilité IA : phrases courtes, vérifiables, ancrage local précis, style factuel.

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks).
IMPORTANT : respecte EXACTEMENT cet ordre de clés. "contenu_principal" est
volumineux et vient en DERNIER — les champs courts (faq, related_services)
sont placés avant pour ne jamais être perdus si la réponse est longue.
{
  "titre_h1": "titre unique et spécifique — ne pas copier d'autres pages",
  "meta_title": "title SERP 45-58 car., sans le nom de la marque",
  "meta_description": "description unique avec angle distinctif",
  "resume_rich_snippet": "résumé court 2-3 phrases, factuel, citable, sans promo excessive",
  "meta_keywords": ["ville+service","longue traîne 1","longue traîne 2","..."],
  "faq": [
    {"question":"...","reponse":"..."},
    {"question":"...","reponse":"..."},
    {"question":"...","reponse":"..."},
    {"question":"...","reponse":"..."},
    {"question":"...","reponse":"..."},
    {"question":"...","reponse":"..."}
  ],
  "related_services": [
    {"label":"${pilier.label}","url":"${absolute(pilier.path)}"},
    {"label":"un autre label de la liste fermée","url":"une autre URL de la liste fermée"},
    {"label":"un autre label de la liste fermée","url":"une autre URL de la liste fermée"}
  ],
  "howto_steps": [
    {"nom":"Titre court de l'étape 1","texte":"1-2 phrases décrivant l'action réellement effectuée"},
    {"nom":"Titre court de l'étape 2","texte":"..."},
    {"nom":"Titre court de l'étape 3","texte":"..."}
  ],
  "contenu_principal": "<section class=\\"content-block\\"><h2>Contexte de l'intervention</h2><p>...</p></section><section class=\\"content-block\\"><h2>Diagnostic technique</h2><p>...<a href=\\"${SITE}/debouchage/...\\">lien</a>...</p><div class=\\"info-box\\"><strong>Point clé :</strong> ...</div></section><section class=\\"content-block\\"><h2>Travaux réalisés</h2><h3>Étape 1 — ...</h3><p>...</p><div class=\\"checklist-box\\"><ul><li>...</li></ul></div></section><section class=\\"content-block\\"><h2>Recommandations</h2><p>...</p></section>"
}`

  // ===== Exécution parallèle =====
  let rapportMsg, seoMsg
  try {
    [rapportMsg, seoMsg] = await Promise.all([
      callWithRetry(() => deepseek.messages.create({ model: MODEL, max_tokens: 16000, thinking: { type: "disabled" }, messages: [{ role: "user", content: rapportPrompt }] })),
      callWithRetry(() => deepseek.messages.create({ model: MODEL, max_tokens: 16000, thinking: { type: "disabled" }, messages: [{ role: "user", content: seoPrompt }] })),
    ])
  } catch (e: any) {
    return NextResponse.json({ error: `AI API : ${e.message || e.toString()}`, model: MODEL }, { status: 500 })
  }

  let rapport: any
  try {
    rapport = parseAiJson(extractText(rapportMsg))
  } catch (e: any) {
    const rawFull = extractText(rapportMsg)
    // Log complet côté serveur pour diagnostic (la réponse HTTP reste tronquée)
    console.error('[generate] Parsing rapport IA échoué', {
      error: e.message,
      stop_reason: (rapportMsg as any)?.stop_reason,
      rawLength: rawFull.length,
      raw: rawFull,
    })
    return NextResponse.json({ error: `Parsing rapport IA : ${e.message}`, raw: rawFull.slice(0, 500) }, { status: 500 })
  }

  // Le SEO sert uniquement à la publication site (page /nouveau).
  // Si le parsing échoue, on dégrade gracieusement avec seo={} + warning
  // pour ne pas bloquer le wizard Mode Terrain qui n'en a pas besoin.
  let seo: any = {}
  let seoWarning: string | null = null
  try {
    seo = parseAiJson(extractText(seoMsg))
  } catch (e: any) {
    seoWarning = `Parsing SEO IA : ${e.message}. Le SEO sera vide — la publication site nécessitera un édit manuel.`
    console.error('[generate] SEO parse failed', { error: e.message, raw: extractText(seoMsg).slice(0, 500) })
  }

  // Normalisation : garantit que la sortie a toujours la forme attendue
  // côté UI/publish, même si le LLM tronque ou omet une clé.
  rapport = rapport && typeof rapport === 'object' ? rapport : {}
  rapport.diagnostic = typeof rapport.diagnostic === 'string' ? rapport.diagnostic : ''
  rapport.travaux_realises = typeof rapport.travaux_realises === 'string' ? rapport.travaux_realises : ''
  rapport.recommandations = typeof rapport.recommandations === 'string' ? rapport.recommandations : ''
  rapport.commentaire_technicien = typeof rapport.commentaire_technicien === 'string' ? rapport.commentaire_technicien : ''
  rapport.phases = Array.isArray(rapport.phases)
    ? rapport.phases.filter((p: any) => p && typeof p === 'object').map((p: any) => ({
        titre: typeof p.titre === 'string' ? p.titre : '',
        statut: p.statut || 'neutral',
        contexte: typeof p.contexte === 'string' ? p.contexte : '',
        action: typeof p.action === 'string' ? p.action : '',
        resultat: typeof p.resultat === 'string' ? p.resultat : '',
      }))
    : []
  rapport.analyse_table = Array.isArray(rapport.analyse_table)
    ? rapport.analyse_table.filter((r: any) => r && typeof r === 'object').map((r: any) => ({
        probleme: typeof r.probleme === 'string' ? r.probleme : '',
        localisation: typeof r.localisation === 'string' ? r.localisation : '',
        description: typeof r.description === 'string' ? r.description : '',
        statut: r.statut || 'neutral',
        label: typeof r.label === 'string' ? r.label : '',
      }))
    : []
  rapport.preconisations = Array.isArray(rapport.preconisations)
    ? rapport.preconisations.filter((p: any) => p && typeof p === 'object').map((p: any) => ({
        tag: typeof p.tag === 'string' ? p.tag : '',
        titre: typeof p.titre === 'string' ? p.titre : '',
        items: Array.isArray(p.items)
          ? p.items.filter((it: any) => it && typeof it === 'object').map((it: any) => ({
              k: typeof it.k === 'string' ? it.k : '',
              v: typeof it.v === 'string' ? it.v : '',
            }))
          : [],
      }))
    : []
  rapport.materiel_utilise = Array.isArray(rapport.materiel_utilise) ? rapport.materiel_utilise : []
  // Filet anti-coquille sur les textes du PDF client (mêmes causes que le SEO).
  for (const champ of ['objet', 'contexte', 'diagnostic', 'travaux_realises', 'recommandations', 'commentaire_technicien', 'conditions_intervention', 'duree_intervention'] as const) {
    if (typeof rapport[champ] === 'string') rapport[champ] = fixGeneratedText(rapport[champ])
  }
  rapport.phases = rapport.phases.map((p: { titre: string; statut: string; contexte: string; action: string; resultat: string }) => ({
    ...p,
    titre: fixGeneratedText(p.titre),
    contexte: fixGeneratedText(p.contexte),
    action: fixGeneratedText(p.action),
    resultat: fixGeneratedText(p.resultat),
  }))

  seo = seo && typeof seo === 'object' ? seo : {}
  seo.titre_h1 = typeof seo.titre_h1 === 'string' ? seo.titre_h1 : ''
  // Meta title : sans suffixe de marque (le site l'ajoute) et borné à 58 c.
  // Repli sur le H1 tronqué au mot si le modèle a omis le champ.
  const metaTitleBrut = typeof seo.meta_title === 'string' && seo.meta_title.trim()
    ? seo.meta_title.trim()
    : seo.titre_h1
  seo.meta_title = metaTitleBrut
    .replace(/\s*[—|\-–]\s*Aprime\s*[Ff]luides\s*$/i, '')
    .trim()
    .slice(0, 58)
    .replace(/\s+\S*$/, '')
    .trim()
  seo.meta_description = typeof seo.meta_description === 'string' ? seo.meta_description : ''
  seo.contenu_principal = typeof seo.contenu_principal === 'string' ? seo.contenu_principal : ''
  seo.meta_keywords = Array.isArray(seo.meta_keywords) ? seo.meta_keywords : []
  seo.related_services = Array.isArray(seo.related_services) ? seo.related_services : []
  seo.faq = Array.isArray(seo.faq)
    ? seo.faq.filter((f: any) => f && typeof f === 'object').map((f: any) => ({
        question: typeof f.question === 'string' ? f.question : '',
        reponse: typeof f.reponse === 'string' ? f.reponse : '',
      }))
    : []

  // HowTo : construit à partir des étapes RÉELLES renvoyées par le modèle, qui
  // sont aussi rendues en <ol> dans le contenu → parité DOM ↔ schema exigée par
  // le front (`buildCaseStudyHowToJsonLd` ignore un HowTo sans `step`).
  const howtoSteps = Array.isArray(seo.howto_steps)
    ? seo.howto_steps
        .filter((s: unknown) => s && typeof s === 'object')
        .map((s: { nom?: unknown; texte?: unknown }) => ({
          nom: typeof s.nom === 'string' ? fixGeneratedText(s.nom) : '',
          texte: typeof s.texte === 'string' ? fixGeneratedText(s.texte) : '',
        }))
        .filter((s: { nom: string; texte: string }) => s.nom && s.texte)
    : []
  seo.howto_steps = howtoSteps
  seo.howto_json = howtoSteps.length >= 2
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: seo.titre_h1 || `${type_intervention} à ${ville}`,
        step: howtoSteps.map((s: { nom: string; texte: string }, i: number) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: s.nom,
          text: s.texte,
        })),
      })
    : ''

  // Filet anti-coquille sur les textes publiés (la dictée est déjà nettoyée en
  // amont ; ceci rattrape ce que le modèle aurait recopié ou coupé lui-même).
  seo.titre_h1 = fixGeneratedText(seo.titre_h1)
  seo.meta_title = fixGeneratedText(seo.meta_title)
  seo.meta_description = fixGeneratedText(seo.meta_description)
  seo.resume_rich_snippet = fixGeneratedText(seo.resume_rich_snippet || '')
  seo.contenu_principal = fixGeneratedText(seo.contenu_principal)
  seo.faq = (seo.faq || []).map((f: { question: string; reponse: string }) => ({
    question: fixGeneratedText(f.question),
    reponse: fixGeneratedText(f.reponse),
  }))

  // 🔒 ANONYMISATION — dernière barrière avant publication publique.
  // Le prompt interdit déjà nom et adresse du client, mais un prompt reste
  // probabiliste : ce filtre, lui, est déterministe. Il ne s'applique QU'aux
  // champs `seo` (page publique) — le rapport, la facture et l'attestation
  // doivent au contraire garder l'identité du client.
  const champsPublics: Array<keyof typeof seo> = [
    'titre_h1', 'meta_title', 'meta_description', 'resume_rich_snippet', 'contenu_principal',
  ]
  const detections = new Set<string>()
  for (const champ of champsPublics) {
    if (typeof seo[champ] !== 'string') continue
    detectPersonalData(seo[champ]).forEach((d) => detections.add(`${String(champ)}:${d}`))
    seo[champ] = anonymizePublicText(seo[champ])
  }
  seo.faq = (seo.faq || []).map((f: { question: string; reponse: string }) => {
    detectPersonalData(f.question).forEach((d) => detections.add(`faq.question:${d}`))
    detectPersonalData(f.reponse).forEach((d) => detections.add(`faq.reponse:${d}`))
    return { question: anonymizePublicText(f.question), reponse: anonymizePublicText(f.reponse) }
  })
  if (detections.size > 0) {
    // Journalisé, pas bloquant : le texte est déjà nettoyé à ce stade. Sert à
    // repérer si le modèle recommence malgré la consigne du prompt.
    console.warn('[generate] données personnelles retirées avant publication', Array.from(detections))
  }

  // Slug + référence déterministes côté serveur
  seo.slug = realisationSlug
  rapport.reference = reference
  seo.resume_rich_snippet = seo.resume_rich_snippet || seo.meta_description || ''

  const pageUrl = `${SITE}/etudes-de-cas/${realisationSlug}`
  const datePublished = today.toISOString()

  seo.jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${SITE}/#business`,
        "name": "Aprime fluides",
        "image": `${SITE}/images/logo.png`,
        "telephone": "+33139471709",
        "url": SITE,
        "priceRange": "€€",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "1, rue Jean Carasso",
          "addressLocality": "Bezons",
          "postalCode": "95870",
          "addressRegion": "Île-de-France",
          "addressCountry": "FR"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 48.9244,
          "longitude": 2.2172
        },
        "areaServed": [
          { "@type": "City", "name": ville },
          { "@type": "AdministrativeArea", "name": "Île-de-France" },
          { "@type": "AdministrativeArea", "name": "Hauts-de-France" }
        ],
        "openingHoursSpecification": [{
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
          "opens": "00:00",
          "closes": "23:59"
        }],
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": process.env.APRIME_RATING_VALUE || "4.7",
          "reviewCount": process.env.APRIME_REVIEW_COUNT || "112",
          "bestRating": "5",
          "worstRating": "1"
        },
        "currenciesAccepted": "EUR",
        "paymentAccepted": "Cash, Credit Card, Bank Transfer"
      },
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        "name": `${type_intervention} ${ville}`,
        "provider": { "@id": `${SITE}/#business` },
        "areaServed": { "@type": "City", "name": ville },
        "serviceType": type_intervention,
        "description": seo.meta_description,
      },
      {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        "headline": seo.titre_h1,
        "description": seo.meta_description,
        "abstract": seo.resume_rich_snippet,
        "datePublished": datePublished,
        "dateModified": datePublished,
        "author": { "@type": "Organization", "name": "Aprime fluides" },
        "publisher": { "@id": `${SITE}/#business` },
        "mainEntityOfPage": pageUrl,
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        "mainEntity": (seo.faq || []).map((f: { question: string; reponse: string }) => ({
          "@type": "Question",
          "name": f.question,
          "acceptedAnswer": { "@type": "Answer", "text": f.reponse }
        }))
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE },
          { "@type": "ListItem", "position": 2, "name": "Nos réalisations", "item": `${SITE}/etudes-de-cas` },
          { "@type": "ListItem", "position": 3, "name": ville, "item": cityUrl },
          { "@type": "ListItem", "position": 4, "name": seo.titre_h1, "item": pageUrl }
        ]
      }
    ]
  }
  seo.page_url = pageUrl

  return NextResponse.json({ rapport, seo, ...(seoWarning ? { warning: seoWarning } : {}) })
}
