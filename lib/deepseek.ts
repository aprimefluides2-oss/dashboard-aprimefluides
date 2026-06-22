import Anthropic from "@anthropic-ai/sdk"

let cached: Anthropic | null = null

/**
 * Client Claude (Anthropic) — utilise le vrai endpoint Anthropic.
 * (Anciennement détourné vers DeepSeek ; rebranché sur Anthropic avec ANTHROPIC_API_KEY.)
 * Initialisation paresseuse pour ne pas bloquer le build Vercel sans clé.
 */
export function getDeepseek(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY manquante — configurez-la dans les variables d'environnement")
  }
  if (!cached) {
    cached = new Anthropic({ apiKey })
  }
  return cached
}

/** @deprecated Préférer getDeepseek() — conservé pour compatibilité des imports existants */
export const deepseek = {
  get messages() {
    return getDeepseek().messages
  },
}
