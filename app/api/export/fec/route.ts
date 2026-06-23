import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

const TAB = '\t'
const EOL = '\r\n'

const FEC_HEADERS = [
  'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
  'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
  'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
  'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
] as const

const COMPTES_CHARGES: Record<string, { num: string; lib: string }> = {
  carburant:      { num: '60611', lib: 'Carburants' },
  materiel:       { num: '60630', lib: 'Petit matériel' },
  sous_traitance: { num: '6041',  lib: 'Sous-traitance' },
  assurance:      { num: '6160',  lib: 'Assurances' },
  telecom:        { num: '6260',  lib: 'Télécommunications' },
  locaux:         { num: '6132',  lib: 'Locations immobilières' },
  autre:          { num: '6068',  lib: 'Autres charges' },
}

function fmtMontant(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return v.toFixed(2).replace('.', ',')
}

function fmtDateYYYYMMDD(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[1]}${m[2]}${m[3]}` : ''
}

function safe(s: string | null | undefined): string {
  if (!s) return ''
  // Norme FEC : pas de tab ni de retour ligne dans les valeurs
  return s.replace(/[\t\r\n]+/g, ' ').trim()
}

function fecLine(cells: (string | number)[]): string {
  return cells.map(c => typeof c === 'number' ? String(c) : c).join(TAB)
}

function compAuxNum(id: string | null | undefined): string {
  if (!id) return ''
  // Tronque l'UUID pour fournir un code aux numérique-alphanum court
  return id.replace(/-/g, '').slice(0, 12).toUpperCase()
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from') || ''
  const to = url.searchParams.get('to') || ''

  // Charge factures clients
  let qVentes = sb
    .from('documents')
    .select('id, numero, date_emission, statut, montant_ht, montant_ttc, tva_taux, agence, client_id')
    .eq('type', 'facture')
    .order('date_emission', { ascending: true })
  if (from) qVentes = qVentes.gte('date_emission', from)
  if (to) qVentes = qVentes.lte('date_emission', to)

  // Charge factures fournisseurs
  let qAchats = sb
    .from('factures_fournisseurs')
    .select('id, fournisseur, numero, date_facture, montant_ht, tva, montant_ttc, categorie, agence')
    .order('date_facture', { ascending: true })
  if (from) qAchats = qAchats.gte('date_facture', from)
  if (to) qAchats = qAchats.lte('date_facture', to)

  const [ventesRes, achatsRes] = await Promise.all([qVentes, qAchats])
  if (ventesRes.error) {
    return NextResponse.json({ error: ventesRes.error.message }, { status: 500 })
  }
  if (achatsRes.error) {
    return NextResponse.json({ error: achatsRes.error.message }, { status: 500 })
  }

  const ventes = ventesRes.data || []
  const achats = achatsRes.data || []

  // Charge noms clients
  const clientIds = Array.from(new Set(ventes.map(v => v.client_id).filter((x): x is string => !!x)))
  let clientsMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: cls } = await sb.from('clients').select('id, nom').in('id', clientIds)
    if (cls) clientsMap = Object.fromEntries(cls.map(c => [c.id as string, (c.nom as string) || '']))
  }

  // Construit le FEC
  let body = FEC_HEADERS.join(TAB) + EOL

  // Journal des ventes
  let numVE = 0
  for (const v of ventes) {
    numVE += 1
    const ht = typeof v.montant_ht === 'number' ? v.montant_ht : 0
    const ttc = typeof v.montant_ttc === 'number' ? v.montant_ttc : 0
    const tva = Math.max(0, ttc - ht)
    const dateY = fmtDateYYYYMMDD(v.date_emission)
    const clientNom = v.client_id ? (clientsMap[v.client_id] || '') : ''
    const lib = safe(`Facture ${clientNom} ${v.numero || ''}`.trim())
    const pieceRef = safe(v.numero || v.id)
    const auxNum = compAuxNum(v.client_id)
    const auxLib = safe(clientNom)

    // Ligne 1 : Débit 411 (TTC)
    body += fecLine([
      'VE', 'Journal des ventes', numVE, dateY,
      '411', 'Clients', auxNum, auxLib,
      pieceRef, dateY, lib, fmtMontant(ttc), fmtMontant(0),
      '', '', '', fmtMontant(0), '',
    ]) + EOL

    // Ligne 2 : Crédit 706 (HT)
    body += fecLine([
      'VE', 'Journal des ventes', numVE, dateY,
      '706', 'Prestations de services', '', '',
      pieceRef, dateY, lib, fmtMontant(0), fmtMontant(ht),
      '', '', '', fmtMontant(0), '',
    ]) + EOL

    // Ligne 3 : Crédit 44571 (TVA collectée) — uniquement si TVA > 0
    if (tva > 0) {
      body += fecLine([
        'VE', 'Journal des ventes', numVE, dateY,
        '44571', 'TVA collectée', '', '',
        pieceRef, dateY, lib, fmtMontant(0), fmtMontant(tva),
        '', '', '', fmtMontant(0), '',
      ]) + EOL
    }
  }

  // Journal des achats
  let numAC = 0
  for (const a of achats) {
    numAC += 1
    const ht = typeof a.montant_ht === 'number' ? a.montant_ht : 0
    const tva = typeof a.tva === 'number' ? a.tva : 0
    const ttc = typeof a.montant_ttc === 'number' ? a.montant_ttc : (ht + tva)
    const dateY = fmtDateYYYYMMDD(a.date_facture)
    const cat = (a.categorie as string | null) || 'autre'
    const compte = COMPTES_CHARGES[cat] || COMPTES_CHARGES.autre
    const lib = safe(`Facture ${a.fournisseur || ''} ${a.numero || ''}`.trim())
    const pieceRef = safe(a.numero || a.id)
    const auxNum = compAuxNum(a.id)
    const auxLib = safe(a.fournisseur || '')

    // Ligne 1 : Débit 6XX (HT)
    body += fecLine([
      'AC', 'Journal des achats', numAC, dateY,
      compte.num, compte.lib, '', '',
      pieceRef, dateY, lib, fmtMontant(ht), fmtMontant(0),
      '', '', '', fmtMontant(0), '',
    ]) + EOL

    // Ligne 2 : Débit 44566 (TVA déductible) — uniquement si TVA > 0
    if (tva > 0) {
      body += fecLine([
        'AC', 'Journal des achats', numAC, dateY,
        '44566', 'TVA déductible', '', '',
        pieceRef, dateY, lib, fmtMontant(tva), fmtMontant(0),
        '', '', '', fmtMontant(0), '',
      ]) + EOL
    }

    // Ligne 3 : Crédit 401 (TTC)
    body += fecLine([
      'AC', 'Journal des achats', numAC, dateY,
      '401', 'Fournisseurs', auxNum, auxLib,
      pieceRef, dateY, lib, fmtMontant(0), fmtMontant(ttc),
      '', '', '', fmtMontant(0), '',
    ]) + EOL
  }

  // Nom du fichier
  const SIREN = process.env.APRIME_SIREN || ''
  const dateFin = (to || from || new Date().toISOString().slice(0, 10)).replace(/-/g, '')
  const filename = `${SIREN}FEC${dateFin}.txt`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
