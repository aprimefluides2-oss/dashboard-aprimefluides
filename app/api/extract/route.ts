import { NextRequest, NextResponse } from "next/server"
import { deepseek } from "@/lib/deepseek"
import { VILLES_VAR, findVilleByName, searchVilles } from "@/lib/villes-var"

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6"

const TYPES = [
  'Débouchage canalisation',
  'Débouchage WC',
  'Débouchage évier',
  'Débouchage douche',
  'Hydrocurage',
  'Inspection caméra',
  'Vidange fosse septique',
  'Curage canalisation',
]

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
  const lastBrace = cleaned.lastIndexOf('}')
  if (lastBrace > 0) {
    try { return JSON.parse(cleaned.slice(0, lastBrace + 1)) } catch {}
  }
  throw new Error('JSON invalide')
}

export async function POST(req: NextRequest) {
  const { transcription } = await req.json()
  if (!transcription || typeof transcription !== 'string' || transcription.trim().length < 10) {
    return NextResponse.json({ error: 'Dictée trop courte' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })
  }

  const prompt = `Tu es un assistant qui extrait des informations structurées depuis la dictée vocale d'un technicien plombier en Île-de-France.

Dictée : """
${transcription}
"""

Types d'intervention possibles (choisis LE PLUS proche) :
${TYPES.map(t => `- ${t}`).join('\n')}

Communes possibles (Île-de-France et départements limitrophes) : ${VILLES_VAR.map(v => v.nom).slice(0, 40).join(', ')}, … (liste complète non affichée — utilise celle qui colle le mieux phonétiquement à ce que tu entends).

Extrait les champs suivants. Si une info est absente, renvoie "" (chaîne vide). N'INVENTE RIEN.

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks) :
{
  "type_intervention": "un des types de la liste ci-dessus",
  "ville": "nom exact de la commune (Île-de-France ou département limitrophe, orthographe officielle)",
  "adresse": "rue/numéro si mentionné, sinon \\"\\"",
  "client_nom": "nom du client si mentionné (Mme X, M. Y, nom société), sinon \\"\\"",
  "client_email": "email si dicté (ex: 'arobase' → @, 'point' → .), sinon \\"\\""
}`

  // Fallback gracieux : si l'API est KO, on renvoie des champs vides pour ne pas bloquer le flow.
  let msg
  try {
    msg = await callWithRetry(() => deepseek.messages.create({
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: prompt }],
    }))
  } catch (e: any) {
    return NextResponse.json({
      type_intervention: 'Débouchage canalisation',
      ville: '',
      code_postal: '',
      adresse: '',
      client_nom: '',
      client_email: '',
      warning: `Extraction IA indisponible (${e?.status || ''} ${String(e?.message || '').slice(0, 120)}) — remplis les champs à la main.`,
    })
  }

  let data: any
  try {
    data = parseJson(
      (msg.content as { type: string; text: string }[])
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("")
    )
  } catch (e: any) {
    return NextResponse.json({
      type_intervention: 'Débouchage canalisation',
      ville: '', code_postal: '', adresse: '', client_nom: '', client_email: '',
      warning: `Réponse IA illisible — remplis à la main.`,
    })
  }

  // Normalisation ville + récupération CP
  let ville = ''
  let codePostal = ''
  if (data.ville) {
    const exact = findVilleByName(data.ville)
    if (exact) { ville = exact.nom; codePostal = exact.cp }
    else {
      const match = searchVilles(data.ville, 1)[0]
      if (match) { ville = match.nom; codePostal = match.cp }
    }
  }

  // Validation type
  const type = TYPES.includes(data.type_intervention) ? data.type_intervention : TYPES[0]

  return NextResponse.json({
    type_intervention: type,
    ville,
    code_postal: codePostal,
    adresse: typeof data.adresse === 'string' ? data.adresse : '',
    client_nom: typeof data.client_nom === 'string' ? data.client_nom : '',
    client_email: typeof data.client_email === 'string' ? data.client_email : '',
  })
}
