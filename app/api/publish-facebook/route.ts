import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { publishToFacebook, buildSocialMetadata } from "@/lib/social"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  let body: { interventionId?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const interventionId = body.interventionId
  if (!interventionId) return NextResponse.json({ error: "interventionId manquant" }, { status: 400 })

  const sb = getSupabase()
  const { data: intervention, error: fetchErr } = await sb
    .from("interventions")
    .select("id, reference, ville, type_intervention, rapport_json, video_urls")
    .eq("id", interventionId)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!intervention) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const videoUrl = intervention.video_urls?.square || intervention.video_urls?.horizontal
  if (!videoUrl) {
    return NextResponse.json({ error: "Pas de vidéo disponible. Génère d'abord." }, { status: 400 })
  }

  try {
    const meta = await buildSocialMetadata({
      typeIntervention: intervention.type_intervention,
      ville: intervention.ville,
      rapport: intervention.rapport_json,
    })

    const result = await publishToFacebook({
      videoUrl,
      title: meta.title,
      description: meta.description,
    })

    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Facebook publish failed" }, { status: 500 })
  }
}
