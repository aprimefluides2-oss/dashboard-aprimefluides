import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PHOTOS_BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'interventions-photos'

type Params = { params: { id: string } }

/**
 * Upload d'une photo unique pour le Mode Terrain.
 * Multipart/form-data : `photo` (File), `legende` (string, optionnel).
 *
 * Ajoute l'URL publique à interventions.photos_urls[] et la légende à
 * interventions.photos_legendes[]. Bump terrain_step selon contexte
 * (1 = première photo "avant", 3 = photo "après").
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: 'ID intervention manquant' }, { status: 400 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart/form-data attendu' }, { status: 400 })
  }

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Photo manquante' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo trop lourde (max 10 MB)' }, { status: 413 })
  }

  const legende = String(formData.get('legende') || '').trim().slice(0, 200)

  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, photos_urls, photos_legendes, terrain_step')
    .eq('id', interventionId)
    .maybeSingle()
  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  const folder = interventionId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg').toLowerCase()
  const path = `${folder}/${Date.now()}${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const upload = await sb.storage
    .from(PHOTOS_BUCKET)
    .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true })
  if (upload.error) {
    return NextResponse.json({ error: `Upload échoué : ${upload.error.message}` }, { status: 502 })
  }

  const { data: pub } = sb.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
  const url = pub?.publicUrl
  if (!url) {
    return NextResponse.json({ error: 'URL publique introuvable' }, { status: 500 })
  }

  const photosUrls = [...(interv.photos_urls || []), url]
  const photosLegendes = [...(interv.photos_legendes || []), legende || defaultLegende(photosUrls.length - 1)]

  // Bump terrain_step : 1ère photo → 1, 2ème photo → 3 (post-travaux),
  // photos suivantes → ne touche pas au step (l'utilisateur peut ajouter
  // des photos pendant ou après sans casser le wizard).
  const currentStep = interv.terrain_step ?? 0
  let nextStep = currentStep
  if (photosUrls.length === 1 && currentStep < 1) nextStep = 1
  else if (photosUrls.length === 2 && currentStep < 3) nextStep = 3

  const { data: updated, error: upErr } = await sb
    .from('interventions')
    .update({
      photos_urls: photosUrls,
      photos_legendes: photosLegendes,
      terrain_step: nextStep,
    })
    .eq('id', interventionId)
    .select('id, photos_urls, photos_legendes, terrain_step')
    .single()
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    url,
    photos_urls: updated.photos_urls,
    photos_legendes: updated.photos_legendes,
    terrain_step: updated.terrain_step,
  })
}

function defaultLegende(index: number): string {
  if (index === 0) return 'Photo avant intervention'
  if (index === 1) return 'Photo après intervention'
  return `Photo ${index + 1}`
}
