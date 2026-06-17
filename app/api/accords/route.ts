import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { calculDevis, totalLigne, type LigneDraft } from "@/lib/accord/calcul-devis"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const BUCKET = 'accords-pdfs'

/** Référence lisible d'un accord : ACC-YYYYMMDD-HHMM. */
function buildReference(): string {
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `ACC-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`
}

type LigneInput = {
  tarif_type?: string | null
  label?: string
  prix_unitaire?: number
  unite?: string
  quantite?: number
  urgent?: boolean
}

type AccordInput = {
  local_id?: string | null
  intervention_id?: string | null
  client_id?: string | null
  client_nom?: string
  client_adresse?: string | null
  client_code_postal?: string | null
  client_ville?: string | null
  client_telephone?: string | null
  client_email?: string | null
  frais_deplacement?: number
  taux_tva?: number
  validite_jours?: number
  intervention_urgente?: boolean
  lignes?: LigneInput[]
  // Validation capturée sur le device (cas hors-ligne signé)
  signature?: string | null
  valide_at?: string | null
  demande_expresse?: boolean
  renonciation_retractation?: boolean
  canal_validation?: string | null
}

/**
 * POST /api/accords — crée un accord d'intervention.
 *
 * - Sans `signature` : accord en BROUILLON.
 * - Avec `signature` (+ consentements) : accord créé directement VALIDE
 *   (création + validation en une passe — utilisé par le mode hors-ligne).
 * - `local_id` : clé d'idempotence — un POST rejoué (sync) ne crée pas de doublon.
 *
 * Le serveur recalcule tous les totaux (jamais de confiance dans le client).
 */
export async function POST(req: NextRequest) {
  let body: AccordInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  // --- Idempotence : un accord déjà synchronisé pour ce local_id ? ---
  const localId = (body.local_id || '').trim() || null
  if (localId) {
    const { data: existing } = await sb
      .from('accords_intervention')
      .select('id, reference, statut')
      .eq('local_id', localId)
      .maybeSingle()
    if (existing?.id) {
      return NextResponse.json({
        ok: true,
        id: existing.id,
        reference: existing.reference,
        statut: existing.statut,
        deduped: true,
      })
    }
  }

  const clientNom = (body.client_nom || '').trim()
  if (!clientNom) {
    return NextResponse.json({ error: 'Le nom du client est obligatoire' }, { status: 400 })
  }

  const lignesInput = Array.isArray(body.lignes) ? body.lignes : []
  if (lignesInput.length === 0) {
    return NextResponse.json({ error: 'Au moins une prestation est requise' }, { status: 400 })
  }

  // Normalisation : on regèle proprement chaque ligne côté serveur.
  const lignes: LigneDraft[] = lignesInput.map(l => ({
    tarif_type: l.tarif_type || null,
    label: String(l.label || '').trim() || 'Prestation',
    prix_unitaire: Number(l.prix_unitaire) || 0,
    unite: String(l.unite || 'intervention'),
    quantite: Number(l.quantite) || 0,
    urgent: l.urgent !== false,
  }))

  const fraisDeplacement = Number(body.frais_deplacement) || 0
  const tauxTVA = Number(body.taux_tva) || 0
  const { totalHT, totalTVA, totalTTC } = calculDevis(lignes, fraisDeplacement, tauxTVA)
  const interventionId = body.intervention_id || null

  // Un seul accord par intervention (contrainte unique en base).
  if (interventionId) {
    const { data: existing } = await sb
      .from('accords_intervention')
      .select('id')
      .eq('intervention_id', interventionId)
      .maybeSingle()
    if (existing?.id) {
      return NextResponse.json(
        { error: 'Un accord existe déjà pour cette intervention.' },
        { status: 409 },
      )
    }
  }

  // --- Validation embarquée (signature capturée sur le device) ---
  const signature = (body.signature || '').trim()
  const sigMatch = /^data:image\/(png|jpeg);base64,(.+)$/.exec(signature)
  const reference = buildReference()
  let signatureUrl: string | null = null

  if (sigMatch) {
    if (body.demande_expresse !== true || body.renonciation_retractation !== true) {
      return NextResponse.json(
        { error: 'Une signature requiert les deux consentements (demande expresse, renonciation).' },
        { status: 400 },
      )
    }
    const buf = Buffer.from(sigMatch[2], 'base64')
    if (buf.length < 200) {
      return NextResponse.json({ error: 'Signature vide' }, { status: 400 })
    }
    if (buf.length > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Signature trop lourde (max 2 MB)' }, { status: 413 })
    }
    const ext = sigMatch[1] === 'jpeg' ? 'jpg' : 'png'
    const path = `${localId || reference}/signature-${Date.now()}.${ext}`
    const upload = await sb.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: `image/${sigMatch[1]}`, upsert: true })
    if (upload.error) {
      return NextResponse.json(
        { error: `Upload de la signature échoué : ${upload.error.message}` },
        { status: 502 },
      )
    }
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)
    signatureUrl = pub?.publicUrl || null
  }

  const estValide = !!signatureUrl
  // Horodatage de la signature : heure du device si fournie et valide, sinon maintenant.
  const valideAtDevice = body.valide_at && !Number.isNaN(Date.parse(body.valide_at))
    ? new Date(body.valide_at).toISOString()
    : new Date().toISOString()
  const ipClient =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  const userAgent = req.headers.get('user-agent') || null

  const { data: accord, error } = await sb
    .from('accords_intervention')
    .insert({
      reference,
      local_id: localId,
      synced_at: localId ? new Date().toISOString() : null,
      intervention_id: interventionId,
      client_id: body.client_id || null,
      client_nom: clientNom,
      client_adresse: body.client_adresse?.trim() || null,
      client_code_postal: body.client_code_postal?.trim() || null,
      client_ville: body.client_ville?.trim() || null,
      client_telephone: body.client_telephone?.trim() || null,
      client_email: body.client_email?.trim() || null,
      frais_deplacement: fraisDeplacement,
      total_ht: totalHT,
      taux_tva: tauxTVA,
      total_tva: totalTVA,
      total_ttc: totalTTC,
      validite_jours: Number(body.validite_jours) || 30,
      intervention_urgente: body.intervention_urgente !== false,
      a_travaux_non_urgents: lignes.some(l => !l.urgent),
      statut: estValide ? 'VALIDE' : 'BROUILLON',
      canal_validation: estValide ? (body.canal_validation === 'SMS' ? 'SMS' : 'SIGNATURE') : null,
      signature_image: signatureUrl,
      valide_at: estValide ? valideAtDevice : null,
      demande_expresse: estValide,
      renonciation_retractation: estValide,
      ip_client: estValide ? ipClient : null,
      user_agent: estValide ? userAgent : null,
    })
    .select('id, reference, statut')
    .single()

  if (error || !accord) {
    console.error('[POST /api/accords] insert accord', error)
    return NextResponse.json({ error: error?.message || 'Création impossible' }, { status: 500 })
  }

  const ligneRows = lignes.map((l, i) => ({
    accord_id: accord.id,
    tarif_type: l.tarif_type,
    label: l.label,
    prix_unitaire: l.prix_unitaire,
    unite: l.unite,
    quantite: l.quantite,
    total_ligne: totalLigne(l),
    urgent: l.urgent,
    position: i,
  }))

  const { error: lignesError } = await sb.from('lignes_devis').insert(ligneRows)
  if (lignesError) {
    // Un accord sans lignes est inutilisable : on l'annule pour éviter un orphelin.
    await sb.from('accords_intervention').delete().eq('id', accord.id)
    console.error('[POST /api/accords] insert lignes', lignesError)
    return NextResponse.json({ error: lignesError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    id: accord.id,
    reference: accord.reference,
    statut: accord.statut,
  })
}
