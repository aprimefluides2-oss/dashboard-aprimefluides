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

const SEED_PHOTOS = [
  "https://www.aprime-fluides.fr/media/gallery/before/argenteuil-wc-bouche-avant.webp",
  "https://www.aprime-fluides.fr/media/gallery/after/argenteuil-wc-bouche-apres.webp",
  "https://www.aprime-fluides.fr/media/gallery/before/alfortville-pompe-avant.webp",
  "https://www.aprime-fluides.fr/media/gallery/after/alfortville-pompe-apres.webp",
  "https://www.aprime-fluides.fr/media/gallery/before/avant-debouchage-wc-au-furet-manuel-768x768.webp",
  "https://www.aprime-fluides.fr/media/gallery/after/apres-debouchage-wc-au-furet-manuel-768x768.webp",
]

async function main() {
  const { data: latest } = await sb
    .from("interventions")
    .select("id, reference, type_intervention, ville, photos_urls")
    .eq("statut", "terminee")
    .order("date_realisee", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!latest) {
    console.error("❌ Aucune intervention terminée trouvée")
    process.exit(1)
  }

  console.log(`Cible : ${latest.reference || latest.id.slice(0, 8)} — ${latest.type_intervention || "?"} à ${latest.ville || "?"}`)
  console.log(`photos_urls actuel : ${JSON.stringify(latest.photos_urls)}`)

  const { error } = await sb
    .from("interventions")
    .update({ photos_urls: SEED_PHOTOS })
    .eq("id", latest.id)

  if (error) {
    console.error("❌ Update échoué :", error.message)
    process.exit(1)
  }

  console.log(`\n✅ Photos seedées (${SEED_PHOTOS.length} URLs publiques Aprime)`)
  console.log(`\n🎬 Va tester ici :`)
  console.log(`   http://localhost:3000/intervention/${latest.id}`)
  console.log(`\n   Tu devrais voir la card "Vidéo réseaux sociaux" avec un bouton "Générer la vidéo".`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
