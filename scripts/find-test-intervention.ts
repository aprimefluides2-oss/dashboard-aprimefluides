import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import path from "node:path"

const envFile = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8")
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "")
}

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

async function main() {
  const { data: all } = await sb
    .from("interventions")
    .select("id, reference, type_intervention, ville, statut, photos_urls, rapport_json, publie_slug")
    .eq("statut", "terminee")
    .order("date_realisee", { ascending: false, nullsFirst: false })
    .limit(20)

  console.log(`📊 ${all?.length || 0} interventions terminées\n`)

  let withRapportPhotos = 0
  let withPubliesSlug = 0
  for (const i of all || []) {
    const rapportPhotos = i.rapport_json?.photos || i.rapport_json?.images || []
    if (Array.isArray(rapportPhotos) && rapportPhotos.length > 0) withRapportPhotos++
    if (i.publie_slug) withPubliesSlug++
  }

  console.log(`Avec photos dans rapport_json : ${withRapportPhotos}`)
  console.log(`Avec publie_slug (publié sur ltdb.fr) : ${withPubliesSlug}\n`)

  // Échantillon d'une intervention pour voir la forme
  if (all && all.length > 0) {
    const sample = all[0]
    console.log(`Exemple — intervention ${sample.reference || sample.id.slice(0, 8)} :`)
    console.log(`  photos_urls = ${JSON.stringify(sample.photos_urls)}`)
    console.log(`  publie_slug = ${sample.publie_slug}`)
    if (sample.rapport_json) {
      console.log(`  rapport_json keys = ${Object.keys(sample.rapport_json).join(", ")}`)
      const rp = sample.rapport_json.photos || sample.rapport_json.images
      if (rp) console.log(`  rapport_json.photos/images = ${JSON.stringify(rp).slice(0, 200)}`)
    }
  }

  // Liste les buckets Storage pour voir ce qui existe
  const { data: buckets } = await sb.storage.listBuckets()
  console.log(`\nBuckets Storage : ${buckets?.map((b) => b.name).join(", ") || "(aucun)"}`)

  if (buckets?.find((b) => b.name === "interventions-photos")) {
    const { data: files } = await sb.storage.from("interventions-photos").list("", { limit: 20 })
    console.log(`\nDossiers dans interventions-photos (top 20) :`)
    for (const f of files || []) {
      console.log(`  - ${f.name}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
