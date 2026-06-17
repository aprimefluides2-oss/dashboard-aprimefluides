/**
 * Test des suppressions : facture, devis, rapport/intervention, client.
 * Crée des données de test directement en base, puis exerce les routes
 * DELETE via HTTP et vérifie l'effet réel en base.
 *
 * Usage : E2E_BASE_URL=https://app-aprimefluides.vercel.app npx tsx scripts/test-delete-flow.ts
 */
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import path from "node:path"

const envFile = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8")
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "")
}

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000"
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

let pass = 0, fail = 0
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`) }
const ko = (m: string) => { fail++; console.log(`  ❌ ${m}`) }
const step = (m: string) => console.log(`\n━━ ${m} ━━`)

async function main() {
  console.log(`\n🧪 TEST SUPPRESSIONS — ${BASE}\n`)

  // ── Setup : client + intervention(+rapport) + facture + devis ──
  step("SETUP — création des données de test")
  const { data: client } = await sb.from("clients")
    .insert({ nom: "ZZ Test Suppression", email: "zz-suppr@e2e.fr" })
    .select("id").single()
  const clientId = client!.id
  ok(`Client test créé (${clientId.slice(0, 8)})`)

  const { data: interv } = await sb.from("interventions")
    .insert({
      type_intervention: "Débouchage canalisation",
      ville: "Toulon", code_postal: "83000",
      client_id: clientId, statut: "terminee",
      rapport_json: { objet: "Rapport test suppression", diagnostic: "test" },
    })
    .select("id, reference").single()
  const intervId = interv!.id
  ok(`Intervention test créée avec rapport (${intervId.slice(0, 8)})`)

  const { data: facture } = await sb.from("documents")
    .insert({
      type: "facture", numero: `FA-TEST-${Date.now()}`,
      intervention_id: intervId, client_id: clientId,
      montant_ht: 250, montant_ttc: 275, tva_taux: 10,
      statut: "brouillon", payload: { lignes: [] },
    })
    .select("id").single()
  const factureId = facture!.id
  ok(`Facture test créée (${factureId.slice(0, 8)})`)

  const { data: devis } = await sb.from("documents")
    .insert({
      type: "devis", numero: `DV-TEST-${Date.now()}`,
      intervention_id: intervId, client_id: clientId,
      montant_ht: 100, montant_ttc: 110, tva_taux: 10,
      statut: "brouillon", payload: { lignes: [] },
    })
    .select("id").single()
  const devisId = devis!.id
  ok(`Devis test créé (${devisId.slice(0, 8)})`)

  // ── 0. Suppression client BLOQUÉE (a des interventions + documents) ──
  step("0 — DELETE client avec liens → doit être REFUSÉ (409)")
  {
    const res = await fetch(`${BASE}/api/clients/${clientId}`, { method: "DELETE" })
    const body = await res.json().catch(() => null)
    if (res.status === 409) {
      ok(`Suppression bloquée (409) — ${body?.interventions} interv. + ${body?.documents} docs détectés`)
    } else {
      ko(`attendu 409, reçu ${res.status} ${JSON.stringify(body)}`)
    }
    const { data: check } = await sb.from("clients").select("id").eq("id", clientId).maybeSingle()
    check ? ok("Client toujours présent (non supprimé)") : ko("Client supprimé alors qu'il avait des liens !")
  }

  // ── 1. Suppression facture ──
  step("1 — DELETE facture (/api/historique/[id])")
  {
    const res = await fetch(`${BASE}/api/historique/${factureId}`, { method: "DELETE" })
    const body = await res.json().catch(() => null)
    res.ok && body?.ok ? ok("Route DELETE facture → 200 ok") : ko(`DELETE facture → ${res.status} ${JSON.stringify(body)}`)
    const { data: check } = await sb.from("documents").select("id").eq("id", factureId).maybeSingle()
    check === null ? ok("Facture absente de la base") : ko("Facture toujours en base")
    // double suppression → 404
    const res2 = await fetch(`${BASE}/api/historique/${factureId}`, { method: "DELETE" })
    res2.status === 404 ? ok("Double suppression → 404 (pas de faux succès)") : ko(`Double suppression → ${res2.status}`)
  }

  // ── 2. Suppression devis ──
  step("2 — DELETE devis (/api/historique/[id])")
  {
    const res = await fetch(`${BASE}/api/historique/${devisId}`, { method: "DELETE" })
    const body = await res.json().catch(() => null)
    res.ok && body?.ok ? ok("Route DELETE devis → 200 ok") : ko(`DELETE devis → ${res.status} ${JSON.stringify(body)}`)
    const { data: check } = await sb.from("documents").select("id").eq("id", devisId).maybeSingle()
    check === null ? ok("Devis absent de la base") : ko("Devis toujours en base")
  }

  // ── 3. Suppression rapport/intervention (hard) ──
  step("3 — DELETE intervention+rapport (/api/interventions/[id]?hard=1)")
  {
    const res = await fetch(`${BASE}/api/interventions/${intervId}?hard=1`, { method: "DELETE" })
    const body = await res.json().catch(() => null)
    res.ok && body?.ok ? ok("Route DELETE intervention hard → 200 ok") : ko(`DELETE intervention → ${res.status} ${JSON.stringify(body)}`)
    const { data: check } = await sb.from("interventions").select("id").eq("id", intervId).maybeSingle()
    check === null ? ok("Intervention + rapport absents de la base") : ko("Intervention toujours en base")
  }

  // ── 4. Suppression client ──
  step("4 — DELETE client (/api/clients/[id])")
  {
    const res = await fetch(`${BASE}/api/clients/${clientId}`, { method: "DELETE" })
    const body = await res.json().catch(() => null)
    if (res.status === 405 || res.status === 404) {
      ko(`Route DELETE client ABSENTE (HTTP ${res.status}) — à implémenter`)
    } else if (res.ok && body?.ok) {
      ok("Route DELETE client → 200 ok")
      const { data: check } = await sb.from("clients").select("id").eq("id", clientId).maybeSingle()
      check === null ? ok("Client absent de la base") : ko("Client toujours en base")
    } else {
      ko(`DELETE client → ${res.status} ${JSON.stringify(body)}`)
    }
  }

  // ── Cleanup (au cas où le DELETE client n'existe pas) ──
  step("CLEANUP")
  await sb.from("documents").delete().eq("intervention_id", intervId)
  await sb.from("interventions").delete().eq("id", intervId)
  await sb.from("clients").delete().eq("id", clientId)
  ok("Données de test nettoyées")

  console.log(`\n${"═".repeat(46)}`)
  console.log(`  RÉSULTAT : ${pass} ✅   ${fail} ❌`)
  console.log(`${"═".repeat(46)}`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error("\n💥", e); process.exit(1) })
