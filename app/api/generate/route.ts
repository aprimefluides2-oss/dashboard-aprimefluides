import { NextRequest, NextResponse } from "next/server"
import { deepseek } from "@/lib/deepseek"
import { parseAiJson } from "@/lib/parseAiJson"

export const maxDuration = 300

const MODEL = "deepseek-v4-pro"
const SITE = 'https://www.aprime-fluide.fr'

const SERVICES = [
  { slug: 'debouchage/debouchage-canalisations', label: 'Débouchage de canalisations' },
  { slug: 'debouchage/curage-canalisation', label: 'Curage de canalisation' },
  { slug: 'debouchage/inspection-camera', label: 'Inspection caméra' },
  { slug: 'debouchage/debouchage-wc', label: 'Débouchage WC' },
  { slug: 'debouchage/debouchage-evier-douche', label: 'Débouchage évier / douche' },
  { slug: 'debouchage/vidange-fosse-septique', label: 'Vidange fosse septique' },
  { slug: 'urgence-debouchage', label: 'Urgence débouchage 24/7' },
  { slug: 'tarifs', label: 'Nos tarifs' },
]

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

export async function POST(req: NextRequest) {
  const { transcription, type_intervention, ville, code_postal } = await req.json()
  if (!transcription || !type_intervention || !ville) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: 'DEEPSEEK_API_KEY non configurée' }, { status: 500 })
  }

  // Pré-calculs (utilisés par les 2 prompts en parallèle)
  const villeSlug = slugify(ville)
  const cp = code_postal || '83000'
  const cityUrl = `${SITE}/${villeSlug}-${cp}`
  const typeSlug = slugify(type_intervention)
  const today = new Date()
  const dateSlug = String(today.getDate()).padStart(2, '0') + String(today.getMonth() + 1).padStart(2, '0') + today.getFullYear()
  // Numérotation séquentielle basée sur l'heure (évite collisions même jour)
  // Inclut HHMMSS pour éviter les collisions sur la table interventions (ref unique).
  const seq = String(today.getHours()).padStart(2, '0') + String(today.getMinutes()).padStart(2, '0') + String(today.getSeconds()).padStart(2, '0')
  // Slug inclut l'heure → unique même si 2 interventions/jour sur même ville/type
  const realisationSlug = `${typeSlug}-${villeSlug}-${dateSlug}-${seq}`
  const reference = `LTDB-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${seq}`

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

SERVICES DU SITE (pour maillage interne) :
${SERVICES.map(s => `- ${s.label} → ${SITE}/${s.slug}`).join('\n')}

PAGE VILLE DE DESTINATION (OBLIGATOIRE) :
- Page locale "${ville}" → ${cityUrl}
- Page Var → ${SITE}/debouchage-var

URL FINALE : ${SITE}/nos-realisations/${realisationSlug}

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
- Contenu HTML : 700-1100 mots, h2/h3 (4-6 h2 minimum), paragraphes courts (2-4 phrases), strong sur mots-clés locaux utilisés NATURELLEMENT dans la phrase, listes <ul> quand c'est pertinent (étapes, symptômes, causes).
- Intertitres orientés récit ou bénéfice lecteur, pas sloganesques. Ex : "Ce qu'on a trouvé sur place", "Pourquoi la canalisation s'était rebouchée", "Comment éviter que ça recommence".
- Conteneurs HTML à utiliser : <section class=\\"content-block\\">, <div class=\\"info-box\\"> (pour un point-clé ou conseil), <div class=\\"checklist-box\\"> (pour une liste d'étapes).
- MAILLAGE INTERNE : ≥ 3 liens vers les SERVICES + ≥ 2 liens vers la page ville (${cityUrl}) + 1 lien vers la page Var. Les liens doivent apparaître naturellement dans une phrase, pas collés en fin de paragraphe comme une liste SEO.
- Prix : placeholders {PRIX_MIN}/{PRIX_MAX} uniquement si un tarif est mentionné par le technicien.
- FAQ : 6 questions que de VRAIS clients se posent à ${ville} (longue traîne). Réponses courtes, honnêtes, sans langue de bois. Pas de "contactez-nous vite !" en fin de réponse.
- 8-12 mots-clés longue traîne, vrais termes de recherche humains.
- GEO / citabilité IA : phrases courtes, vérifiables, ancrage local précis, style factuel.

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks).
IMPORTANT : respecte EXACTEMENT cet ordre de clés. "contenu_principal" est
volumineux et vient en DERNIER — les champs courts (faq, related_services)
sont placés avant pour ne jamais être perdus si la réponse est longue.
{
  "titre_h1": "titre unique et spécifique — ne pas copier d'autres pages",
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
    {"label":"...","url":"${SITE}/debouchage/..."},
    {"label":"...","url":"${SITE}/debouchage/..."},
    {"label":"...","url":"${SITE}/debouchage/..."}
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

  seo = seo && typeof seo === 'object' ? seo : {}
  seo.titre_h1 = typeof seo.titre_h1 === 'string' ? seo.titre_h1 : ''
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

  // Slug + référence déterministes côté serveur
  seo.slug = realisationSlug
  rapport.reference = reference
  seo.resume_rich_snippet = seo.resume_rich_snippet || seo.meta_description || ''

  const pageUrl = `${SITE}/nos-realisations/${realisationSlug}`
  const datePublished = today.toISOString()

  seo.jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${SITE}/#business`,
        "name": "Aprime fluides",
        "image": `${SITE}/images/logo.png`,
        "telephone": "+33783636835",
        "url": SITE,
        "priceRange": "€€",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "700 Avenue du 15ème Corps",
          "addressLocality": "Toulon",
          "postalCode": "83000",
          "addressRegion": "Var",
          "addressCountry": "FR"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 43.1284504,
          "longitude": 5.9090923
        },
        "areaServed": [
          { "@type": "City", "name": ville },
          { "@type": "AdministrativeArea", "name": "Var" },
          { "@type": "AdministrativeArea", "name": "Provence-Alpes-Côte d'Azur" }
        ],
        "openingHoursSpecification": [{
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
          "opens": "00:00",
          "closes": "23:59"
        }],
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": process.env.LTDB_RATING_VALUE || "4.9",
          "reviewCount": process.env.LTDB_REVIEW_COUNT || "127",
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
          { "@type": "ListItem", "position": 2, "name": "Nos réalisations", "item": `${SITE}/nos-realisations` },
          { "@type": "ListItem", "position": 3, "name": ville, "item": cityUrl },
          { "@type": "ListItem", "position": 4, "name": seo.titre_h1, "item": pageUrl }
        ]
      }
    ]
  }
  seo.page_url = pageUrl

  return NextResponse.json({ rapport, seo, ...(seoWarning ? { warning: seoWarning } : {}) })
}
