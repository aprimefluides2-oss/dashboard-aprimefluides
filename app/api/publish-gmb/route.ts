import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { createGmbPost } from "@/lib/gmb"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const SITE = "https://www.aprime-fluides.fr"

/**
 * POST /api/publish-gmb — publie une intervention en post Google Business Profile.
 * Body : { interventionId }
 */
export async function POST(req: NextRequest) {
  let body: { interventionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }
  const interventionId = (body.interventionId || "").trim()
  if (!interventionId) {
    return NextResponse.json({ error: "interventionId requis" }, { status: 400 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const { data: interv, error } = await sb
    .from("interventions")
    .select("type_intervention, ville, seo_json, photos_urls, publie_slug")
    .eq("id", interventionId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  // Texte du post — résumé SEO de l'intervention, avec repli sur un gabarit.
  const seo = (interv.seo_json || {}) as {
    resume_rich_snippet?: string
    meta_description?: string
  }
  const type = interv.type_intervention || "Intervention"
  const ville = interv.ville || "Var"
  const resume =
    seo.resume_rich_snippet ||
    seo.meta_description ||
    `${type} réalisée à ${ville} par Aprime fluides.`

  // Texte sobre et factuel : pas de numéro de téléphone, pas d'URL ni de ton
  // promotionnel dans le corps — règlement « contenu » des posts Google Business
  // (le lien part dans le bouton callToAction, pas dans le texte).
  const summary = [`${type} à ${ville}`, "", resume].join("\n")

  const photos: string[] = Array.isArray(interv.photos_urls) ? interv.photos_urls : []
  const photoUrl = photos[0] || null
  const ctaUrl = interv.publie_slug
    ? `${SITE}/nos-realisations/${interv.publie_slug}`
    : SITE

  try {
    const result = await createGmbPost({ summary, photoUrl, ctaUrl })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec publication GMB" },
      { status: 502 },
    )
  }
}
