/**
 * Debug : capture la réponse brute de DeepSeek avec le PROMPT RAPPORT EXACT
 * de app/api/generate/route.ts, et identifie pourquoi JSON.parse échoue.
 *
 * Usage : npx tsx scripts/debug-generate-parse.ts
 */
import Anthropic from "@anthropic-ai/sdk"
import fs from "node:fs"
import path from "node:path"

const envFile = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8")
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "")
}

const deepseek = new Anthropic({
  baseURL: "https://api.deepseek.com/anthropic",
  apiKey: process.env.DEEPSEEK_API_KEY!,
})

const transcription =
  "Intervention de débouchage sur une colonne d'eaux usées dans un immeuble collectif. " +
  "J'ai trouvé un bouchon de graisse important au niveau du regard du rez-de-chaussée. " +
  "J'ai utilisé le furet électrique puis un hydrocurage haute pression pour nettoyer toute la colonne. " +
  "L'écoulement est maintenant parfait. Je recommande un entretien annuel. Forfait débouchage 250 euros."

const type_intervention = "Débouchage canalisation"
const ville = "Toulon"
const cp = "83000"
const today = new Date()
const seq = "121300"

// ── PROMPT RAPPORT EXACT (copié de app/api/generate/route.ts lignes 132-200) ──
const rapportPrompt = `Tu es un rédacteur expert de rapports d'intervention de plomberie/assainissement professionnels (style bureau d'études, rapport d'expertise BTP). À partir d'une dictée vocale d'un technicien, tu produis un document détaillé et exhaustif destiné à un client professionnel (syndic, bailleur, gestionnaire de copropriété).

Dictée technicien: "${transcription}"
Type d'intervention: ${type_intervention}
Ville: ${ville} (${cp})
Date: ${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}

⛔ RÈGLES DE FIDÉLITÉ ⛔
- N'invente AUCUN fait, action, mesure, prix explicite, matériel, durée qui n'est pas dans la dictée
- Tu peux REFORMULER PROFESSIONNELLEMENT, CONTEXTUALISER avec du vocabulaire métier pertinent, DÉVELOPPER les idées déjà présentes, mais sans inventer d'éléments nouveaux
- Si un champ ne peut pas être rempli → chaîne vide "" ou tableau vide []
- "devis": null par défaut, sauf si le technicien mentionne explicitement des prix/montants
- "avis_technique": null sauf si le technicien exprime une préoccupation ou un diagnostic critique

⚠ RÈGLE STATUT "ok" / CONFORME ⚠
N'utilise JAMAIS "statut": "ok" (qui affichera "CONFORME" dans le rapport) par défaut ou pour combler. Ce statut est réservé aux cas où le technicien DIT EXPLICITEMENT que quelque chose est en bon état / conforme / sans problème / fonctionne correctement.
- Dans le doute → "statut": "neutral" (affichera "N/A") ou "statut": "info" (affichera "À PRÉVOIR").
- Pour une simple étape de contrôle final sans anomalie ET confirmée par le technicien : OK pour "ok".
- Ne met JAMAIS "ok" sur un élément dont le technicien n'a pas parlé explicitement.

📝 RÈGLES DE RÉDACTION — RAPPORT ÉTOFFÉ
- Ton : professionnel, technique, précis (éviter le langage parlé)
- Paragraphes développés : chaque champ texte doit contenir 4-6 phrases complètes minimum (sauf commentaire_technicien qui reste court)
- Vocabulaire métier : utilise les termes techniques exacts (EU, EP, colonne, collecteur, siphon, tampon, furet, hydrocurage, pression en bars, inspection endoscopique, etc.)
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

function extractText(msg: any): string {
  return (msg.content as { type: string; text?: string }[])
    .filter(b => b.type === "text")
    .map(b => b.text || "")
    .join("")
}

function diagnose(raw: string) {
  console.log(`\n📏 Longueur brute : ${raw.length} caractères`)
  console.log(`📄 Premiers 100 car : ${JSON.stringify(raw.slice(0, 100))}`)
  console.log(`📄 Derniers 150 car : ${JSON.stringify(raw.slice(-150))}`)

  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "")
  try {
    JSON.parse(cleaned)
    console.log(`\n✅ JSON.parse réussit après nettoyage fences — PAS de bug ici`)
    return
  } catch (e: any) {
    console.log(`\n❌ JSON.parse échoue : ${e.message}`)
    const m = e.message.match(/position (\d+)/)
    if (m) {
      const pos = Number(m[1])
      console.log(`   Contexte autour de la position ${pos} :`)
      console.log(`   …${JSON.stringify(cleaned.slice(Math.max(0, pos - 100), pos + 100))}…`)
      const badChar = cleaned[pos]
      console.log(`   Caractère fautif : ${JSON.stringify(badChar)} (code ${badChar?.charCodeAt(0)})`)
    }
  }

  // Détecte les caractères de contrôle littéraux DANS les chaînes
  let inString = false, escaped = false, controlInString = 0
  const samples: string[] = []
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i]
    const code = c.charCodeAt(0)
    if (escaped) { escaped = false; continue }
    if (c === "\\") { escaped = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString && code < 0x20) {
      controlInString++
      if (samples.length < 8) {
        const name = code === 10 ? "\\n littéral" : code === 9 ? "\\t littéral" : code === 13 ? "\\r littéral" : `ctrl ${code}`
        samples.push(`pos ${i}: ${name} — contexte: ${JSON.stringify(cleaned.slice(i - 40, i + 5))}`)
      }
    }
  }
  console.log(`\n🔍 Caractères de contrôle non échappés DANS des chaînes : ${controlInString}`)
  samples.forEach(s => console.log(`   - ${s}`))

  // Détecte la troncature
  const stack: string[] = []
  inString = false; escaped = false
  for (const c of cleaned) {
    if (escaped) { escaped = false; continue }
    if (c === "\\") { escaped = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === "{" || c === "[") stack.push(c)
    if (c === "}" || c === "]") stack.pop()
  }
  if (inString) console.log(`\n⚠ TRONCATURE : la réponse se termine au milieu d'une chaîne`)
  if (stack.length > 0) console.log(`⚠ TRONCATURE : ${stack.length} bloc(s) non fermé(s) — réponse coupée (max_tokens ?)`)
}

async function callOnce(): Promise<string> {
  const msg = await deepseek.messages.create({
    model: "deepseek-v4-pro",
    max_tokens: 16000,
    thinking: { type: "disabled" } as any,
    messages: [{ role: "user", content: rapportPrompt }],
  })
  return extractText(msg)
}

async function loopUntilFailure() {
  const { parseAiJson } = await import("../lib/parseAiJson")
  const MAX = 20
  for (let i = 1; i <= MAX; i++) {
    process.stdout.write(`Essai ${i}/${MAX}… `)
    const raw = await callOnce()
    try {
      parseAiJson(raw)
      console.log(`OK (${raw.length} car)`)
    } catch (e: any) {
      console.log(`❌ ÉCHEC parseAiJson : ${e.message}`)
      const file = path.resolve(process.cwd(), "scripts/.debug-raw-response.txt")
      fs.writeFileSync(file, raw)
      console.log(`\n💾 Raw fautif sauvé → ${file} (${raw.length} caractères)`)
      diagnose(raw)
      return
    }
  }
  console.log(`\n✅ ${MAX} essais sans échec — parseAiJson tient.`)
}

async function main() {
  console.log("🔬 Boucle DeepSeek jusqu'à capturer un échec parseAiJson (PROMPT RAPPORT EXACT)…\n")
  await loopUntilFailure()
}

async function _legacyMain() {
  const msg = await deepseek.messages.create({
    model: "deepseek-v4-pro",
    max_tokens: 16000,
    thinking: { type: "disabled" } as any,
    messages: [{ role: "user", content: rapportPrompt }],
  })
  const raw = extractText(msg)
  fs.writeFileSync(path.resolve(process.cwd(), "scripts/.debug-raw-response.txt"), raw)
  console.log(`💾 Réponse brute → scripts/.debug-raw-response.txt`)
  console.log(`📊 stop_reason : ${(msg as any).stop_reason}`)
  console.log(`📊 usage : ${JSON.stringify((msg as any).usage)}`)
  diagnose(raw)
}

main().catch(e => { console.error("💥", e); process.exit(1) })
