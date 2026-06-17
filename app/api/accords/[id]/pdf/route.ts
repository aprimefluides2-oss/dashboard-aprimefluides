import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const BUCKET = 'accords-pdfs'

type Params = { params: { id: string } }

/**
 * POST /api/accords/[id]/pdf — archive le PDF d'un accord sur Supabase Storage.
 *
 * Le PDF est rendu côté client (@react-pdf/renderer) puis envoyé en
 * multipart/form-data — même approche que /api/interventions/[id]/store-pdf
 * (évite la limite ~4.5 MB du body JSON sur Vercel).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const accordId = params.id
  if (!accordId) return NextResponse.json({ error: 'ID accord manquant' }, { status: 400 })

  const { data: accord } = await sb
    .from('accords_intervention')
    .select('id')
    .eq('id', accordId)
    .maybeSingle()
  if (!accord) return NextResponse.json({ error: 'Accord introuvable' }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart/form-data attendu' }, { status: 400 })
  }

  const file = formData.get('pdf')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'PDF manquant' }, { status: 400 })
  }
  if (file.size < 1000) {
    return NextResponse.json({ error: 'PDF trop petit (probablement corrompu)' }, { status: 400 })
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: 'PDF trop lourd (max 12 MB)' }, { status: 413 })
  }

  // Chemin horodaté : évite qu'un PDF régénéré soit masqué par le cache CDN.
  const path = `${accordId}/${Date.now()}.pdf`
  const buf = Buffer.from(await file.arrayBuffer())

  const upload = await sb.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'application/pdf', upsert: true })
  if (upload.error) {
    return NextResponse.json({ error: `Upload échoué : ${upload.error.message}` }, { status: 502 })
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)
  const url = pub?.publicUrl
  if (!url) return NextResponse.json({ error: 'URL publique introuvable' }, { status: 500 })

  const { error } = await sb
    .from('accords_intervention')
    .update({ pdf_url: url })
    .eq('id', accordId)
  if (error) {
    return NextResponse.json({ error: `DB update échouée : ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, url })
}
