import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
      interventions: [],
      documents: [],
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const search = (url.searchParams.get('q') || '').trim().toLowerCase()
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500)

  // .range() au lieu de .limit() : sur supabase-js + Vercel, la combinaison
  // limit + select à 16 colonnes droppe silencieusement une ligne (bug
  // PostgREST documenté ailleurs dans ce projet). range force une pagination
  // explicite via le header Range et renvoie le bon nombre de lignes.
  const rangeEnd = Math.max(limit - 1, 0)
  const [intRes, docRes] = await Promise.all([
    sb
      .from('interventions')
      .select('id, reference, type_intervention, adresse_chantier, ville, code_postal, date_realisee, date_prevue, statut, agence, publie_slug, created_at, client_id, technicien_id, rapport_json, photos_urls, pdf_rapport_url')
      .order('created_at', { ascending: false })
      .range(0, rangeEnd),
    sb
      .from('documents')
      .select('id, type, numero, agence, date_emission, echeance, statut, montant_ht, montant_ttc, tva_taux, pdf_url, envoye_email, envoye_at, intervention_id, client_id, created_at')
      .order('created_at', { ascending: false })
      .range(0, rangeEnd),
  ])

  if (intRes.error) {
    return NextResponse.json({ error: intRes.error.message, interventions: [], documents: [] }, { status: 500 })
  }
  if (docRes.error) {
    return NextResponse.json({ error: docRes.error.message, interventions: [], documents: [] }, { status: 500 })
  }

  // Filtrage des statuts annulés (côté JS car le neq PostgREST a un bug avec beaucoup de colonnes)
  const rawInterventions = (intRes.data || []).filter(i => i.statut !== 'annulee')
  const rawDocuments = (docRes.data || []).filter(d => d.statut !== 'annule')

  // Charge clients référencés
  const clientIds = new Set<string>()
  rawInterventions.forEach(i => i.client_id && clientIds.add(i.client_id))
  rawDocuments.forEach(d => d.client_id && clientIds.add(d.client_id))

  let clients: Record<string, {
    id: string; nom: string; email: string | null;
    adresse: string | null; code_postal: string | null; ville: string | null
  }> = {}
  if (clientIds.size > 0) {
    const { data: clientsData } = await sb
      .from('clients')
      .select('id, nom, email, adresse, code_postal, ville')
      .in('id', Array.from(clientIds))
    if (clientsData) {
      clients = Object.fromEntries(clientsData.map(c => [c.id, c]))
    }
  }

  // Charge techniciens référencés
  const techIds = new Set<string>()
  rawInterventions.forEach(i => i.technicien_id && techIds.add(i.technicien_id))
  let techniciens: Record<string, { id: string; nom: string; agence: string | null }> = {}
  if (techIds.size > 0) {
    const { data: techData } = await sb
      .from('techniciens')
      .select('id, nom, agence')
      .in('id', Array.from(techIds))
    if (techData) {
      techniciens = Object.fromEntries(techData.map(t => [t.id, t]))
    }
  }

  // Décoration
  const decoratedInterventions = rawInterventions.map(i => {
    const c = i.client_id ? clients[i.client_id] : null
    const t = i.technicien_id ? techniciens[i.technicien_id] : null
    return {
      ...i,
      client_nom: c?.nom || null,
      client_email: c?.email || null,
      client_adresse: c?.adresse || null,
      client_code_postal: c?.code_postal || null,
      client_ville: c?.ville || null,
      technicien_nom: t?.nom || null,
      has_rapport: !!(i.rapport_json && Object.keys(i.rapport_json || {}).length > 0),
    }
  })
  const decoratedDocuments = rawDocuments.map(d => {
    const c = d.client_id ? clients[d.client_id] : null
    return {
      ...d,
      client_nom: c?.nom || null,
      client_email: c?.email || null,
      client_adresse: c?.adresse || null,
      client_code_postal: c?.code_postal || null,
      client_ville: c?.ville || null,
    }
  })

  // Filtrage côté serveur (recherche)
  const filterByQ = <T extends Record<string, any>>(rows: T[]) => {
    if (!search) return rows
    return rows.filter(r => {
      const blob = [
        r.reference, r.numero, r.client_nom, r.client_email,
        r.ville, r.client_ville, r.type_intervention, r.agence, r.publie_slug,
      ].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(search)
    })
  }

  return NextResponse.json({
    interventions: filterByQ(decoratedInterventions),
    documents: filterByQ(decoratedDocuments),
  })
}
