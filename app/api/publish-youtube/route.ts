import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { buildVideoMetadata, uploadVideoToYouTube } from "@/lib/youtube"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type Body = { interventionId?: string }

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
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

  const horizontalUrl: string | undefined = intervention.video_urls?.horizontal
  if (!horizontalUrl) {
    return NextResponse.json(
      { error: "Pas de vidéo 16:9 disponible. Génère la vidéo d'abord." },
      { status: 400 },
    )
  }

  await sb.from("interventions").update({ video_status: "uploading", video_error: null }).eq("id", interventionId)

  try {
    const meta = await buildVideoMetadata({
      typeIntervention: intervention.type_intervention,
      ville: intervention.ville,
      reference: intervention.reference,
      rapport: intervention.rapport_json,
    })

    const { videoId, url } = await uploadVideoToYouTube({
      videoUrl: horizontalUrl,
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      privacyStatus: "public",
    })

    await sb
      .from("interventions")
      .update({
        video_youtube_id: videoId,
        video_youtube_url: url,
        video_status: "published",
        video_published_at: new Date().toISOString(),
        video_error: null,
      })
      .eq("id", interventionId)

    return NextResponse.json({ ok: true, videoId, url }, { status: 200 })
  } catch (e: any) {
    const message = e?.message || String(e)
    await sb
      .from("interventions")
      .update({ video_status: "ready", video_error: message })
      .eq("id", interventionId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
