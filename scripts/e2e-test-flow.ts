/**
 * Test E2E grandeur nature du flux intervention / Mode Terrain.
 *
 * Déroule la séquence EXACTE du wizard via les routes API du serveur local :
 *   création intervention → photo avant → démarrer → photo après → fin
 *   → generate (IA) → save-rapport → facture-quick → store-pdf ×2
 *   → notify-rapport-facture → vérifs DB.
 *
 * Usage : npx tsx scripts/e2e-test-flow.ts
 * Prérequis : serveur dev sur localhost:3000 + .env.local rempli.
 */
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import path from "node:path"

// Note : en local, après la longue requête /api/generate (~90s), le keep-alive
// d'undici peut réutiliser une connexion morte ("other side closed"). Sur la
// prod Vercel chaque route est une lambda isolée — pas de souci. Tester sur prod.

// ── Charge .env.local ──
const envFile = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8")
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "")
}

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000"
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || "mondornaji@gmail.com"

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

let pass = 0
let fail = 0
function ok(label: string, detail = "") {
  pass++
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`)
}
function ko(label: string, detail = "") {
  fail++
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`)
}
function step(n: string) {
  console.log(`\n━━ ${n} ━━`)
}

async function jfetch(url: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, init)
  let body: any = null
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}

/** PDF minimal valide (~1.4 KB avec padding) — teste le pipeline upload/Storage/attachement. */
function makeTestPdf(title: string): Buffer {
  const content = `BT /F1 16 Tf 50 780 Td (${title}) Tj ET`
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ]
  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"))
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  // Padding commentaire pour dépasser le seuil 1000 octets de la route store-pdf.
  pdf += "% " + "padding-".repeat(130) + "\n"
  const xref = Buffer.byteLength(pdf, "latin1")
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach(o => { pdf += String(o).padStart(10, "0") + " 00000 n \n" })
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, "latin1")
}

async function uploadPdf(interventionId: string, kind: "rapport" | "facture") {
  const pdf = makeTestPdf(`Aprime — PDF ${kind} test E2E`)
  const fd = new FormData()
  fd.append("kind", kind)
  fd.append("pdf", new Blob([pdf], { type: "application/pdf" }), `${kind}-test.pdf`)
  const res = await fetch(`${BASE}/api/interventions/${interventionId}/store-pdf`, { method: "POST", body: fd })
  const body = await res.json().catch(() => null)
  return { status: res.status, body, size: pdf.length }
}

async function uploadPhoto(interventionId: string, legende: string) {
  // PNG 1x1 transparent valide
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==",
    "base64",
  )
  const fd = new FormData()
  fd.append("photo", new Blob([png], { type: "image/png" }), "photo-test.png")
  fd.append("legende", legende)
  const res = await fetch(`${BASE}/api/interventions/${interventionId}/photo`, { method: "POST", body: fd })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

async function main() {
  console.log(`\n🧪 TEST E2E — Flux intervention complet`)
  console.log(`   Base : ${BASE}`)
  console.log(`   Email test : ${TEST_EMAIL}`)

  let interventionId = ""
  let clientId = ""

  // ── 1. Création intervention + client ──
  step("ÉTAPE 1/10 — Création intervention")
  {
    const { status, body } = await jfetch(`${BASE}/api/interventions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { nom: "Client Test E2E", email: TEST_EMAIL, telephone: "0600000000" },
        type_intervention: "Débouchage canalisation",
        adresse_chantier: "12 rue du Test",
        ville: "Argenteuil",
        code_postal: "95100",
        date_prevue: new Date().toISOString().slice(0, 10),
        prix_prevu: 250,
      }),
    })
    if ((status === 200 || status === 201) && body?.intervention?.id) {
      interventionId = body.intervention.id
      clientId = body.intervention.client_id
      ok("Intervention créée", `${body.intervention.reference} (${interventionId.slice(0, 8)})`)
    } else {
      ko("Création intervention", `HTTP ${status} ${JSON.stringify(body)}`)
      throw new Error("Stop : impossible de créer l'intervention")
    }
  }

  // ── 2. Photo AVANT (step 0 → 1) ──
  step("ÉTAPE 2/10 — Upload photo avant")
  {
    const { status, body } = await uploadPhoto(interventionId, "Photo avant intervention")
    if (status === 200 && body?.url) ok("Photo avant uploadée", `step=${body.terrain_step}`)
    else ko("Photo avant", `HTTP ${status} ${JSON.stringify(body)}`)
  }

  // ── 3. Démarrer (step 1 → 2, statut en_cours) ──
  step("ÉTAPE 3/10 — Démarrer l'intervention")
  {
    const { status, body } = await jfetch(`${BASE}/api/interventions/${interventionId}/terrain-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "debut" }),
    })
    if (status === 200 && body?.intervention?.statut === "en_cours") {
      ok("Démarrée", `statut=${body.intervention.statut}, step=${body.intervention.terrain_step}, heure_debut OK`)
    } else {
      ko("Démarrer", `HTTP ${status} ${JSON.stringify(body)}`)
    }
  }

  // ── 4. Photo APRÈS ──
  step("ÉTAPE 4/10 — Upload photo après")
  {
    const { status, body } = await uploadPhoto(interventionId, "Photo après intervention")
    if (status === 200 && body?.url) ok("Photo après uploadée", `step=${body.terrain_step}`)
    else ko("Photo après", `HTTP ${status} ${JSON.stringify(body)}`)
  }

  // ── 5. Terminer le chrono (action fin) ──
  step("ÉTAPE 5/10 — Fin du chrono")
  {
    const { status, body } = await jfetch(`${BASE}/api/interventions/${interventionId}/terrain-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fin" }),
    })
    if (status === 200 && body?.intervention?.heure_fin_reelle) ok("Chrono terminé", "heure_fin OK")
    else ko("Fin chrono", `HTTP ${status} ${JSON.stringify(body)}`)
  }

  // ── 6. Génération rapport IA ──
  step("ÉTAPE 6/10 — Génération rapport (IA DeepSeek)")
  let rapport: any = null
  let seo: any = null
  {
    const { status, body } = await jfetch(`${BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcription:
          "Intervention de débouchage sur une colonne d'eaux usées dans un immeuble collectif. " +
          "J'ai trouvé un bouchon de graisse important au niveau du regard du rez-de-chaussée. " +
          "J'ai utilisé le furet électrique puis un hydrocurage haute pression pour nettoyer toute la colonne. " +
          "L'écoulement est maintenant parfait. Je recommande un entretien annuel. Forfait débouchage 250 euros.",
        type_intervention: "Débouchage canalisation",
        ville: "Argenteuil",
        code_postal: "95100",
      }),
    })
    if (status === 200 && body?.rapport) {
      rapport = body.rapport
      seo = body.seo || {}
      ok("Rapport généré", `clés: ${Object.keys(rapport).join(", ")}`)
    } else {
      ko("Génération IA", `HTTP ${status} ${JSON.stringify(body).slice(0, 200)}`)
      // Fallback : rapport minimal pour continuer le test du reste du pipeline
      rapport = {
        objet: "Débouchage colonne eaux usées — test E2E",
        diagnostic: "Bouchon de graisse au regard RDC.",
        travaux_realises: "Furet électrique + hydrocurage haute pression.",
        recommandations: "Entretien annuel recommandé.",
        commentaire_technicien: "Écoulement rétabli.",
        devis: { lignes: [{ designation: "Forfait débouchage", qte: 1, unite: "forfait", pu_ht: 250 }] },
      }
      seo = {}
      console.log("  ⚠ Fallback rapport minimal utilisé pour continuer le test")
    }
  }

  // ── 7. Sauvegarde rapport ──
  step("ÉTAPE 7/10 — Sauvegarde rapport")
  {
    const { status, body } = await jfetch(`${BASE}/api/save-rapport`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interventionId,
        rapport,
        seo,
        transcription: "test e2e",
        typeIntervention: "Débouchage canalisation",
        dateIntervention: new Date().toISOString().slice(0, 10),
      }),
    })
    if (status === 200 && body?.ok) ok("Rapport sauvegardé", `mode=${body.mode}`)
    else ko("Save rapport", `HTTP ${status} ${JSON.stringify(body)}`)
  }
  // bump step 4
  await jfetch(`${BASE}/api/interventions/${interventionId}/terrain-step`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set", step: 4 }),
  })

  // ── 8. Création facture ──
  step("ÉTAPE 8/10 — Création facture")
  {
    const { status, body } = await jfetch(`${BASE}/api/interventions/${interventionId}/facture-quick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lignes: [{ designation: "Forfait débouchage canalisation", qte: 1, unite: "forfait", pu_ht: 250, inclus: false }],
        echeance: "À réception",
        tva_taux: 10,
      }),
    })
    if (status === 200 && body?.factureId) ok("Facture créée", `id=${body.factureId.slice(0, 8)}, numéro=${body.payload?.numero || "?"}`)
    else ko("Création facture", `HTTP ${status} ${JSON.stringify(body).slice(0, 200)}`)
  }

  // ── 9. Upload des 2 PDFs (store-pdf) ──
  step("ÉTAPE 9/10 — Upload PDFs sur Storage (store-pdf)")
  {
    const r = await uploadPdf(interventionId, "rapport")
    if (r.status === 200 && r.body?.url) ok("PDF rapport uploadé", `${r.size} octets → ${r.body.url.slice(-40)}`)
    else ko("store-pdf rapport", `HTTP ${r.status} ${JSON.stringify(r.body)}`)

    const f = await uploadPdf(interventionId, "facture")
    if (f.status === 200 && f.body?.url) ok("PDF facture uploadé", `${f.size} octets → ${f.body.url.slice(-40)}`)
    else ko("store-pdf facture", `HTTP ${f.status} ${JSON.stringify(f.body)}`)
  }

  // ── 10. Envoi mail (notify-rapport-facture) ──
  step("ÉTAPE 10/10 — Envoi mail combiné rapport + facture")
  {
    const { status, body } = await jfetch(`${BASE}/api/notify-rapport-facture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interventionId, clientEmail: TEST_EMAIL }),
    })
    if (status === 200 && body?.ok) {
      ok("Mail envoyé", `immediate_id=${body.immediate_id}, relances=${(body.followUp_ids || []).length}`)
    } else {
      ko("Envoi mail", `HTTP ${status} ${JSON.stringify(body)}`)
    }
  }

  // ── 10bis. Test idempotence (2e envoi immédiat) ──
  step("BONUS — Test idempotence (2e envoi immédiat)")
  {
    const { status, body } = await jfetch(`${BASE}/api/notify-rapport-facture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interventionId, clientEmail: TEST_EMAIL }),
    })
    if (status === 200 && body?.alreadySent === true) ok("Idempotence OK", "2e envoi bloqué (alreadySent=true), pas de doublon")
    else ko("Idempotence", `attendu alreadySent=true, reçu HTTP ${status} ${JSON.stringify(body)}`)
  }

  // ── Vérifications finales en DB ──
  step("VÉRIFICATIONS DB")
  {
    const { data: iv } = await sb
      .from("interventions")
      .select("statut, terrain_step, mail_envoye_at, pdf_rapport_url, heure_debut_reelle, heure_fin_reelle, photos_urls, rapport_json")
      .eq("id", interventionId)
      .single()
    if (iv) {
      iv.statut === "terminee" ? ok("statut = terminee") : ko("statut", `attendu terminee, reçu ${iv.statut}`)
      iv.mail_envoye_at ? ok("mail_envoye_at renseigné", iv.mail_envoye_at) : ko("mail_envoye_at", "null")
      iv.pdf_rapport_url ? ok("pdf_rapport_url renseigné") : ko("pdf_rapport_url", "null")
      iv.heure_debut_reelle && iv.heure_fin_reelle ? ok("heures début/fin OK") : ko("heures", "manquantes")
      ;(iv.photos_urls?.length ?? 0) >= 2 ? ok(`photos_urls = ${iv.photos_urls.length}`) : ko("photos_urls", `${iv.photos_urls?.length ?? 0}`)
      iv.rapport_json && Object.keys(iv.rapport_json).length > 0 ? ok("rapport_json présent") : ko("rapport_json", "vide")
    } else {
      ko("Lecture intervention DB", "introuvable")
    }

    const { data: docs } = await sb
      .from("documents")
      .select("id, numero, type, pdf_url, envoye_email, envoye_at, montant_ttc")
      .eq("intervention_id", interventionId)
      .eq("type", "facture")
    const fac = docs?.[0]
    if (fac) {
      ok("Facture en DB", `${fac.numero}, ${fac.montant_ttc}€ TTC`)
      fac.pdf_url ? ok("facture.pdf_url renseigné") : ko("facture.pdf_url", "null")
      fac.envoye_email ? ok("facture.envoye_email renseigné", fac.envoye_email) : ko("facture.envoye_email", "null")
    } else {
      ko("Facture en DB", "introuvable")
    }
  }

  // ── Résumé ──
  console.log(`\n${"═".repeat(50)}`)
  console.log(`  RÉSULTAT : ${pass} ✅   ${fail} ❌`)
  console.log(`  Intervention test : ${interventionId}`)
  console.log(`  Fiche : ${BASE}/intervention/${interventionId}`)
  console.log(`${"═".repeat(50)}`)
  if (fail > 0) process.exit(1)
}

main().catch(e => {
  console.error("\n💥 ERREUR FATALE :", e)
  process.exit(1)
})
