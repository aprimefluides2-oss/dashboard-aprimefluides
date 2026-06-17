import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { buildFactureFromRapport } from "@/lib/rapportToFacture"
import { persistFacture } from "@/lib/persist"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string } }

/**
 * Crée une facture pré-remplie à partir du rapport de l'intervention.
 *
 * Body JSON (tout optionnel — surcharge le résultat de buildFactureFromRapport) :
 *   {
 *     pu_ht?: number          // si défini, force le prix unitaire de la 1ère ligne
 *     mode_reglement?: string // ex: "Carte bancaire", "Espèces"
 *     echeance?: string       // "Réglée", "À réception", "30 jours fin de mois"
 *     tva_taux?: number       // 10 ou 20
 *     observations?: string   // surcharge
 *   }
 *
 * Réponse : { ok: true, factureId: string, payload: <facture complète prête à l'envoi> }
 *           Bump terrain_step à 5 (étape devis optionnel).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: 'ID intervention manquant' }, { status: 400 })
  }

  type LigneInput = {
    designation?: string
    description?: string
    qte?: number
    unite?: string
    pu_ht?: number
    inclus?: boolean
  }

  let body: {
    pu_ht?: number
    mode_reglement?: string
    echeance?: string
    tva_taux?: number
    observations?: string
    recommandation?: string
    /** Si fourni, remplace entièrement les lignes générées depuis le rapport */
    lignes?: LigneInput[]
    /** Surcharge l'objet de la facture */
    objet?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    // Body optionnel — on continue avec les valeurs par défaut
  }

  // Charge intervention + client + technicien
  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, reference, client_id, technicien_id, agence, type_intervention, adresse_chantier, ville, code_postal, date_realisee, date_prevue, rapport_json, terrain_step')
    .eq('id', interventionId)
    .maybeSingle()
  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  if (!interv.rapport_json || Object.keys(interv.rapport_json).length === 0) {
    return NextResponse.json({
      error: 'Aucun rapport pour cette intervention. Dicte le rapport d\'abord.',
    }, { status: 400 })
  }

  let client: { nom: string | null; email: string | null; adresse: string | null; code_postal: string | null; ville: string | null } | null = null
  if (interv.client_id) {
    const { data: c } = await sb
      .from('clients')
      .select('nom, email, adresse, code_postal, ville')
      .eq('id', interv.client_id)
      .maybeSingle()
    client = c || null
  }

  const prefill = buildFactureFromRapport({
    rapport: interv.rapport_json,
    client_nom: client?.nom || null,
    client_email: client?.email || null,
    client_adresse: client?.adresse || null,
    client_code_postal: client?.code_postal || null,
    client_ville: client?.ville || null,
    adresse_chantier: interv.adresse_chantier || null,
    type_intervention: interv.type_intervention || null,
    date_intervention: interv.date_realisee || interv.date_prevue || null,
    reference: interv.reference || null,
  })

  // Surcharges
  const facture = prefill.facture

  // Si l'UI envoie un payload de lignes complet → on remplace.
  // Sinon on garde les lignes générées depuis le rapport.
  if (Array.isArray(body.lignes) && body.lignes.length > 0) {
    facture.lignes = body.lignes
      .map(l => ({
        designation: typeof l?.designation === 'string' ? l.designation.trim() : '',
        description: typeof l?.description === 'string' ? l.description : '',
        qte: Number.isFinite(Number(l?.qte)) ? Number(l.qte) : 1,
        unite: typeof l?.unite === 'string' && l.unite.trim() ? l.unite : 'forfait',
        pu_ht: Number.isFinite(Number(l?.pu_ht)) ? Number(l.pu_ht) : 0,
        inclus: l?.inclus === true,
      }))
      .filter(l => l.designation.length > 0)
  } else if (typeof body.pu_ht === 'number' && Number.isFinite(body.pu_ht) && facture.lignes[0]) {
    // Rétrocompat : ancien comportement avec un pu_ht unique
    facture.lignes[0] = { ...facture.lignes[0], pu_ht: body.pu_ht }
  }

  if (typeof body.mode_reglement === 'string') facture.mode_reglement = body.mode_reglement
  if (typeof body.echeance === 'string' && body.echeance.trim()) facture.echeance = body.echeance.trim()
  if (body.tva_taux === 0 || body.tva_taux === 10 || body.tva_taux === 20) facture.tva_taux = body.tva_taux
  if (typeof body.observations === 'string') facture.observations = body.observations
  if (typeof body.recommandation === 'string') facture.recommandation = body.recommandation
  if (typeof body.objet === 'string' && body.objet.trim()) facture.objet = body.objet.trim()

  // Calcul totaux
  const totalHT = facture.lignes.reduce((sum: number, l) => sum + (l.inclus ? 0 : (Number(l.qte) || 0) * (Number(l.pu_ht) || 0)), 0)
  const totalTTC = totalHT * (1 + (facture.tva_taux ?? 10) / 100)

  // Persist
  const factureId = await persistFacture({
    facture,
    clientNom: prefill.client_nom,
    clientEmail: prefill.client_email,
    clientAdresse: prefill.client_adresse,
    clientCP: prefill.client_cp,
    ville: prefill.client_ville,
    agence: interv.agence,
    numero: facture.numero,
    totalHT,
    totalTTC,
    tvaTaux: facture.tva_taux,
    echeance: facture.echeance,
    interventionId,
    emailSent: false,
  })

  if (!factureId) {
    return NextResponse.json({ error: 'Sauvegarde facture impossible' }, { status: 500 })
  }

  // Bump terrain_step à 5 (devis optionnel) si pas déjà plus loin
  const currentStep = interv.terrain_step ?? 0
  if (currentStep < 5) {
    await sb
      .from('interventions')
      .update({ terrain_step: 5 })
      .eq('id', interventionId)
  }

  return NextResponse.json({
    ok: true,
    factureId,
    facture,
    totalHT,
    totalTTC,
  })
}
