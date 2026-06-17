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

export async function PUT(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  const id = ctx.params.id
  if (!id) {
    return NextResponse.json({ error: 'id manquant' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof body.fournisseur === 'string') {
    const v = body.fournisseur.trim()
    if (!v) return NextResponse.json({ error: 'fournisseur requis' }, { status: 400 })
    update.fournisseur = v
  }
  if (typeof body.numero === 'string') update.numero = body.numero.trim() || null
  if (typeof body.date_facture === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date_facture)) {
      return NextResponse.json({ error: 'date_facture invalide (YYYY-MM-DD)' }, { status: 400 })
    }
    update.date_facture = body.date_facture
  }
  if (body.montant_ht !== undefined) update.montant_ht = toNum(body.montant_ht, 0)
  if (body.tva !== undefined) update.tva = toNum(body.tva, 0)
  if (body.montant_ttc !== undefined) update.montant_ttc = toNum(body.montant_ttc, 0)
  if (body.categorie !== undefined) {
    update.categorie = isCategorieValide(body.categorie) ? body.categorie : null
  }
  if (typeof body.description === 'string') update.description = body.description.trim() || null
  if (typeof body.pdf_url === 'string') update.pdf_url = body.pdf_url.trim() || null
  if (typeof body.agence === 'string') update.agence = body.agence.trim() || null

  const { data, error } = await sb
    .from('factures_fournisseurs')
    .update(update)
    .eq('id', id)
    .select('id, fournisseur, numero, date_facture, montant_ht, tva, montant_ttc, categorie, description, pdf_url, agence, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ facture: data as FactureFournisseur })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  const id = ctx.params.id
  if (!id) {
    return NextResponse.json({ error: 'id manquant' }, { status: 400 })
  }

  const { error } = await sb
    .from('factures_fournisseurs')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
