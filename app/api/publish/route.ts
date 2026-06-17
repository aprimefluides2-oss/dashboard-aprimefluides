import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull, upsertClient } from "@/lib/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"

const PHOTOS_BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'interventions-photos'

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const ltdbUrl = process.env.CLIENT_API_URL
  const token = process.env.CLIENT_PUBLISH_TOKEN

  if (!ltdbUrl || !token) {
    return NextResponse.json({ error: 'Configuration API client manquante' }, { status: 500 })
  }

  try {
    const response = await fetch(`${ltdbUrl}/api/gallery/publish/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })

    const txt = await response.text()
    let data: any = null
    try { data = JSON.parse(txt) } catch { /* réponse non-JSON (HTML d'erreur Django, etc.) */ }

    if (!response.ok) {
      console.error('[publish] API client error', {
        status: response.status,
        url: `${ltdbUrl}/api/gallery/publish/`,
        contentType: response.headers.get('content-type'),
        bodyPreview: txt.slice(0, 2000),
        sentFields: Array.from(formData.keys()),
      })
      const msg = data
        ? (typeof data === 'string' ? data : data.error || data.detail || JSON.stringify(data))
        : `HTTP ${response.status} — ${txt.slice(0, 800)}`
      return NextResponse.json({ error: `API client : ${msg}`, status: response.status, bodyPreview: txt.slice(0, 800) }, { status: response.status })
    }

    // Persiste l'intervention en DB (best-effort, on ne bloque pas la réponse)
    persistIntervention(formData, data).catch(e => console.error('[publish] supabase persist', e))

    return NextResponse.json(data ?? { ok: true }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: `Publish fetch failed : ${e.message || e.toString()}` }, { status: 500 })
  }
}

async function persistIntervention(formData: FormData, ltdbResponse: any) {
  const sb = getSupabaseOrNull()
  if (!sb) return

  const get = (k: string) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : null
  }

  const clientNom = get('client_nom') || ''
  const clientEmail = get('client_email') || ''
  const clientAdresse = get('client_adresse') || ''
  const ville = get('intervention_city') || get('location') || ''
  const codePostal = get('postal_code') || ''
  const slug = ltdbResponse?.slug || get('slug') || ''
  const typeIntervention = get('service_type') || ''
  const dateRealisee = get('intervention_date') || null
  const transcription = get('transcription') || ''
  const rapportJson = safeParseJson(get('rapport_json'))
  const seoJson = safeParseJson(get('seo_json'))
  const reference = rapportJson?.reference || null
  const interventionId = get('intervention_id')

  // Upsert client
  const clientId = await upsertClient({
    nom: clientNom,
    email: clientEmail,
    adresse: clientAdresse,
    ville,
    code_postal: codePostal,
  })

  const photosUrls = await uploadInterventionPhotos(sb, formData, slug || interventionId || reference || 'intervention')

  if (interventionId) {
    // Mise à jour de l'intervention planifiée existante
    const { error } = await sb.from('interventions').update({
      client_id: clientId,
      type_intervention: typeIntervention || null,
      adresse_chantier: clientAdresse || null,
      ville: ville || null,
      code_postal: codePostal || null,
      date_realisee: dateRealisee,
      statut: 'terminee',
      transcription: transcription || null,
      rapport_json: rapportJson,
      seo_json: seoJson,
      publie_slug: slug || null,
      ...(photosUrls.length > 0 ? { photos_urls: photosUrls } : {}),
    }).eq('id', interventionId)
    if (error) console.error('[persistIntervention update]', error)
    return
  }

  // Sinon, insère une nouvelle intervention (status terminée car publiée).
  // Tente jusqu'à 5 fois en suffixant la référence si collision unique.
  let attempt = 0
  let currentRef: string | null = reference
  while (attempt < 5) {
    const { error } = await sb.from('interventions').insert({
      reference: currentRef,
      client_id: clientId,
      type_intervention: typeIntervention || null,
      adresse_chantier: clientAdresse || null,
      ville: ville || null,
      code_postal: codePostal || null,
      date_realisee: dateRealisee,
      statut: 'terminee',
      transcription: transcription || null,
      rapport_json: rapportJson,
      seo_json: seoJson,
      publie_slug: slug || null,
      photos_urls: photosUrls.length > 0 ? photosUrls : null,
    })
    if (!error) return
    // 23505 = unique_violation Postgres
    if (error.code === '23505' && currentRef) {
      attempt++
      const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
      currentRef = `${reference}-${suffix}`
      continue
    }
    console.error('[persistIntervention]', error)
    return
  }
  console.error('[persistIntervention] exhausted retries on duplicate reference')
}

function safeParseJson(s: string | null): any {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

async function uploadInterventionPhotos(
  sb: SupabaseClient,
  formData: FormData,
  folderKey: string,
): Promise<string[]> {
  const before = formData.get('before_image')
  const after = formData.get('after_image')

  const ordered: File[] = []
  if (before instanceof File && before.size > 0) ordered.push(before)
  if (
    after instanceof File && after.size > 0 &&
    !(before instanceof File && after.name === before.name && after.size === before.size && after.lastModified === before.lastModified)
  ) {
    ordered.push(after)
  }
  for (let i = 0; ; i++) {
    const f = formData.get(`extra_image_${i}`)
    if (!(f instanceof File) || f.size === 0) break
    ordered.push(f)
  }
  if (ordered.length === 0) return []

  const folder = (folderKey || 'intervention').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  const stamp = Date.now()
  const urls: string[] = []
  for (let i = 0; i < ordered.length; i++) {
    const file = ordered[i]
    const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg').toLowerCase()
    const path = `${folder}/${stamp}-${i}${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error } = await sb.storage
      .from(PHOTOS_BUCKET)
      .upload(path, buf, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })
    if (error) {
      console.error('[uploadInterventionPhotos]', { path, error: error.message })
      continue
    }
    const { data } = sb.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
    if (data?.publicUrl) urls.push(data.publicUrl)
  }
  return urls
}
