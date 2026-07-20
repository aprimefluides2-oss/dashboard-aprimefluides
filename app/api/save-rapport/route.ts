import { NextRequest, NextResponse } from "next/server"
import { persistRapport } from "@/lib/persist"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PHOTOS_BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'interventions-photos'

/**
 * Une entrée du manifeste de photos envoyé par le client (dans l'ordre d'affichage).
 * - `storedUrl` : photo déjà présente dans Supabase Storage → réutilisée telle quelle
 *   (pas de ré-upload, pas d'orphelin).
 * - `fileKey` : nouvelle photo → le fichier est joint au multipart sous cette clé.
 */
type PhotoManifestEntry = { storedUrl?: string; legende?: string; fileKey?: string }

/**
 * Enregistre un rapport d'intervention dans Supabase sans le publier sur le site.
 * Permet à l'utilisateur de retrouver son brouillon dans l'historique pour le
 * télécharger / le facturer plus tard.
 *
 * Deux formats acceptés :
 *  - `application/json`  : rapport seul (rétro-compat, ex. Mode Terrain qui gère
 *    ses photos séparément) → photos NON touchées.
 *  - `multipart/form-data` : `meta` (JSON des champs rapport) + `photosManifest`
 *    (JSON ordonné) + fichiers photo (`photo_0`, `photo_1`, …). Les nouvelles
 *    photos sont uploadées vers Storage, l'ordre et les légendes préservés, puis
 *    `photos_urls`/`photos_legendes` écrits sur l'intervention → visibles à la
 *    réouverture depuis l'historique.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''

  let body: any
  // undefined = ne pas toucher aux photos ; array = remplacer.
  let photosUrls: string[] | undefined
  let photosLegendes: string[] | undefined
  let debugUploadErrors: string[] = []

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Multipart invalide' }, { status: 400 })
    }
    try {
      body = JSON.parse(String(formData.get('meta') || '{}'))
    } catch {
      return NextResponse.json({ error: 'Champ meta invalide' }, { status: 400 })
    }

    const manifestRaw = formData.get('photosManifest')
    if (manifestRaw != null) {
      let manifest: PhotoManifestEntry[]
      try {
        manifest = JSON.parse(String(manifestRaw))
      } catch {
        return NextResponse.json({ error: 'photosManifest invalide' }, { status: 400 })
      }
      const sb = getSupabaseOrNull()
      if (!sb) {
        return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
      }
      const folderKey = String(
        body.interventionId || body?.rapport?.reference || 'historique'
      ).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
      const stamp = Date.now()
      const urls: string[] = []
      const legendes: string[] = []
      const uploadErrors: string[] = []
      let uploadIdx = 0
      for (const entry of manifest) {
        const legende = (entry?.legende || '').slice(0, 200)
        if (entry?.storedUrl) {
          urls.push(entry.storedUrl)
          legendes.push(legende)
          continue
        }
        if (!entry?.fileKey) continue
        const f = formData.get(entry.fileKey)
        if (!(f instanceof File) || f.size === 0) { uploadErrors.push(`${entry.fileKey}: fichier absent/vide`); continue }
        const ext = (f.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg').toLowerCase()
        const path = `${folderKey}/${stamp}-${uploadIdx}${ext}`
        const buf = Buffer.from(await f.arrayBuffer())
        const { error } = await sb.storage
          .from(PHOTOS_BUCKET)
          .upload(path, buf, { contentType: f.type || 'image/jpeg', upsert: true })
        if (error) {
          console.error('[save-rapport upload photo]', { path, bucket: PHOTOS_BUCKET, error: error.message })
          uploadErrors.push(`${path}: ${error.message}`)
          continue
        }
        const { data } = sb.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
        if (data?.publicUrl) {
          urls.push(data.publicUrl)
          legendes.push(legende)
          uploadIdx++
        }
      }
      photosUrls = urls
      photosLegendes = legendes
      debugUploadErrors = uploadErrors
    }
  } else {
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }
  }

  if (!body?.rapport || typeof body.rapport !== 'object') {
    return NextResponse.json({ error: 'Champ rapport manquant' }, { status: 400 })
  }

  const result = await persistRapport({
    interventionId: body.interventionId || null,
    clientNom: body.clientNom,
    clientEmail: body.clientEmail,
    clientAdresse: body.clientAdresse,
    ville: body.ville,
    codePostal: body.codePostal,
    typeIntervention: body.typeIntervention,
    dateIntervention: body.dateIntervention,
    transcription: body.transcription,
    rapport: body.rapport,
    seo: body.seo,
    photosUrls,
    photosLegendes,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    id: result.id,
    mode: result.mode,
    photos_urls: photosUrls ?? null,
    photos_legendes: photosLegendes ?? null,
    debug_upload_errors: debugUploadErrors,
  })
}
