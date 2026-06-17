import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { CANAUX_ACQUISITION } from "@/lib/canaux"

export const dynamic = 'force-dynamic'

/**
 * Agrégation des interventions par canal d'acquisition.
 * Filtres acceptés en query string :
 *   - from / to (YYYY-MM-DD) : date_prevue dans cette plage (ou date_realisee fallback)
 *   - ville
 *   - departement (préfixe code postal sur 2 chiffres : "83", "13"…)
 *   - canal
 *
 * Renvoie :
 *   - total_interventions, total_ca_ttc (depuis les factures liées)
 *   - par_canal[] : { canal, label, count, ca_ttc, pct }
 *   - par_ville[] : top 10 villes
 *   - par_departement[] : agrégat par préfixe CP (2 premiers chiffres)
 *   - par_mois[] : 12 derniers mois (count)
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from') || ''
  const to = url.searchParams.get('to') || ''
  const villeFilter = (url.searchParams.get('ville') || '').trim().toLowerCase()
  const departementFilter = (url.searchParams.get('departement') || '').trim()
  const canalFilter = (url.searchParams.get('canal') || '').trim()

  // 1) Charge les interventions filtrées (limite raisonnable : 5000 — pour stats)
  let query = sb
    .from('interventions')
    .select('id, ville, code_postal, date_prevue, date_realisee, canal_acquisition, prix_prevu, statut')
    .range(0, 4999)

  if (from) query = query.gte('date_prevue', from)
  if (to) query = query.lte('date_prevue', to)
  if (canalFilter) query = query.eq('canal_acquisition', canalFilter)

  const { data: interventions, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filtres ville/département (côté JS car insensible à la casse + préfixe)
  const filtered = (interventions || []).filter(i => {
    if (villeFilter && (i.ville || '').toLowerCase() !== villeFilter) return false
    if (departementFilter && !(i.code_postal || '').startsWith(departementFilter)) return false
    return true
  })

  const interventionIds = filtered.map(i => i.id)

  // 2) Charge le CA TTC depuis les factures liées (pas les devis ni les attestations)
  let caByIntervention: Record<string, number> = {}
  if (interventionIds.length > 0) {
    const { data: docs } = await sb
      .from('documents')
      .select('intervention_id, montant_ttc')
      .eq('type', 'facture')
      .neq('statut', 'annule')
      .in('intervention_id', interventionIds)
    ;(docs || []).forEach(d => {
      if (!d.intervention_id) return
      caByIntervention[d.intervention_id] =
        (caByIntervention[d.intervention_id] || 0) + (Number(d.montant_ttc) || 0)
    })
  }

  // Agrégation par canal
  const canalAgg: Record<string, { count: number; ca: number }> = {}
  // (pré-initialisation pour avoir tous les canaux dans le résultat même à 0)
  CANAUX_ACQUISITION.forEach(c => { canalAgg[c.key] = { count: 0, ca: 0 } })
  canalAgg['__none__'] = { count: 0, ca: 0 }

  filtered.forEach(i => {
    const key = i.canal_acquisition || '__none__'
    if (!canalAgg[key]) canalAgg[key] = { count: 0, ca: 0 }
    canalAgg[key].count += 1
    canalAgg[key].ca += caByIntervention[i.id] || 0
  })

  const total = filtered.length || 1 // évite div by 0 dans les pourcentages
  const par_canal = [
    ...CANAUX_ACQUISITION.map(c => ({
      canal: c.key,
      label: c.label,
      icon: c.icon,
      count: canalAgg[c.key].count,
      ca_ttc: canalAgg[c.key].ca,
      pct: filtered.length > 0 ? (canalAgg[c.key].count / total) * 100 : 0,
    })),
    {
      canal: '__none__',
      label: 'Non précisé',
      icon: '❔',
      count: canalAgg['__none__'].count,
      ca_ttc: canalAgg['__none__'].ca,
      pct: filtered.length > 0 ? (canalAgg['__none__'].count / total) * 100 : 0,
    },
  ].sort((a, b) => b.count - a.count)

  // Agrégation par ville
  const villeMap: Record<string, { count: number; ca: number; cp: string }> = {}
  filtered.forEach(i => {
    const v = i.ville || '— Inconnu —'
    if (!villeMap[v]) villeMap[v] = { count: 0, ca: 0, cp: i.code_postal || '' }
    villeMap[v].count += 1
    villeMap[v].ca += caByIntervention[i.id] || 0
  })
  const par_ville = Object.entries(villeMap)
    .map(([ville, v]) => ({ ville, code_postal: v.cp, count: v.count, ca_ttc: v.ca }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // Agrégation par département (préfixe CP 2 chiffres)
  const depMap: Record<string, { count: number; ca: number }> = {}
  filtered.forEach(i => {
    const dep = (i.code_postal || '').slice(0, 2) || '—'
    if (!depMap[dep]) depMap[dep] = { count: 0, ca: 0 }
    depMap[dep].count += 1
    depMap[dep].ca += caByIntervention[i.id] || 0
  })
  const par_departement = Object.entries(depMap)
    .map(([departement, v]) => ({ departement, count: v.count, ca_ttc: v.ca }))
    .sort((a, b) => b.count - a.count)

  // Agrégation par mois (12 derniers mois)
  const moisMap: Record<string, number> = {}
  filtered.forEach(i => {
    const d = i.date_prevue || i.date_realisee || ''
    const m = /^(\d{4}-\d{2})/.exec(d)
    if (!m) return
    moisMap[m[1]] = (moisMap[m[1]] || 0) + 1
  })
  const par_mois = Object.entries(moisMap)
    .map(([mois, count]) => ({ mois, count }))
    .sort((a, b) => a.mois.localeCompare(b.mois))

  const total_ca_ttc = Object.values(caByIntervention).reduce((s, v) => s + v, 0)

  return NextResponse.json({
    total_interventions: filtered.length,
    total_ca_ttc,
    par_canal,
    par_ville,
    par_departement,
    par_mois,
    filtres: { from, to, ville: villeFilter, departement: departementFilter, canal: canalFilter },
  })
}
