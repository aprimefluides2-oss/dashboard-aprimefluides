import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const BUCKET = 'accords-pdfs'

type Params = { params: { id: string } }

type Body = {
  signature?: string
  demande_expresse?: boolean
  renonciation_retractation?: boolean
}

/**
 * POST /api/accords/[id]/valider — validation sur place par signature.
 * Archive la signature, passe l'accord en VALIDE et enregistre les preuves
 * (horodatage, IP, user-agent, consentements).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const accordId = params.id
  if (!accordId) return NextResponse.json({ error: 'ID accord manquant' }, { status: 400 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (body.demande_expresse !== true || body.renonciation_retractation !== true) {
    return NextResponse.json(
      { error: 'Les deux consentements (demande expresse, renonciation) sont requis.' },
      { status: 400 },
    )
  }

  const signature = (body.signature || '').trim()
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(signature)
  if (!m) {
    return NextResponse.json({ error: 'Signature manquante ou format invalide' }, { status: 400 })
  }

  // L'accord doit exister et être encore en brouillon.
  const { data: accord } = await sb
    .from('accords_intervention')
    .select('id, statut')
    .eq('id', accordId)
    .maybeSingle()
  if (!accord) return NextResponse.json({ error: 'Accord introuvable' }, { status: 404 })
  if (accord.statut !== 'BROUILLON') {
    return NextResponse.json(
      { error: `Accord déjà « ${String(accord.statut).toLowerCase()} » — validation impossible.` },
      { status: 409 },
    )
  }

  // Décodage de la signature PNG/JPEG.
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length < 200) {
    return NextResponse.json({ error: 'Signature vide' }, { status: 400 })
  }
  if (buf.length > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Signature trop lourde (max 2 MB)' }, { status: 413 })
  }

  const ext = m[1] === 'jpeg' ? 'jpg' : 'png'
  const path = `${accordId}/signature-${Date.now()}.${ext}`
  const upload = await sb.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: `image/${m[1]}`, upsert: true })
  if (upload.error) {
    return NextResponse.json(
      { error: `Upload de la signature échoué : ${upload.error.message}` },
      { status: 502 },
    )
  }
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)
  const signatureUrl = pub?.publicUrl
  if (!signatureUrl) {
    return NextResponse.json({ error: 'URL de signature introuvable' }, { status: 500 })
  }

  const valideAt = new Date().toISOString()
  const ipClient =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  const userAgent = req.headers.get('user-agent') || null

  const { error } = await sb
    .from('accords_intervention')
    .update({
      statut: 'VALIDE',
      valide_at: valideAt,
      canal_validation: 'SIGNATURE',
      signature_image: signatureUrl,
      demande_expresse: true,
      renonciation_retractation: true,
      ip_client: ipClient,
      user_agent: userAgent,
    })
    .eq('id', accordId)
  if (error) {
    return NextResponse.json({ error: `DB update échouée : ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, valide_at: valideAt, signature_url: signatureUrl })
}
