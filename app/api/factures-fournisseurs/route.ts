import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull, type FactureFournisseur } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

const CATEGORIES_VALIDES = [
  'carburant', 'materiel', 'sous_traitance', 'assurance',
  'telecom', 'locaux', 'autre',
] as const

type Categorie = typeof CATEGORIES_VALIDES[number]

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function isCategorieValide(v: unknown): v is Categorie {
  return typeof v === 'string' && (CATEGORIES_VALIDES as readonly string[]).includes(v)
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
      factures: [],
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const categorie = url.searchParams.get('categorie')
  const agence = url.searchParams.get('agence')

  let q = sb
    .from('factures_fournisseurs')
    .select('id, fournisseur, numero, date_facture, montant_ht, tva, montant_ttc, categorie, description, pdf_url, agence, created_at')
    .order('date_facture', { ascending: false })

  if (from) q = q.gte('date_facture', from)
  if (to) q = q.lte('date_facture', to)
  if (categorie) q = q.eq('categorie', categorie)
  if (agence) q = q.eq('agence', agence)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: error.message, factures: [] }, { status: 500 })
  }

  return NextResponse.json({ factures: (data || []) as FactureFournisseur[] })
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const fournisseur = typeof body.fournisseur === 'string' ? body.fournisseur.trim() : ''
  const date_facture = typeof body.date_facture === 'string' ? body.date_facture.trim() : ''
  if (!fournisseur) {
    return NextResponse.json({ error: 'Le champ "fournisseur" est requis.' }, { status: 400 })
  }
  if (!date_facture || !/^\d{4}-\d{2}-\d{2}$/.test(date_facture)) {
    return NextResponse.json({ error: 'Le champ "date_facture" est requis (format YYYY-MM-DD).' }, { status: 400 })
  }

  const montant_ht = toNum(body.montant_ht, 0)
  const tva = toNum(body.tva, 0)
  let montant_ttc = toNum(body.montant_ttc, 0)
  if (!montant_ttc) montant_ttc = montant_ht + tva

  const categorie = isCategorieValide(body.categorie) ? body.categorie : null

  const insertPayload = {
    fournisseur,
    numero: typeof body.numero === 'string' && body.numero.trim() ? body.numero.trim() : null,
    date_facture,
    montant_ht,
    tva,
    montant_ttc,
    categorie,
    description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
    pdf_url: typeof body.pdf_url === 'string' && body.pdf_url.trim() ? body.pdf_url.trim() : null,
    agence: typeof body.agence === 'string' && body.agence.trim() ? body.agence.trim() : null,
  }

  const { data, error } = await sb
    .from('factures_fournisseurs')
    .insert(insertPayload)
    .select('id, fournisseur, numero, date_facture, montant_ht, tva, montant_ttc, categorie, description, pdf_url, agence, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ facture: data as FactureFournisseur })
}
