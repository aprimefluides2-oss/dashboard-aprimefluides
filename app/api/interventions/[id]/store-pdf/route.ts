import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PDFS_BUCKET = process.env.SUPABASE_PDFS_BUCKET || 'intervention-pdfs'

type Params = { params: { id: string } }

/**
 * Upload d'un PDF (rapport ou facture) sur Supabase Storage et
 * persistance de l'URL publique en DB.
 *
 * Multipart/form-data :
 *   - `pdf`  : File (application/pdf)
 *   - `kind` : 'rapport' | 'facture'
 *
 * Effet :
 *   - kind='rapport' → interventions.pdf_rapport_url
 *   - kind='facture' → documents.pdf_url (dernière facture liée)
 *
 * Le multipart évite la limite ~4.5 MB du body JSON sur Vercel
 * (un PDF rapport avec photos peut dépasser cette limite en base64).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const interventionId = params.id
  if (!interventionId) return NextResponse.json({ error: 'ID intervention manquant' }, { status: 400 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart/form-data attendu' }, { status: 400 })
  }

  const kind = String(formData.get('kind') || '').trim()
  if (kind !== 'rapport' && kind !== 'facture') {
    return NextResponse.json({ error: 'kind doit être "rapport" ou "facture"' }, { status: 400 })
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

  let factureId: string | null = null
  if (kind === 'facture') {
    // range(0, 0) au lieu de limit(1) : limit + order drop silencieusement la
    // ligne la plus récente sur supabase-js (bug documenté, cf. /api/historique).
    const { data: facs } = await sb
      .from('documents')
      .select('id')
      .eq('intervention_id', interventionId)
      .eq('type', 'facture')
      .order('created_at', { ascending: false })
      .range(0, 0)
    factureId = facs?.[0]?.id || null
    if (!factureId) {
      return NextResponse.json({ error: 'Aucune facture trouvée pour cette intervention' }, { status: 404 })
    }
  }

  const folder = interventionId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  // Nonce 6 hex pour éviter collisions si 2 uploads sub-ms (très improbable, mais peu coûteux).
  const nonce = crypto.randomBytes(3).toString('hex')
  const filename = `${kind}-${Date.now()}-${nonce}.pdf`
  const path = `${folder}/${filename}`
  const buf = Buffer.from(await file.arrayBuffer())

  const upload = await sb.storage
    .from(PDFS_BUCKET)
    .upload(path, buf, { contentType: 'application/pdf', upsert: true })
  if (upload.error) {
    return NextResponse.json({ error: `Upload échoué : ${upload.error.message}` }, { status: 502 })
  }

  const { data: pub } = sb.storage.from(PDFS_BUCKET).getPublicUrl(path)
  const url = pub?.publicUrl
  if (!url) return NextResponse.json({ error: 'URL publique introuvable' }, { status: 500 })

  if (kind === 'rapport') {
    const { error } = await sb
      .from('interventions')
      .update({ pdf_rapport_url: url })
      .eq('id', interventionId)
    if (error) return NextResponse.json({ error: `DB update échouée : ${error.message}` }, { status: 500 })
  } else {
    const { error } = await sb
      .from('documents')
      .update({ pdf_url: url })
      .eq('id', factureId!)
    if (error) return NextResponse.json({ error: `DB update échouée : ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, url, kind })
}
