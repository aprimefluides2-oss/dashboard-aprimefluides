import { getSupabaseOrNull, saveDocument, upsertClient } from "@/lib/supabase"
import { mergeFacturePayloadMeta } from "@/lib/facture-relance"

/**
 * Helpers de persistance partagés par /api/notify-* (envoi email + persist) et
 * /api/save-* (persist sans envoi). Source unique de vérité pour la sérialisation
 * d'un document en base.
 */

type Common = {
  clientNom?: string | null
  clientEmail?: string | null
  clientAdresse?: string | null
  clientCP?: string | null
  ville?: string | null
}

export interface PersistFactureInput extends Common {
  facture: any
  agence?: string | null
  numero?: string | null
  totalHT?: number | null
  totalTTC?: number | null
  tvaTaux?: number | null
  echeance?: string | null
  /** true → l'email a été envoyé, false → simple sauvegarde brouillon. */
  emailSent?: boolean
  envoyeAt?: string | null
  interventionId?: string | null
  /** IDs Resend des relances hebdomadaires planifiées */
  relanceIds?: string[]
}

export async function persistFacture(p: PersistFactureInput): Promise<string | null> {
  const clientId = await upsertClient({
    nom: p.clientNom ?? undefined,
    email: p.clientEmail ?? undefined,
    adresse: p.clientAdresse ?? undefined,
    code_postal: p.clientCP ?? undefined,
    ville: p.ville ?? undefined,
  })
  const echeanceClean = (p.echeance || p.facture?.echeance || '').trim()
  const isRegle = /^r[ée]gl[ée]e?$/i.test(echeanceClean)
  return saveDocument({
    type: 'facture',
    numero: p.numero || p.facture?.numero || null,
    agence: p.agence || null,
    date_emission: p.facture?.date_facture || null,
    echeance: echeanceClean || null,
    statut: isRegle ? 'paye' : (p.emailSent ? 'envoye' : 'brouillon'),
    montant_ht: typeof p.totalHT === 'number' ? p.totalHT : null,
    montant_ttc: typeof p.totalTTC === 'number' ? p.totalTTC : null,
    tva_taux: typeof p.tvaTaux === 'number' ? p.tvaTaux : null,
    payload: p.relanceIds?.length
      ? mergeFacturePayloadMeta(p.facture || {}, {
          relance_ids: p.relanceIds,
          relance_planifiees: p.relanceIds.length,
        })
      : p.facture,
    client_id: clientId,
    intervention_id: p.interventionId || null,
    envoye_email: p.emailSent ? (p.clientEmail || null) : null,
    envoye_at: p.emailSent ? (p.envoyeAt || new Date().toISOString()) : null,
  })
}

export interface PersistDevisInput extends Common {
  devis: any
  agence?: string | null
  numero?: string | null
  totalHT?: number | null
  totalTTC?: number | null
  tvaTaux?: number | null
  validiteJours?: number | null
  emailSent?: boolean
  envoyeAt?: string | null
  interventionId?: string | null
}

export async function persistDevis(p: PersistDevisInput): Promise<string | null> {
  const clientId = await upsertClient({
    nom: p.clientNom ?? undefined,
    email: p.clientEmail ?? undefined,
    adresse: p.clientAdresse ?? undefined,
    code_postal: p.clientCP ?? undefined,
    ville: p.ville ?? undefined,
  })
  return saveDocument({
    type: 'devis',
    numero: p.numero || p.devis?.numero || null,
    agence: p.agence || null,
    date_emission: p.devis?.date_devis || null,
    echeance: typeof p.validiteJours === 'number' ? `${p.validiteJours} jours` : null,
    statut: p.emailSent ? 'envoye' : 'brouillon',
    montant_ht: typeof p.totalHT === 'number' ? p.totalHT : null,
    montant_ttc: typeof p.totalTTC === 'number' ? p.totalTTC : null,
    tva_taux: typeof p.tvaTaux === 'number' ? p.tvaTaux : null,
    payload: p.devis,
    client_id: clientId,
    intervention_id: p.interventionId || null,
    envoye_email: p.emailSent ? (p.clientEmail || null) : null,
    envoye_at: p.emailSent ? (p.envoyeAt || new Date().toISOString()) : null,
  })
}

export interface PersistAttestationInput extends Common {
  attestation: any
  agence?: string | null
  numero?: string | null
  variante?: string | null
  dateAttestation?: string | null
  emailSent?: boolean
  envoyeAt?: string | null
}

export async function persistAttestation(p: PersistAttestationInput): Promise<string | null> {
  const clientId = await upsertClient({
    nom: p.clientNom ?? undefined,
    email: p.clientEmail ?? undefined,
    adresse: p.clientAdresse ?? undefined,
    code_postal: p.clientCP ?? undefined,
    ville: p.ville ?? undefined,
  })
  return saveDocument({
    type: 'attestation',
    numero: p.numero || p.attestation?.numero || null,
    agence: p.agence || null,
    date_emission: p.attestation?.date || p.dateAttestation || null,
    statut: p.emailSent ? 'envoye' : 'brouillon',
    payload: { ...(p.attestation || {}), variante: p.variante || p.attestation?.variante || null },
    client_id: clientId,
    envoye_email: p.emailSent ? (p.clientEmail || null) : null,
    envoye_at: p.emailSent ? (p.envoyeAt || new Date().toISOString()) : null,
  })
}

export interface PersistRapportInput extends Common {
  rapport: any
  seo?: any | null
  transcription?: string | null
  typeIntervention?: string | null
  codePostal?: string | null
  dateIntervention?: string | null
  publishedSlug?: string | null
  /** Si fourni → update au lieu d'insert. */
  interventionId?: string | null
}

export type PersistRapportResult =
  | { ok: true; id: string; mode: 'insert' | 'update' }
  | { ok: false; error: string }

/**
 * Insère ou met à jour une intervention avec son rapport_json.
 * Utilisé par /api/save-rapport (sans publish) et potentiellement par d'autres flux.
 * Retry jusqu'à 5 fois en cas de collision sur la reference unique.
 */
export async function persistRapport(p: PersistRapportInput): Promise<PersistRapportResult> {
  const sb = getSupabaseOrNull()
  if (!sb) return { ok: false, error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants côté serveur)' }

  // Postgres `date` exige YYYY-MM-DD strict. Toute autre forme (ex: "5 mai 2026")
  // doit être convertie en null pour ne pas faire échouer l'insert.
  const dateIso = (() => {
    const raw = (p.dateIntervention || '').trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    return null
  })()

  // ─── UPDATE d'une intervention existante (wizard Mode Terrain) ───
  // On ne met à jour QUE les champs liés au rapport. client_id / adresse_chantier
  // / ville / code_postal sont déjà renseignés à la création de l'intervention.
  // Les écraser avec null ici — cas du wizard Mode Terrain qui n'envoie pas les
  // infos client à save-rapport — faisait disparaître le client à l'étape
  // d'envoi (nom/email vides) ET cassait la publication (location vide → rejet
  // Django). On ne touche ces champs que si de nouvelles valeurs sont fournies.
  if (p.interventionId) {
    const update: Record<string, unknown> = {
      rapport_json: p.rapport,
      seo_json: p.seo || null,
      statut: 'terminee',
    }
    if (p.transcription != null) update.transcription = p.transcription
    if (p.typeIntervention) update.type_intervention = p.typeIntervention
    if (dateIso) update.date_realisee = dateIso
    if (p.publishedSlug) update.publie_slug = p.publishedSlug
    if (p.clientAdresse) update.adresse_chantier = p.clientAdresse
    if (p.ville) update.ville = p.ville
    if (p.codePostal) update.code_postal = p.codePostal
    // client_id : uniquement si un client a pu être résolu depuis des infos
    // explicitement fournies — sinon on conserve le lien existant.
    if (p.clientNom && p.clientNom.trim()) {
      const cid = await upsertClient({
        nom: p.clientNom,
        email: p.clientEmail ?? undefined,
        adresse: p.clientAdresse ?? undefined,
        ville: p.ville ?? undefined,
        code_postal: p.codePostal ?? undefined,
      })
      if (cid) update.client_id = cid
    }

    const { error } = await sb.from('interventions').update(update).eq('id', p.interventionId)
    if (error) {
      console.error('[persistRapport:update]', error)
      return { ok: false, error: `Update intervention ${p.interventionId} : ${error.message}` }
    }
    return { ok: true, id: p.interventionId, mode: 'update' }
  }

  // ─── INSERT d'une nouvelle intervention (flux sans intervention liée) ───
  const clientId = await upsertClient({
    nom: p.clientNom ?? undefined,
    email: p.clientEmail ?? undefined,
    adresse: p.clientAdresse ?? undefined,
    ville: p.ville ?? undefined,
    code_postal: p.codePostal ?? undefined,
  })

  const baseRow = {
    client_id: clientId,
    type_intervention: p.typeIntervention || null,
    adresse_chantier: p.clientAdresse || null,
    ville: p.ville || null,
    code_postal: p.codePostal || null,
    date_realisee: dateIso,
    statut: 'terminee',
    transcription: p.transcription || null,
    rapport_json: p.rapport,
    seo_json: p.seo || null,
    publie_slug: p.publishedSlug || null,
  }

  const baseRef: string | null = (p.rapport as any)?.reference || null
  let currentRef: string | null = baseRef
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await sb.from('interventions')
      .insert({ reference: currentRef, ...baseRow })
      .select('id')
      .single()
    if (!error && data?.id) return { ok: true, id: data.id, mode: 'insert' }
    if (error?.code === '23505' && currentRef) {
      const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
      currentRef = `${baseRef}-${suffix}`
      continue
    }
    console.error('[persistRapport:insert]', error)
    return { ok: false, error: error?.message || 'Erreur insertion intervention' }
  }
  return { ok: false, error: 'Référence en collision après 5 tentatives' }
}
