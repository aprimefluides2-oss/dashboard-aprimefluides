import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs/promises"
import { getSupabase } from "@/lib/supabase"
import type { VideoFormat } from "@/lib/video-render-prod"
import { uploadVideoToStorage } from "@/lib/video-storage"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 min — Vercel Pro plan needed beyond 60s

const ALL_FORMATS: VideoFormat[] = ["vertical", "horizontal", "square"]

type Body = {
  interventionId?: string
  formats?: VideoFormat[]
}

export async function POST(req: NextRequest) {
  // Avant chargement de @remotion/renderer (via video-render-prod)
  process.env.AWS_LAMBDA_JS_RUNTIME ??= "nodejs22.x"

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const interventionId = body.interventionId
  if (!interventionId) {
    return NextResponse.json({ error: "interventionId manquant" }, { status: 400 })
  }

  const formats = (body.formats?.length ? body.formats : ALL_FORMATS).filter((f) =>
    ALL_FORMATS.includes(f),
  )
  if (formats.length === 0) {
    return NextResponse.json({ error: "Aucun format valide" }, { status: 400 })
  }

  const sb = getSupabase()

  const { data: intervention, error: fetchErr } = await sb
    .from("interventions")
    .select("id, ville, type_intervention, photos_urls, rapport_json, date_realisee, video_urls")
    .eq("id", interventionId)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!intervention) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const photoUrls: string[] = Array.isArray(intervention.photos_urls) ? intervention.photos_urls : []
  if (photoUrls.length === 0) {
    return NextResponse.json({ error: "Aucune photo sur cette intervention" }, { status: 400 })
  }

  const photos = photoUrls.slice(0, 8).map((url) => ({ url }))

  await sb
    .from("interventions")
    .update({ video_status: "rendering", video_error: null })
    .eq("id", interventionId)

  const result: Partial<Record<VideoFormat, string>> = { ...(intervention.video_urls || {}) }

  try {
    const { renderVideo } = await import("@/lib/video-render-prod")
    for (const format of formats) {
      const { filePath } = await renderVideo({
        format,
        photos,
        ville: intervention.ville || undefined,
        typeIntervention: intervention.type_intervention || undefined,
        dateRealisee: intervention.date_realisee || undefined,
      })
      const stamp = Date.now()
      const storagePath = `${interventionId}/${stamp}-${format}.mp4`
      const publicUrl = await uploadVideoToStorage({ filePath, storagePath })
      result[format] = publicUrl
      await fs.unlink(filePath).catch(() => {})
    }

    await sb
      .from("interventions")
      .update({
        video_urls: result,
        video_status: "ready",
        video_rendered_at: new Date().toISOString(),
        video_error: null,
      })
      .eq("id", interventionId)

    return NextResponse.json({ ok: true, video_urls: result }, { status: 200 })
  } catch (e: any) {
    const message = e?.message || String(e)
    await sb
      .from("interventions")
      .update({ video_status: "failed", video_error: message })
      .eq("id", interventionId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
