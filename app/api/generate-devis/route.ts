import { NextRequest, NextResponse } from "next/server"
import { deepseek } from "@/lib/deepseek"

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6"

async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
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

function parseJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  try { return JSON.parse(cleaned) } catch {}
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
  if (lastBrace > 0) {
    for (let i = lastBrace; i > 0; i--) {
      const attempt = cleaned.slice(0, i + 1)
      try { return JSON.parse(attempt) } catch {}
    }
  }
  throw new Error('JSON invalide')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    transcription,
    client_nom,
    client_adresse,
    client_ville,
    client_code_postal,
    date_devis,
    reference_dossier,
  } = body || {}

  if (!transcription || typeof transcription !== 'string' || transcription.trim().length < 15) {
    return NextResponse.json({ error: 'Dictée trop courte (décris l\'objet du devis, les travaux, les quantités, les prix, les délais).' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })
  }

  const today = new Date()
  const fallbackDate = today.toISOString().slice(0, 10)
  const datePourIA = date_devis || fallbackDate

  const seq = String(today.getHours()).padStart(2, '0') + String(today.getMinutes()).padStart(2, '0')
  const numeroFallback = `DV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${seq}`

  const prompt = `Tu es un assistant spécialisé dans la rédaction de devis estimatifs pour une entreprise de débouchage et assainissement (Aprime fluides, Île-de-France). À partir d'une dictée vocale du technicien/chef d'équipe, tu structures un devis complet.

DICTÉE :
"""
${transcription}
"""

INFOS CONNUES :
- Client : ${client_nom || '(non précisé — extrais de la dictée si possible)'}
- Adresse client : ${client_adresse || '(non précisée)'}
- Ville : ${client_ville || ''} ${client_code_postal || ''}
- Date du devis : ${datePourIA}
- Référence dossier : ${reference_dossier || '(aucune)'}

⛔ RÈGLES DE FIDÉLITÉ (ABSOLUES)
- N'invente AUCUN prix, prestation, dimension, matériau, durée, lieu ou fait technique absent de la dictée.
- Si le technicien n'a pas cité de prix pour une prestation, mets "pu_ht": 0 et laisse l'utilisateur corriger.
- N'invente AUCUNE prestation absente de la dictée.
- Tu peux REFORMULER et ÉTOFFER professionnellement ce qui est déjà dans la dictée (vocabulaire métier EU/EP, hydrocurage, etc.) — sans ajouter d'éléments nouveaux.
- Si le technicien donne un prix pour un ensemble ("300 € pour pomper la fosse"), mets qte=1, unite="forfait", pu_ht=300.
- Unités possibles : "forfait", "ml" (mètre linéaire), "m²", "m³", "u" (unité), "h" (heure), "j" (jour). Choisis celle qui correspond au contexte.

📊 CONSTATS TECHNIQUES (sections obligatoires)
- "constats_conformes" : UNIQUEMENT ce que le technicien affirme explicitement en bon état / conforme / fonctionnel / sans anomalie. Ne mets JAMAIS de constat conforme par défaut pour combler.
  Chaque entrée : { "intitule": "titre court", "localisation": "zone précise ou \"\" ", "description": "2 à 4 phrases professionnelles développant le constat positif" }
  Si rien n'est dit → [].
- "constats_critiques" : UNIQUEMENT dysfonctionnements graves, urgences, risques majeurs ou non-conformités explicitement décrits par le technicien.
  Même structure, descriptions en 2 à 4 phrases (gravité, conséquences, urgence si mentionnée).
  Si rien de critique → [].
- "non_garantie" : paragraphe OBLIGATOIRE (5 à 7 phrases minimum) intitulé conceptuellement « Non garantie suite à notre intervention ».
  Développe les limites de garantie : reprends toute exclusion ou réserve citée par le technicien ; précise que l'intervention ne garantit pas l'état latent des parties de réseau non inspectées ou non traitées ; absence de garantie sur récidive si la cause racine n'est pas éliminée ; réserves sur accessibilité et parties hors périmètre chiffré.
  Le cadre juridique général est autorisé — pas de défauts ou faits spécifiques inventés.

📋 STRUCTURATION EN SECTIONS
Regroupe les lignes en 2 à 5 sections cohérentes numérotées. Exemples :
- "1. Pompage et curage"
- "2. Création du raccordement"
- "3. Remise en état"
- "4. Prestations complémentaires"
Chaque ligne du JSON doit référencer sa section via le champ "section".

📝 CHAMPS À PRODUIRE
- "objet" : 2-3 phrases qui décrivent ce que couvre le devis (pas un résumé ligne par ligne, une vue d'ensemble du chantier).
- "lignes[]" : toutes les prestations, une par ligne, regroupées par section.
- "majoration_note" : si le technicien mentionne une majoration (heures non ouvrées, week-end), formule-la courte ("100 % après 17 h, week-ends & jours fériés"). Sinon "".
- "conditions" : remplis avec les valeurs standards LTDB SI la dictée ne contradict pas :
  • validite : "${body?.validite_jours || 30} jours à compter de la date d'établissement"
  • delai_execution : si mentionné dans la dictée, reprends-le ; sinon "À convenir avec le client après validation"
  • duree_chantier : si mentionnée (ex: "3 à 5 jours"), reprends ; sinon "Selon accès et météo"
  • garanties : "Garantie décennale sur ouvrages enterrés · Garantie de parfait achèvement 1 an"
  • assurance : "RC Pro et décennale LTDB en cours de validité"
  • particulieres : reprends toute contrainte citée (accès engin, gravats, accord commune...) ; sinon ""
- "tva_taux" : 10 si travaux d'amélioration/rénovation sur habitation de + 2 ans (par défaut), 20 si neuf ou autre. Utilise 10 par défaut sauf indication contraire.
- "tva_reduite_attestation" : true si tva_taux=10, false sinon.
- "modalites.acompte_pct" : 30 par défaut, sauf si le technicien cite un autre pourcentage.

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks) :
{
  "numero": "${numeroFallback}",
  "date_devis": "${datePourIA}",
  "validite_jours": 30,
  "majoration_note": "",
  "objet": "description 2-3 phrases de l'ensemble du chantier",
  "reference_dossier": ${reference_dossier ? JSON.stringify(reference_dossier) : '""'},
  "lignes": [
    {
      "section": "1. Titre de section",
      "designation": "Libellé court de la prestation",
      "description": "précisions si pertinentes (matériau, dimensions, inclus/exclus) — sinon chaîne vide",
      "qte": 1,
      "unite": "forfait",
      "pu_ht": 0
    }
  ],
  "tva_taux": 10,
  "tva_reduite_attestation": true,
  "conditions": {
    "validite": "",
    "delai_execution": "",
    "duree_chantier": "",
    "garanties": "",
    "assurance": "",
    "particulieres": ""
  },
  "modalites": {
    "acompte_pct": 30,
    "modes_paiement": ["Chèque", "Virement bancaire", "Carte bancaire", "Espèces (dans la limite légale)"]
  },
  "client_nom_detecte": "si un nom client est identifiable dans la dictée, mets-le ici, sinon chaîne vide",
  "client_adresse_detectee": "si une adresse client est identifiable dans la dictée, mets-la ici, sinon chaîne vide",
  "constats_conformes": [
    { "intitule": "", "localisation": "", "description": "" }
  ],
  "constats_critiques": [
    { "intitule": "", "localisation": "", "description": "" }
  ],
  "non_garantie": "paragraphe complet sur les limites de garantie après intervention"
}`

  let msg
  try {
    msg = await callWithRetry(() => deepseek.messages.create({
      model: MODEL,
      max_tokens: 6000,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: prompt }],
    }))
  } catch (e: any) {
    return NextResponse.json({ error: `Anthropic API : ${e?.message || e?.toString()}` }, { status: 500 })
  }

  let data: any
  try {
    data = parseJson(
      (msg.content as { type: string; text?: string }[])
        .filter(block => block.type === "text")
        .map(block => block.text || "")
        .join("")
    )
  } catch (e: any) {
    const rawText = (msg.content as { type: string; text?: string }[])
      .filter(block => block.type === "text")
      .map(block => block.text || "")
      .join("")
    return NextResponse.json({
      error: `Réponse IA illisible : ${e.message}`,
      raw: rawText.slice(0, 500),
    }, { status: 500 })
  }

  // Normalisation défensive
  if (!Array.isArray(data.lignes)) data.lignes = []
  data.lignes = data.lignes.map((l: any) => ({
    section: typeof l?.section === 'string' ? l.section : 'Prestations',
    designation: typeof l?.designation === 'string' ? l.designation : '',
    description: typeof l?.description === 'string' ? l.description : '',
    qte: Number.isFinite(Number(l?.qte)) ? Number(l.qte) : 1,
    unite: typeof l?.unite === 'string' ? l.unite : 'forfait',
    pu_ht: Number.isFinite(Number(l?.pu_ht)) ? Number(l.pu_ht) : 0,
  })).filter((l: any) => l.designation)

  data.numero = data.numero || numeroFallback
  data.date_devis = data.date_devis || datePourIA
  data.validite_jours = Number(data.validite_jours) || 30
  // Accepte 0 / 10 / 20 (le 0 % — auto-liquidation / franchise — ne doit pas
  // être avalé par `|| 10`). Toute autre valeur → 10 % par défaut.
  data.tva_taux = [0, 10, 20].includes(Number(data.tva_taux)) ? Number(data.tva_taux) : 10
  data.tva_reduite_attestation = data.tva_taux === 10 ? (data.tva_reduite_attestation !== false) : false
  data.conditions = data.conditions && typeof data.conditions === 'object' ? data.conditions : {}
  data.modalites = data.modalites && typeof data.modalites === 'object' ? data.modalites : { acompte_pct: 30 }
  if (!Number.isFinite(Number(data.modalites.acompte_pct))) data.modalites.acompte_pct = 30
  if (!Array.isArray(data.modalites.modes_paiement) || data.modalites.modes_paiement.length === 0) {
    data.modalites.modes_paiement = ['Chèque', 'Virement bancaire', 'Carte bancaire', 'Espèces (dans la limite légale)']
  }

  const normConstat = (row: any) => ({
    intitule: typeof row?.intitule === 'string' ? row.intitule.trim() : '',
    localisation: typeof row?.localisation === 'string' ? row.localisation.trim() : '',
    description: typeof row?.description === 'string' ? row.description.trim() : '',
  })
  data.constats_conformes = Array.isArray(data.constats_conformes)
    ? data.constats_conformes.map(normConstat).filter((r: { intitule: string; description: string }) => r.intitule || r.description)
    : []
  data.constats_critiques = Array.isArray(data.constats_critiques)
    ? data.constats_critiques.map(normConstat).filter((r: { intitule: string; description: string }) => r.intitule || r.description)
    : []
  data.non_garantie = typeof data.non_garantie === 'string' ? data.non_garantie.trim() : ''

  return NextResponse.json({ devis: data })
}
