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
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const {
    transcription,
    client_nom,
    client_adresse,
    client_ville,
    client_code_postal,
    date_facture,
    reference_dossier,
    agence,
  } = body || {}

  if (!transcription || typeof transcription !== 'string' || transcription.trim().length < 15) {
    return NextResponse.json({
      error: "Dictée trop courte (décris l'intervention réalisée, les prestations, les prix et le mode de règlement).",
    }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })
  }

  const today = new Date()
  const fallbackDate = today.toISOString().slice(0, 10)
  const datePourIA = date_facture || fallbackDate

  const seq =
    String(today.getHours()).padStart(2, '0') +
    String(today.getMinutes()).padStart(2, '0')
  const numeroFallback = `FA-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${seq}`

  const dateFR = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`

  const prompt = `Tu es un assistant spécialisé dans la rédaction de factures pour Aprime fluides (Île-de-France). Le technicien décrit dans une dictée vocale une intervention déjà réalisée. Tu dois en extraire les éléments structurés d'une facture.

DICTÉE :
"""
${transcription}
"""

INFOS CONNUES :
- Client : ${client_nom || '(non précisé — extrais de la dictée si possible)'}
- Adresse client : ${client_adresse || '(non précisée)'}
- Ville : ${client_ville || ''} ${client_code_postal || ''}
- Date de facture : ${datePourIA} (en clair : ${dateFR})
- Agence rattachée : ${agence || '(non précisée)'}
- Référence dossier : ${reference_dossier || '(aucune)'}

⛔ RÈGLES DE FIDÉLITÉ
- N'invente AUCUN prix, AUCUNE prestation, AUCUNE durée qui ne soit pas dans la dictée.
- Si un prix n'est pas cité, mets "pu_ht": 0 et laisse l'utilisateur corriger.
- Si une prestation est manifestement incluse / offerte (ex: "déplacement inclus", "frais de déplacement compris"), mets "inclus": true et "pu_ht": 0.
- Si le technicien dit "réglée par carte aujourd'hui", "payée en espèces", "payé par chèque" → "echeance": "Réglée" et remplis "mode_reglement".
- Si le technicien parle d'un délai ("payable à 30 jours", "à réception") → mets cette échéance, pas "Réglée".
- Sinon "echeance": "À réception".

📋 STRUCTURE — la facture est un récapitulatif d'intervention déjà effectuée (PAS un devis).
- Pas de section / regroupement : juste une liste plate de lignes.
- 1 à 5 lignes maximum (déplacement éventuel + 1 à 4 prestations).
- Unités possibles : "forfait", "ml", "m²", "m³", "u", "h". Choisis selon le contexte.

📝 CHAMPS À PRODUIRE
- "objet" : 1 phrase courte qui résume l'intervention (style : "Intervention débouchage — Débouchage haute pression sur collecteur eaux usées (EU) avec déplacement.").
- "lignes[]" : une ligne par prestation. Première ligne = "Déplacement" si mentionné (souvent inclus).
- "tva_taux" : 10 par défaut (travaux d'amélioration sur habitation > 2 ans). 20 si neuf ou commercial explicitement mentionné.
- "mode_reglement" : phrase courte décrivant le règlement effectué (ex: "Intervention réglée par carte bancaire le ${dateFR}. Aucun solde restant dû."). Reformule à partir de la dictée. Si "À réception" → "" (champ vide).
- "observations" : 2-3 phrases factuelles sur le constat technique fait par le technicien (état de la canalisation, nature du bouchon, configuration du réseau, etc.). Ton neutre et professionnel, vocabulaire métier exact (graisses alimentaires, lingettes, racines, dépôts calcaires, EU/EP, etc.). N'INVENTE PAS — reste fidèle à ce que dit la dictée.
- "recommandation" : 1-2 phrases de conseil préventif au client (ex: "Ne plus jeter d'huile de cuisson..."). Si la dictée n'en suggère pas explicitement, laisse "".

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks) :
{
  "numero": "${numeroFallback}",
  "date_facture": "${datePourIA}",
  "echeance": "Réglée | À réception | 30 jours fin de mois | JJ/MM/AAAA",
  "objet": "phrase courte décrivant l'intervention",
  "reference_dossier": ${reference_dossier ? JSON.stringify(reference_dossier) : '""'},
  "lignes": [
    {
      "designation": "Libellé court (ex: 'Débouchage haute pression — Collecteur EU')",
      "description": "précisions techniques 1-2 phrases (ou chaîne vide)",
      "qte": 1,
      "unite": "forfait",
      "pu_ht": 0,
      "inclus": false
    }
  ],
  "tva_taux": 10,
  "mode_reglement": "phrase de règlement ou chaîne vide si non payé",
  "observations": "constat technique 2-3 phrases",
  "recommandation": "conseil préventif 1-2 phrases ou chaîne vide",
  "client_nom_detecte": "si un nom client est identifiable dans la dictée, mets-le ici, sinon chaîne vide",
  "client_adresse_detectee": "si une adresse client est identifiable dans la dictée, mets-la ici, sinon chaîne vide"
}`

  let msg
  try {
    msg = await callWithRetry(() => deepseek.messages.create({
      model: MODEL,
      max_tokens: 4500,
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
    designation: typeof l?.designation === 'string' ? l.designation : '',
    description: typeof l?.description === 'string' ? l.description : '',
    qte: Number.isFinite(Number(l?.qte)) ? Number(l.qte) : 1,
    unite: typeof l?.unite === 'string' ? l.unite : 'forfait',
    pu_ht: Number.isFinite(Number(l?.pu_ht)) ? Number(l.pu_ht) : 0,
    inclus: l?.inclus === true,
  })).filter((l: any) => l.designation)

  data.numero = data.numero || numeroFallback
  data.date_facture = data.date_facture || datePourIA
  data.echeance = typeof data.echeance === 'string' && data.echeance.trim() ? data.echeance.trim() : 'À réception'
  // Accepte 0 / 10 / 20 (le 0 % — auto-liquidation / franchise — est légitime).
  data.tva_taux = [0, 10, 20].includes(Number(data.tva_taux)) ? Number(data.tva_taux) : 10
  data.mode_reglement = typeof data.mode_reglement === 'string' ? data.mode_reglement : ''
  data.observations = typeof data.observations === 'string' ? data.observations : ''
  data.recommandation = typeof data.recommandation === 'string' ? data.recommandation : ''
  data.objet = typeof data.objet === 'string' ? data.objet : ''

  return NextResponse.json({ facture: data })
}
