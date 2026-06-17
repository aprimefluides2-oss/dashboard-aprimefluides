import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

const SEP = ';'

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = typeof value === 'string' ? value : String(value)
  // Excel friendly : remplace les retours ligne par espace
  s = s.replace(/\r?\n/g, ' ')
  // Quote si nécessaire
  if (s.includes(SEP) || s.includes('"') || s.includes('\n')) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function csvLine(cells: unknown[]): string {
  return cells.map(csvCell).join(SEP)
}

function fmtMontant(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return ''
  return n.toFixed(2).replace('.', ',')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function buildFilename(type: string, from: string | null, to: string | null): string {
  const f = from || ''
  const t = to || ''
  return `ltdb-${type}-${f}_${t}.csv`.replace(/_+\.csv$/, '.csv')
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  if (type !== 'recettes' && type !== 'depenses') {
    return NextResponse.json({ error: 'type doit être "recettes" ou "depenses"' }, { status: 400 })
  }

  const BOM = '﻿'
  let csv = BOM
  let filename = buildFilename(type, from, to)

  if (type === 'recettes') {
    let q = sb
      .from('documents')
      .select('id, numero, date_emission, statut, montant_ht, montant_ttc, tva_taux, agence, client_id')
      .eq('type', 'facture')
      .order('date_emission', { ascending: false })
    if (from) q = q.gte('date_emission', from)
    if (to) q = q.lte('date_emission', to)

    const { data, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = data || []

    // Charge clients
    const clientIds = Array.from(new Set(rows.map(r => r.client_id).filter((v): v is string => !!v)))
    let clientsMap: Record<string, string> = {}
    if (clientIds.length > 0) {
      const { data: cls } = await sb.from('clients').select('id, nom').in('id', clientIds)
      if (cls) clientsMap = Object.fromEntries(cls.map(c => [c.id as string, (c.nom as string) || '']))
    }

    csv += csvLine(['Date', 'N°', 'Client', 'Agence', 'HT', 'TVA', 'TTC', 'Statut']) + '\r\n'
    for (const r of rows) {
      const ht = typeof r.montant_ht === 'number' ? r.montant_ht : 0
      const ttc = typeof r.montant_ttc === 'number' ? r.montant_ttc : 0
      const tva = ttc - ht
      csv += csvLine([
        fmtDate(r.date_emission),
        r.numero || '',
        r.client_id ? (clientsMap[r.client_id] || '') : '',
        r.agence || '',
        fmtMontant(ht),
        fmtMontant(tva),
        fmtMontant(ttc),
        r.statut || '',
      ]) + '\r\n'
    }
  } else {
    let q = sb
      .from('factures_fournisseurs')
      .select('id, fournisseur, numero, date_facture, montant_ht, tva, montant_ttc, categorie, description, agence')
      .order('date_facture', { ascending: false })
    if (from) q = q.gte('date_facture', from)
    if (to) q = q.lte('date_facture', to)

    const { data, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = data || []

    csv += csvLine(['Date', 'Fournisseur', 'N°', 'Catégorie', 'HT', 'TVA', 'TTC', 'Agence', 'Description']) + '\r\n'
    for (const r of rows) {
      csv += csvLine([
        fmtDate(r.date_facture),
        r.fournisseur || '',
        r.numero || '',
        r.categorie || '',
        fmtMontant(r.montant_ht),
        fmtMontant(r.tva),
        fmtMontant(r.montant_ttc),
        r.agence || '',
        r.description || '',
      ]) + '\r\n'
    }
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
