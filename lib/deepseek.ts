import Anthropic from "@anthropic-ai/sdk"

let cached: Anthropic | null = null

/**
 * Client DeepSeek via SDK Anthropic (API compatible).
 * Initialisation paresseuse pour ne pas bloquer le build Vercel sans clé.
 */
export function getDeepseek(): Anthropic {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY manquante — configurez-la dans les variables d'environnement")
  }
  if (!cached) {
    cached = new Anthropic({
      baseURL: "https://api.deepseek.com/anthropic",
      apiKey,
    })
  }
  return cached
}

/** @deprecated Préférer getDeepseek() — conservé pour compatibilité des imports existants */
export const deepseek = {
  get messages() {
    return getDeepseek().messages
  },
}
