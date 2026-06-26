/**
 * E2E : intervention fictive neuve → terrain → vidéo → publication site + GMB.
 *
 * Usage local :  npm run dev  puis  npx tsx scripts/e2e-full-publish.ts
 * Usage prod   :  E2E_BASE_URL=https://app-aprimefluides.vercel.app \
 *                 E2E_INTERNAL_SECRET="$(grep NEXTAUTH_SECRET .env.vercel | cut -d= -f2)" \
 *                 npx tsx scripts/e2e-full-publish.ts
 */
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import path from "node:path"

function loadEnvFile(name: string) {
  const p = path.resolve(process.cwd(), name)
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "")
  }
}
loadEnvFile(".env.local")
loadEnvFile(".env.vercel")

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000"
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || "mondornaji@gmail.com"
const RUN_VIDEO = process.env.E2E_SKIP_VIDEO !== "1"
const RUN_GMB = process.env.E2E_SKIP_GMB !== "1"
/** Secret prod : E2E_INTERNAL_SECRET ou `vercel env pull .env.vercel` (écrase pas .env.local). */
const INTERNAL_SECRET =
  process.env.E2E_INTERNAL_SECRET || process.env.NEXTAUTH_SECRET || ""

/** Headers pour contourner le middleware (appels serveur→serveur E2E). */
function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra }
  if (INTERNAL_SECRET) h["x-internal-auth"] = INTERNAL_SECRET
  return h
}

const SEED_PHOTOS = [
  "https://www.aprime-fluides.fr/media/gallery/before/argenteuil-wc-bouche-avant.webp",
  "https://www.aprime-fluides.fr/media/gallery/after/argenteuil-wc-bouche-apres.webp",
  "https://www.aprime-fluides.fr/media/gallery/before/alfortville-pompe-avant.webp",
  "https://www.aprime-fluides.fr/media/gallery/after/alfortville-pompe-apres.webp",
]

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

async function jfetch(url: string, init?: RequestInit, timeoutMs = 120_000): Promise<{ status: number; body: any }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  const headers = apiHeaders(
    init?.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : (init?.headers as Record<string, string> | undefined),
  )
  try {
    const res = await fetch(url, { ...init, headers, signal: ctrl.signal })
    let body: any = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    return { status: res.status, body }
  } finally {
    clearTimeout(t)
  }
}

function makeTestPdf(title: string): Buffer {
  const content = `BT /F1 12 Tf 50 780 Td (${title}) Tj ET`
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
  pdf += "% " + "pad-".repeat(130) + "\n"
  const xref = Buffer.byteLength(pdf, "latin1")
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach(o => {
    pdf += String(o).padStart(10, "0") + " 00000 n \n"
  })
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, "latin1")
}

async function uploadPdf(interventionId: string, kind: "rapport" | "facture") {
  const fd = new FormData()
  fd.append("kind", kind)
  fd.append("pdf", new Blob([makeTestPdf(`Aprime E2E ${kind}`)], { type: "application/pdf" }), `${kind}.pdf`)
  const res = await fetch(`${BASE}/api/interventions/${interventionId}/store-pdf`, {
    method: "POST",
    headers: apiHeaders(),
    body: fd,
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

async function main() {
  console.log(`\n🧪 E2E COMPLET — intervention fictive → publication`)
  console.log(`   Base : ${BASE}`)
  if (!INTERNAL_SECRET) {
    console.error("❌ NEXTAUTH_SECRET manquant dans .env.local")
    process.exit(1)
  }
  const ref = `E2E-${Date.now()}`
  let interventionId = ""

  step("1 — Création intervention (statut planifiée)")
  {
    const { status, body } = await jfetch(`${BASE}/api/interventions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: {
          nom: `Client fictif ${ref}`,
          email: TEST_EMAIL,
          telephone: "0612345678",
        },
        type_intervention: "Débouchage canalisation",
        adresse_chantier: "15 avenue du Test",
        ville: "Bezons",
        code_postal: "95870",
        date_prevue: new Date().toISOString().slice(0, 10),
        prix_prevu: 280,
        notes_internes: `Intervention test automatisée ${ref}`,
      }),
    })
    if ((status === 200 || status === 201) && body?.intervention?.id) {
      interventionId = body.intervention.id
      ok("Intervention créée", `${body.intervention.reference} · ${interventionId.slice(0, 8)}`)
    } else {
      ko("Création", `HTTP ${status} ${JSON.stringify(body)}`)
      process.exit(1)
    }
  }

  step("2 — Photos réelles (seed Supabase)")
  {
    const { error } = await sb
      .from("interventions")
      .update({ photos_urls: SEED_PHOTOS })
      .eq("id", interventionId)
    if (error) ko("Photos seed", error.message)
    else ok("photos_urls", `${SEED_PHOTOS.length} images Aprime`)
  }

  step("3 — Terrain : démarrer + fin chrono")
  {
    let r = await jfetch(`${BASE}/api/interventions/${interventionId}/terrain-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "debut" }),
    })
    if (r.status === 200 && r.body?.intervention?.statut === "en_cours") ok("Démarrée")
    else ko("Début", `HTTP ${r.status}`)

    r = await jfetch(`${BASE}/api/interventions/${interventionId}/terrain-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fin" }),
    })
    if (r.status === 200) ok("Chrono terminé")
    else ko("Fin chrono", `HTTP ${r.status}`)
  }

  step("4 — Rapport IA + sauvegarde")
  let rapport: any
  let seo: any = {}
  {
    const { status, body } = await jfetch(
      `${BASE}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcription:
            "Débouchage colonne eaux usées immeuble à Bezons. Bouchon graisses au regard RDC. " +
            "Furet électrique puis hydrocurage 150 bars. Écoulement rétabli. " +
            "Canalisation fonte en état correct après nettoyage. Forfait intervention 280 euros HT.",
          type_intervention: "Débouchage canalisation",
          ville: "Bezons",
          code_postal: "95870",
        }),
      },
      180_000,
    )
    if (status === 200 && body?.rapport) {
      rapport = body.rapport
      seo = body.seo || {}
      ok("Rapport IA", Object.keys(rapport).slice(0, 6).join(", "))
    } else {
      rapport = {
        objet: "Débouchage colonne EU — test E2E",
        diagnostic: "Bouchon graisses regard RDC.",
        travaux_realises: "Furet + hydrocurage.",
        recommandations: "Curage annuel conseillé.",
      }
      ko("IA rapport", `fallback minimal — HTTP ${status}`)
    }

    const save = await jfetch(`${BASE}/api/save-rapport`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interventionId,
        rapport,
        seo,
        transcription: "e2e full publish",
        typeIntervention: "Débouchage canalisation",
        dateIntervention: new Date().toISOString().slice(0, 10),
      }),
    })
    if (save.status === 200) ok("Rapport sauvegardé")
    else ko("Save rapport", `HTTP ${save.status}`)
  }

  step("5 — Facture + PDFs storage")
  {
    const fac = await jfetch(`${BASE}/api/interventions/${interventionId}/facture-quick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lignes: [{ designation: "Forfait débouchage", qte: 1, unite: "forfait", pu_ht: 280 }],
        echeance: "À réception",
        tva_taux: 10,
      }),
    })
    if (fac.status === 200) ok("Facture", fac.body?.factureId?.slice(0, 8) || "ok")
    else ko("Facture", `HTTP ${fac.status}`)

    const rp = await uploadPdf(interventionId, "rapport")
    if (rp.status === 200) ok("PDF rapport storage")
    else ko("PDF rapport", `HTTP ${rp.status}`)

    const fp = await uploadPdf(interventionId, "facture")
    if (fp.status === 200) ok("PDF facture storage")
    else ko("PDF facture", `HTTP ${fp.status}`)
  }

  await jfetch(`${BASE}/api/interventions/${interventionId}/terrain-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set", step: 5 }),
  })

  if (RUN_VIDEO) {
    step("6 — Génération vidéo (horizontal, ~3 min)")
    {
      const { status, body } = await jfetch(
        `${BASE}/api/generate-video`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interventionId, formats: ["horizontal"] }),
        },
        320_000,
      )
      if (status === 200 && body?.video_urls?.horizontal) {
        ok("Vidéo", body.video_urls.horizontal.slice(-50))
      } else {
        ko("Vidéo", `HTTP ${status} — ${body?.error || JSON.stringify(body).slice(0, 300)}`)
      }
    }
  } else {
    console.log("\n━━ 6 — Vidéo ignorée (E2E_SKIP_VIDEO=1) ━━")
  }

  step("7 — Publication sur le site")
  {
    const { status, body } = await jfetch(
      `${BASE}/api/publish/from-intervention`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionId }),
      },
      120_000,
    )
    if (status === 200 && (body?.slug || body?.ok)) {
      ok("Site", body.slug || body.url || "publié")
    } else {
      ko("Site", `HTTP ${status} — ${body?.error || JSON.stringify(body).slice(0, 200)}`)
    }
  }

  if (RUN_GMB) {
    step("8 — Post Google Business")
    {
      const { status, body } = await jfetch(
        `${BASE}/api/publish-gmb`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interventionId }),
        },
        60_000,
      )
      if (status === 200 && body?.ok) ok("GMB", body.name || "post créé")
      else ko("GMB", `HTTP ${status} — ${body?.error || JSON.stringify(body).slice(0, 200)}`)
    }
  }

  step("9 — Vérification finale DB")
  {
    const { data: iv } = await sb
      .from("interventions")
      .select("statut, terrain_step, publie_slug, video_urls, video_status, video_error, rapport_json, photos_urls")
      .eq("id", interventionId)
      .single()
    if (iv) {
      iv.rapport_json && Object.keys(iv.rapport_json).length > 0 ? ok("rapport_json") : ko("rapport_json", "vide")
      ;(iv.photos_urls?.length ?? 0) >= 2 ? ok(`photos (${iv.photos_urls.length})`) : ko("photos", "0")
      iv.publie_slug ? ok("publie_slug", iv.publie_slug) : ko("publie_slug", "null")
      if (RUN_VIDEO) {
        iv.video_urls?.horizontal ? ok("video horizontal") : ko("video", iv.video_error || iv.video_status || "absente")
      }
    }
  }

  console.log(`\n${"═".repeat(52)}`)
  console.log(`  ${pass} ✅   ${fail} ❌`)
  console.log(`  Intervention : ${interventionId}`)
  console.log(`  Fiche : ${BASE}/intervention/${interventionId}`)
  console.log(`  Terrain : ${BASE}/intervention/${interventionId}/terrain`)
  console.log(`${"═".repeat(52)}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => {
  console.error("\n💥", e)
  process.exit(1)
})
