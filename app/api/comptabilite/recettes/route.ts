import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

export type RecetteRow = {
  id: string
  numero: string | null
  date_emission: string
  statut: string
  montant_ht: number | null
  montant_ttc: number | null
  tva_taux: number | null
  agence: string | null
  client_id: string | null
  client_nom: string | null
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
      recettes: [],
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const agence = url.searchParams.get('agence')
  const statut = url.searchParams.get('statut')

  let q = sb
    .from('documents')
    .select('id, numero, date_emission, statut, montant_ht, montant_ttc, tva_taux, agence, client_id')
    .eq('type', 'facture')
    .order('date_emission', { ascending: false })

  if (from) q = q.gte('date_emission', from)
  if (to) q = q.lte('date_emission', to)
  if (agence) q = q.eq('agence', agence)
  if (statut) q = q.eq('statut', statut)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: error.message, recettes: [] }, { status: 500 })
  }

  const rows = data || []
  const clientIds = Array.from(new Set(rows.map(r => r.client_id).filter((v): v is string => !!v)))
  let clientsMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: cls } = await sb.from('clients').select('id, nom').in('id', clientIds)
    if (cls) clientsMap = Object.fromEntries(cls.map(c => [c.id as string, (c.nom as string) || '']))
  }

  const recettes: RecetteRow[] = rows.map(r => ({
    id: r.id as string,
    numero: (r.numero as string | null) ?? null,
    date_emission: r.date_emission as string,
    statut: (r.statut as string) || '',
    montant_ht: (r.montant_ht as number | null) ?? null,
    montant_ttc: (r.montant_ttc as number | null) ?? null,
    tva_taux: (r.tva_taux as number | null) ?? null,
    agence: (r.agence as string | null) ?? null,
    client_id: (r.client_id as string | null) ?? null,
    client_nom: r.client_id ? (clientsMap[r.client_id as string] || null) : null,
  }))

  return NextResponse.json({ recettes })
}
