import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5"

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
    variante,       // 'tout-a-legout' | 'fosse-septique' | 'non-conforme'
    nom, prenom, adresse, code_postal, ville,
    date,
    technicien_nom,
  } = body || {}

  if (!transcription || typeof transcription !== 'string' || transcription.trim().length < 15) {
    return NextResponse.json({ error: 'Dictée trop courte — décris l\'inspection, les constats et les conclusions.' }, { status: 400 })
  }
  if (!['tout-a-legout', 'fosse-septique', 'non-conforme'].includes(variante)) {
    return NextResponse.json({ error: 'Variante invalide (attendu: tout-a-legout | fosse-septique | non-conforme).' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })
  }

  const today = new Date()
  const dateFinal = date || today.toISOString().slice(0, 10)
  const seq = String(today.getHours()).padStart(2, '0') + String(today.getMinutes()).padStart(2, '0')
  const numero = `ATT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${seq}`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const varianteLibelle =
    variante === 'tout-a-legout' ? 'Raccordement au tout-à-l\'égout (réseau public d\'assainissement collectif)' :
    variante === 'fosse-septique' ? 'Raccordement à une fosse septique (assainissement non collectif)' :
    'Non-conformité du réseau d\'évacuation'

  const prompt = `Tu es un rédacteur technique d'attestations d'inspection pour une société d'assainissement française (Aprime fluides). À partir d'une dictée vocale du technicien, tu produis le contenu rédactionnel d'une attestation de conformité destinée à être jointe à un dossier notarial (vente immobilière).

Type d'attestation choisi manuellement : ${varianteLibelle}

Propriétaire : ${prenom || ''} ${nom || ''}
Adresse du bien : ${adresse || ''}, ${code_postal || ''} ${ville || ''}
Date de l'inspection : ${dateFinal}
Technicien intervenant : ${technicien_nom || '(non précisé)'}

Dictée technicien :
"""
${transcription}
"""

⛔ RÈGLES DE FIDÉLITÉ — ABSOLUES (c'est un document officiel pour un notaire)
- N'invente AUCUN fait, matériel, mesure, état, diamètre, profondeur, longueur.
- Reformule professionnellement, mais ne rajoute rien qui ne soit pas EXPRESSÉMENT dans la dictée.
- Si un champ ne peut pas être rempli → chaîne vide "" ou tableau vide [].
- Ne qualifie JAMAIS un élément de "conforme" s'il n'est pas affirmé par le technicien.
- Le ton est sobre, technique, factuel. Pas de formule commerciale.

📋 STRUCTURATION
Produis un JSON avec :
- "objet" : paragraphe court (2-3 phrases) qui décrit la mission confiée au technicien (ex: "Inspection du réseau d'évacuation des eaux usées en vue d'attester de son raccordement..."). Factuel, sans détails commerciaux.
- "methode" : paragraphe (3-5 phrases) sur la méthodologie de l'inspection. Mentionne explicitement les moyens utilisés si la dictée les cite (caméra endoscopique, passage coloré, relevé de pente, ouverture de regard, etc.). Si la dictée ne cite pas de moyen particulier, reste générique et sobre ("inspection visuelle directe des regards accessibles et passage caméra du réseau").
- "observations" : tableau de 4 à 8 lignes de relevés techniques strictement factuels, chaque ligne au format { "label": string, "valeur": string, "statut": "ok" | "ko" | "info" }.
  • "ok" uniquement pour ce que le technicien confirme explicitement comme bon/conforme
  • "ko" pour un constat d'anomalie explicite
  • "info" par défaut pour les relevés neutres (diamètre, matière, présence d'un regard, etc.)
- "conclusion" : paragraphe (3-5 phrases) qui synthétise ce que le technicien a constaté, sans formuler lui-même l'attestation légale (c'est le cadre du PDF qui la formule).
- "reserves" : si le technicien formule une réserve/limite (accès impossible à tel endroit, inspection partielle, etc.), la reprendre en 1-2 phrases. Sinon chaîne vide.

${variante === 'fosse-septique' ? `
🔶 VARIANTE "FOSSE SEPTIQUE" — champs supplémentaires
Ajoute aussi "fosse" = { "volume_m3": "xxx m³", "etat": "...", "acces": "...", "derniere_vidange": "..." }
Si une info n'est pas dans la dictée, mets une chaîne vide ("") ou "Non communiquée".
` : ''}

${variante === 'non-conforme' ? `
🔴 VARIANTE "NON-CONFORME" — champs supplémentaires
Ajoute :
- "anomalies" : tableau de 3 à 6 phrases qui listent PRÉCISÉMENT les non-conformités constatées (ex: "Fosse septique intermédiaire non déclarée à la vente", "Contre-pente de 2% sur 3 mètres entre le regard R1 et la sortie", etc.). Basé uniquement sur la dictée.
- "recommandations" : tableau de 3 à 5 actions correctives à envisager, SANS les chiffrer (c'est une attestation, pas un devis). Ex: "Suppression de la fosse intermédiaire après autorisation du service assainissement", "Reprise de la pente du collecteur sur le tronçon incriminé".
` : ''}

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks) :
{
  "objet": "...",
  "methode": "...",
  "observations": [
    { "label": "Ex: Diamètre du collecteur principal", "valeur": "Ex: PVC Ø100 mm", "statut": "info" }
  ],
  "conclusion": "...",
  "reserves": ""${variante === 'fosse-septique' ? `,
  "fosse": { "volume_m3": "", "etat": "", "acces": "", "derniere_vidange": "" }` : ''}${variante === 'non-conforme' ? `,
  "anomalies": ["..."],
  "recommandations": ["..."]` : ''}
}`

  let msg
  try {
    msg = await callWithRetry(() => client.messages.create({
      model: MODEL,
      max_tokens: 3500,
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

  // Normalisation
  if (!Array.isArray(data.observations)) data.observations = []
  data.observations = data.observations.map((o: any) => ({
    label: typeof o?.label === 'string' ? o.label : '',
    valeur: typeof o?.valeur === 'string' ? o.valeur : '',
    statut: ['ok', 'ko', 'info'].includes(o?.statut) ? o.statut : 'info',
  })).filter((o: any) => o.label)

  if (variante === 'non-conforme') {
    if (!Array.isArray(data.anomalies)) data.anomalies = []
    if (!Array.isArray(data.recommandations)) data.recommandations = []
  }

  return NextResponse.json({
    numero,
    date: dateFinal,
    variante,
    nom: nom || '',
    prenom: prenom || '',
    adresse: adresse || '',
    codePostal: code_postal || '',
    ville: ville || '',
    technicienNom: technicien_nom || '',
    objet: typeof data.objet === 'string' ? data.objet : '',
    methode: typeof data.methode === 'string' ? data.methode : '',
    observations: data.observations,
    conclusion: typeof data.conclusion === 'string' ? data.conclusion : '',
    reserves: typeof data.reserves === 'string' ? data.reserves : '',
    ...(variante === 'fosse-septique' ? { fosse: data.fosse || {} } : {}),
    ...(variante === 'non-conforme' ? {
      anomalies: data.anomalies,
      recommandations: data.recommandations,
    } : {}),
  })
}
