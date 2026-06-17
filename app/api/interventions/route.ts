import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull, upsertClient, patchClient } from "@/lib/supabase"
import { isCanalAcquisition } from "@/lib/canaux"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type ClientInput = {
  id?: string | null
  nom?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
}

type CreateInterventionBody = {
  client?: ClientInput
  technicien_id?: string | null
  agence?: string | null
  type_intervention?: string | null
  adresse_chantier?: string | null
  ville?: string | null
  code_postal?: string | null
  date_prevue?: string | null
  heure_prevue?: string | null
  duree_estimee_min?: number | null
  urgence?: boolean
  prix_prevu?: number | null
  notes_internes?: string | null
  canal_acquisition?: string | null
}

function buildReference(date_prevue?: string | null, heure_prevue?: string | null): string {
  const now = new Date()
  let datePart: string
  let timePart: string

  if (date_prevue && /^\d{4}-\d{2}-\d{2}$/.test(date_prevue)) {
    datePart = date_prevue.replace(/-/g, '')
  } else {
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    datePart = `${yyyy}${mm}${dd}`
  }

  if (heure_prevue && /^\d{2}:\d{2}/.test(heure_prevue)) {
    timePart = heure_prevue.slice(0, 5).replace(':', '')
  } else {
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    timePart = `${hh}${mi}`
  }

  return `LTDB-${datePart}-${timePart}`
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
      interventions: [],
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const statut = url.searchParams.get('statut')
  const technicien_id = url.searchParams.get('technicien_id')
  const agence = url.searchParams.get('agence')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500)

  let query = sb
    .from('interventions')
    .select('id, reference, client_id, technicien_id, agence, type_intervention, adresse_chantier, ville, code_postal, date_prevue, heure_prevue, duree_estimee_min, date_realisee, urgence, statut, prix_prevu, notes_internes, publie_slug, canal_acquisition, created_at, updated_at')
    .order('date_prevue', { ascending: true, nullsFirst: false })
    .order('heure_prevue', { ascending: true, nullsFirst: false })
    // range() au lieu de limit() : limit + order drop la ligne la plus
    // récente sur supabase-js (bug documenté, cf. /api/historique).
    .range(0, limit - 1)

  if (statut) query = query.eq('statut', statut)
  if (technicien_id) query = query.eq('technicien_id', technicien_id)
  if (agence) query = query.eq('agence', agence)
  if (from) query = query.gte('date_prevue', from)
  if (to) query = query.lte('date_prevue', to)

  const { data: interventions, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message, interventions: [] }, { status: 500 })
  }

  const clientIds = new Set<string>()
  const techIds = new Set<string>()
  ;(interventions || []).forEach(i => {
    if (i.client_id) clientIds.add(i.client_id)
    if (i.technicien_id) techIds.add(i.technicien_id)
  })

  const [clientsRes, techsRes] = await Promise.all([
    clientIds.size > 0
      ? sb.from('clients').select('id, nom, email, telephone').in('id', Array.from(clientIds))
      : Promise.resolve({ data: [], error: null } as const),
    techIds.size > 0
      ? sb.from('techniciens').select('id, nom, email').in('id', Array.from(techIds))
      : Promise.resolve({ data: [], error: null } as const),
  ])

  const clientsMap: Record<string, { nom: string; email: string | null; telephone: string | null }> = {}
  ;(clientsRes.data || []).forEach((c: { id: string; nom: string; email: string | null; telephone: string | null }) => {
    clientsMap[c.id] = { nom: c.nom, email: c.email, telephone: c.telephone }
  })
  const techsMap: Record<string, { nom: string; email: string | null }> = {}
  ;(techsRes.data || []).forEach((t: { id: string; nom: string; email: string | null }) => {
    techsMap[t.id] = { nom: t.nom, email: t.email }
  })

  const decorated = (interventions || []).map(i => ({
    ...i,
    client_nom: i.client_id ? clientsMap[i.client_id]?.nom ?? null : null,
    client_email: i.client_id ? clientsMap[i.client_id]?.email ?? null : null,
    client_telephone: i.client_id ? clientsMap[i.client_id]?.telephone ?? null : null,
    technicien_nom: i.technicien_id ? techsMap[i.technicien_id]?.nom ?? null : null,
    technicien_email: i.technicien_id ? techsMap[i.technicien_id]?.email ?? null : null,
  }))

  return NextResponse.json({ interventions: decorated })
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  let body: CreateInterventionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body.type_intervention) {
    return NextResponse.json({ error: 'type_intervention requis' }, { status: 400 })
  }

  // 1. Resolve client — IMPÉRATIF : pas de création d'intervention sans client.
  // Sans ce verrou, une UI buggée (cache PWA stale, validation contournée) crée
  // des interventions orphelines qui s'affichent "Client inconnu · —" et bloquent
  // le wizard d'envoi.
  let clientId: string | null = null
  if (body.client?.id) {
    clientId = body.client.id
    // Si l'UI a déjà résolu le client (autocomplete) ET que l'utilisateur a
    // saisi/modifié des champs dans la modale, on les applique sur la fiche
    // existante (merge non destructif via patchClient).
    await patchClient(clientId, {
      nom: body.client.nom ?? null,
      email: body.client.email ?? null,
      telephone: body.client.telephone ?? null,
      adresse: body.client.adresse ?? null,
      code_postal: body.client.code_postal ?? null,
      ville: body.client.ville ?? null,
    })
  } else if (body.client?.nom && body.client.nom.trim()) {
    clientId = await upsertClient({
      nom: body.client.nom,
      email: body.client.email ?? null,
      telephone: body.client.telephone ?? null,
      adresse: body.client.adresse ?? null,
      code_postal: body.client.code_postal ?? null,
      ville: body.client.ville ?? null,
    })
    if (!clientId) {
      return NextResponse.json({ error: 'Création du client impossible' }, { status: 500 })
    }
  } else {
    return NextResponse.json(
      { error: 'Nom du client requis (envoyez body.client.nom ou body.client.id).' },
      { status: 400 },
    )
  }

  // 2. Reference (avec retry sur collision unique)
  const baseReference = buildReference(body.date_prevue, body.heure_prevue)

  // 3. Default chantier address from client if not provided
  const adresseChantier = body.adresse_chantier ?? body.client?.adresse ?? null
  const ville = body.ville ?? body.client?.ville ?? null
  const codePostal = body.code_postal ?? body.client?.code_postal ?? null

  const heurePrevueClean = body.heure_prevue && /^\d{2}:\d{2}/.test(body.heure_prevue)
    ? body.heure_prevue.slice(0, 5)
    : null

  const canalClean = isCanalAcquisition(body.canal_acquisition) ? body.canal_acquisition : null

  const baseRow = {
    client_id: clientId,
    technicien_id: body.technicien_id || null,
    agence: body.agence || null,
    type_intervention: body.type_intervention,
    adresse_chantier: adresseChantier,
    ville,
    code_postal: codePostal,
    date_prevue: body.date_prevue || null,
    heure_prevue: heurePrevueClean,
    duree_estimee_min: typeof body.duree_estimee_min === 'number' ? body.duree_estimee_min : null,
    urgence: !!body.urgence,
    statut: 'planifiee',
    prix_prevu: typeof body.prix_prevu === 'number' ? body.prix_prevu : null,
    notes_internes: body.notes_internes || null,
    canal_acquisition: canalClean,
  }

  let inserted: any = null
  let insertErr: any = null
  let currentRef = baseReference
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await sb
      .from('interventions')
      .insert({ reference: currentRef, ...baseRow })
      .select('*')
      .single()
    if (!res.error && res.data) {
      inserted = res.data
      insertErr = null
      break
    }
    insertErr = res.error
    if (res.error?.code === '23505') {
      const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
      currentRef = `${baseReference}-${suffix}`
      continue
    }
    break
  }

  if (insertErr || !inserted) {
    return NextResponse.json({ error: insertErr?.message || 'Insertion échouée' }, { status: 500 })
  }

  // 4. Fire & forget tech notification
  if (inserted.technicien_id) {
    notifyTechBestEffort(req, inserted.id, inserted.technicien_id).catch(e => {
      console.error('[interventions.POST notify]', e)
    })
  }

  return NextResponse.json({ intervention: inserted }, { status: 201 })
}

async function notifyTechBestEffort(req: NextRequest, interventionId: string, technicienId: string) {
  const sb = getSupabaseOrNull()
  if (!sb) return

  const { data: tech } = await sb
    .from('techniciens')
    .select('id, nom, email')
    .eq('id', technicienId)
    .maybeSingle()

  if (!tech?.email) return

  const { data: i } = await sb
    .from('interventions')
    .select('*')
    .eq('id', interventionId)
    .maybeSingle()

  if (!i) return

  let clientNom: string | null = null
  let clientTel: string | null = null
  let clientEmail: string | null = null
  if (i.client_id) {
    const { data: c } = await sb
      .from('clients')
      .select('nom, email, telephone')
      .eq('id', i.client_id)
      .maybeSingle()
    clientNom = c?.nom ?? null
    clientTel = c?.telephone ?? null
    clientEmail = c?.email ?? null
  }

  const origin = new URL(req.url).origin
  await fetch(`${origin}/api/notify-technicien`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Appel interne serveur→serveur : pas de cookie de session, le
      // middleware d'auth l'autorise via ce header secret partagé.
      'x-internal-auth': process.env.NEXTAUTH_SECRET || '',
    },
    body: JSON.stringify({
      intervention_id: interventionId,
      technicien_email: tech.email,
      technicien_nom: tech.nom,
      client_nom: clientNom,
      client_telephone: clientTel,
      client_email: clientEmail,
      adresse_chantier: i.adresse_chantier,
      ville: i.ville,
      code_postal: i.code_postal,
      date_prevue: i.date_prevue,
      heure_prevue: i.heure_prevue,
      type_intervention: i.type_intervention,
      urgence: i.urgence,
      prix_prevu: i.prix_prevu,
      notes_internes: i.notes_internes,
    }),
  }).catch(e => console.error('[notifyTechBestEffort fetch]', e))
}
