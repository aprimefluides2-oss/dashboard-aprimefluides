import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
      clients: [],
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const phone = (url.searchParams.get('phone') || '').trim()
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 1000)

  // Recherche dédiée par numéro de téléphone : on normalise (digits-only)
  // côté client ET côté serveur pour matcher quel que soit le format de
  // saisie (06 12 34 56 78 / 0612345678 / +33612345678).
  if (phone) {
    const queryDigits = phone.replace(/\D/g, '')
    if (queryDigits.length < 6) {
      return NextResponse.json({ clients: [] })
    }
    const { data: candidates, error: candErr } = await sb
      .from('clients')
      .select('id, nom, email, telephone, adresse, code_postal, ville')
      .not('telephone', 'is', null)
      .order('nom', { ascending: true })
      .range(0, 999)
    if (candErr) {
      return NextResponse.json({ error: candErr.message, clients: [] }, { status: 500 })
    }
    const sufLen = Math.min(queryDigits.length, 9)
    const querySuf = queryDigits.slice(-sufLen)
    const matches = (candidates || []).filter(c => {
      const stored = (c.telephone || '').replace(/\D/g, '')
      if (stored.length < 6) return false
      if (stored === queryDigits) return true
      if (stored.endsWith(querySuf) && sufLen >= 6) return true
      // Cas où la saisie est plus longue (ex. avec préfixe international)
      if (queryDigits.endsWith(stored.slice(-Math.min(stored.length, 9))) && stored.length >= 6) return true
      return false
    })
    return NextResponse.json({ clients: matches.slice(0, limit) })
  }

  let query = sb
    .from('clients')
    .select('id, nom, email, telephone, adresse, code_postal, ville')
    .order('nom', { ascending: true })
    .range(0, limit - 1)

  if (q) {
    // Recherche dans nom OU email OU ville (insensible à la casse)
    const safe = q.replace(/[%,]/g, ' ')
    query = query.or(`nom.ilike.%${safe}%,email.ilike.%${safe}%,ville.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message, clients: [] }, { status: 500 })
  return NextResponse.json({ clients: data || [] })
}
