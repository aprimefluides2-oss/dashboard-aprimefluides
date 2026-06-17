/**
 * Test unitaire de lib/parseAiJson — couvre les modes d'échec JSON des LLM.
 * Usage : npx tsx scripts/test-parse-ai-json.ts
 */
import { parseAiJson } from "../lib/parseAiJson"

let pass = 0, fail = 0
function check(label: string, fn: () => void) {
  try { fn(); pass++; console.log(`  ✅ ${label}`) }
  catch (e: any) { fail++; console.log(`  ❌ ${label} — ${e.message}`) }
}
function eq(a: any, b: any, msg = "") {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} attendu ${JSON.stringify(b)}, reçu ${JSON.stringify(a)}`)
}

console.log("\n🧪 Test parseAiJson — modes d'échec LLM\n")

check("JSON propre", () => {
  eq(parseAiJson('{"a":1,"b":"x"}'), { a: 1, b: "x" })
})

check("Fences markdown ```json", () => {
  eq(parseAiJson('```json\n{"a":1}\n```'), { a: 1 })
})

check("Texte parasite avant/après", () => {
  eq(parseAiJson('Voici le JSON demandé :\n{"a":1}\nVoilà, j\'espère que ça aide.'), { a: 1 })
})

check("Caractère de contrôle littéral (\\n réel) dans une chaîne", () => {
  // Le LLM met un vrai retour à la ligne dans la valeur — JSON.parse natif rejette
  const broken = '{"diagnostic":"Ligne 1\nLigne 2\nLigne 3"}'
  const r = parseAiJson(broken)
  eq(r.diagnostic, "Ligne 1\nLigne 2\nLigne 3", "diagnostic")
})

check("Tab littéral dans une chaîne", () => {
  const broken = '{"x":"a\tb"}'
  eq(parseAiJson(broken).x, "a\tb")
})

check("Virgule traînante dans objet", () => {
  eq(parseAiJson('{"a":1,"b":2,}'), { a: 1, b: 2 })
})

check("Virgule traînante dans tableau", () => {
  eq(parseAiJson('{"arr":[1,2,3,]}'), { arr: [1, 2, 3] })
})

check("Guillemets typographiques", () => {
  eq(parseAiJson('{“a”:“valeur”}'), { a: "valeur" })
})

check("Réponse tronquée (objet non fermé)", () => {
  const r = parseAiJson('{"objet":"Débouchage","diagnostic":"Constat en cours')
  // Doit récupérer au moins le champ complet
  if (typeof r !== "object") throw new Error("pas un objet")
})

check("Tronqué au milieu d'un tableau", () => {
  const r = parseAiJson('{"phases":[{"titre":"P1","action":"a"},{"titre":"P2"')
  if (!Array.isArray(r.phases) || r.phases.length < 1) throw new Error("phases non récupéré")
})

check("Combo : fences + ctrl chars + trailing comma", () => {
  const broken = '```json\n{"a":"x\ny",\n"b":2,}\n```'
  const r = parseAiJson(broken)
  eq(r.b, 2, "b")
  eq(r.a, "x\ny", "a")
})

check("Cas réel : rapport multi-lignes avec \\n littéraux partout", () => {
  const broken = `{
  "objet": "Débouchage colonne EU",
  "diagnostic": "Premier constat.
Deuxième observation.
Cause probable identifiée.",
  "travaux_realises": "Étape 1.
Étape 2.",
  "devis": null
}`
  const r = parseAiJson(broken)
  eq(r.objet, "Débouchage colonne EU", "objet")
  if (!r.diagnostic.includes("Deuxième observation")) throw new Error("diagnostic perdu")
  eq(r.devis, null, "devis")
})

check("Closing bracket orphelin au milieu (cas réel DeepSeek)", () => {
  // Le LLM insère un ] parasite après une valeur string, sans [ correspondant
  const broken = `{
  "objet": "Débouchage colonne EU",
  "diagnostic": "Bouchon de graisse identifié au regard RDC."
  ],
  "travaux_realises": "Furet électrique puis hydrocurage.",
  "devis": null
}`
  const r = parseAiJson(broken)
  eq(r.objet, "Débouchage colonne EU", "objet")
  eq(r.diagnostic, "Bouchon de graisse identifié au regard RDC.", "diagnostic")
  eq(r.travaux_realises, "Furet électrique puis hydrocurage.", "travaux")
  eq(r.devis, null, "devis")
})

check("Bracket mal apparié — ne crash pas, retourne un objet exploitable", () => {
  // Input ambigu : le ] peut être un parasite OU un } mal typé. On ne peut
  // pas deviner l'intention — l'important est de ne pas lever et de récupérer
  // les données (peu importe leur niveau d'imbrication exact).
  const broken = '{"localisation":{"zone":"RDC","config":"PVC"],"diagnostic":"ok"}'
  const r = parseAiJson(broken)
  if (typeof r !== "object" || r === null) throw new Error("pas un objet")
  const flat = JSON.stringify(r)
  if (!flat.includes("RDC") || !flat.includes("ok")) throw new Error("données perdues")
})

check("JSON vraiment irréparable lève une erreur", () => {
  try {
    parseAiJson("ceci n'est pas du json du tout {{{")
    throw new Error("aurait dû lever")
  } catch (e: any) {
    if (e.message !== "JSON invalide et irréparable") throw new Error(`mauvais message: ${e.message}`)
  }
})

console.log(`\n${"═".repeat(40)}`)
console.log(`  ${pass} ✅   ${fail} ❌`)
console.log(`${"═".repeat(40)}\n`)
if (fail > 0) process.exit(1)
