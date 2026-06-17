import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

/**
 * Client Supabase server-side avec la service_role key.
 * NE JAMAIS importer ce fichier dans un composant client.
 * Utilisable uniquement depuis les routes API et Server Components.
 */
export function getSupabase(): SupabaseClient {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non configurée')
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Force `no-store` sur tous les fetch de supabase-js. Sans ça, le Data
      // Cache de Next.js met en cache les lectures PostgREST (postgrest-js
      // passe par le `fetch` instrumenté par Next) et renvoie des données
      // périmées — vérifié : GET /api/interventions/[id]/facture continuait
      // de renvoyer une facture supprimée 2 min plus tôt. L'app est un outil
      // d'admin : les lectures doivent toujours être fraîches.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  })
  return cached
}

/** Renvoie null si Supabase n'est pas configuré (mode dégradé). */
export function getSupabaseOrNull(): SupabaseClient | null {
  if (cached) return cached
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return getSupabase()
}

// =====================================================================
// Types — miroir du schéma SQL (à garder synchronisé manuellement
// ou regénérer avec `supabase gen types typescript`)
// =====================================================================

export type Statut =
  | 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

export type DocumentType = 'facture' | 'devis' | 'attestation' | 'rapport'

export type DocumentStatut =
  | 'brouillon' | 'envoye' | 'paye' | 'annule'
  | 'accepte' | 'refuse' | 'expire'

export interface Client {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Technicien {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  agence: string | null
  actif: boolean
  created_at: string
}

export interface Intervention {
  id: string
  reference: string | null
  client_id: string | null
  technicien_id: string | null
  agence: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_prevue: string | null
  heure_prevue: string | null
  duree_estimee_min: number | null
  date_realisee: string | null
  urgence: boolean
  statut: Statut
  prix_prevu: number | null
  notes_internes: string | null
  transcription: string | null
  rapport_json: any
  seo_json: any
  photos_urls: string[] | null
  pdf_rapport_url: string | null
  publie_slug: string | null
  canal_acquisition: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  intervention_id: string | null
  client_id: string | null
  type: DocumentType
  numero: string | null
  agence: string | null
  date_emission: string
  echeance: string | null
  statut: DocumentStatut
  montant_ht: number | null
  montant_ttc: number | null
  tva_taux: number | null
  payload: any
  pdf_url: string | null
  envoye_email: string | null
  envoye_at: string | null
  created_at: string
  updated_at: string
}

export interface FactureFournisseur {
  id: string
  fournisseur: string
  numero: string | null
  date_facture: string
  montant_ht: number
  tva: number
  montant_ttc: number
  categorie: string | null
  description: string | null
  pdf_url: string | null
  agence: string | null
  created_at: string
}

// ---------------------------------------------------------------------
// Module « Accord d'Intervention » (migration 005)
// ---------------------------------------------------------------------

export type AccordStatut =
  | 'BROUILLON' | 'EN_ATTENTE_SMS' | 'VALIDE' | 'REFUSE' | 'ANNULE'

export type CanalValidation = 'SIGNATURE' | 'SMS'

/** Catalogue des prix — source de vérité unique (règle R2). */
export interface Tarif {
  id: string
  type: string
  label: string
  prix_min: number
  prix_max: number
  unite: string
  actif: boolean
  created_at: string
  updated_at: string
}

/** Ligne de devis : valeurs gelées (recopiées de `tarifs`) au moment de l'accord. */
export interface LigneDevis {
  id: string
  accord_id: string
  tarif_type: string | null
  label: string
  prix_unitaire: number
  unite: string
  quantite: number
  total_ligne: number
  urgent: boolean
  position: number
  created_at: string
}

/** Accord d'intervention signé avant travaux (devis gelé + consentement + preuve). */
export interface AccordIntervention {
  id: string
  reference: string | null
  intervention_id: string | null
  client_id: string | null

  // Client : recopié (gelé) depuis la fiche au moment de l'accord
  client_nom: string
  client_adresse: string | null
  client_ville: string | null
  client_code_postal: string | null
  client_telephone: string | null
  client_email: string | null

  // Devis (TVA non applicable en franchise en base : total_ht = total_ttc)
  frais_deplacement: number
  total_ht: number
  taux_tva: number
  total_tva: number
  total_ttc: number
  devis_gratuit: boolean
  validite_jours: number

  // Caractère urgent / consentement
  intervention_urgente: boolean
  demande_expresse: boolean
  renonciation_retractation: boolean
  a_travaux_non_urgents: boolean

  // Validation
  canal_validation: CanalValidation | null
  signature_image: string | null
  sms_token: string | null
  sms_envoye_at: string | null
  valide_at: string | null
  statut: AccordStatut
  motif_refus: string | null

  // Preuve
  pdf_url: string | null
  ip_client: string | null
  user_agent: string | null

  // Envoi de la copie au client
  copie_envoyee_at: string | null

  // Sync hors-ligne
  local_id: string | null
  synced_at: string | null

  created_at: string
  updated_at: string
}

// =====================================================================
// Helpers — upsert client par nom+email (évite les doublons)
// =====================================================================

/**
 * Sauve (insert) un document (facture/devis/attestation) en DB.
 * Best-effort : log et renvoie null en cas d'erreur, ne throw pas.
 */
export async function saveDocument(input: {
  type: DocumentType
  numero?: string | null
  agence?: string | null
  date_emission?: string | null              // YYYY-MM-DD
  echeance?: string | null
  statut?: DocumentStatut
  montant_ht?: number | null
  montant_ttc?: number | null
  tva_taux?: number | null
  payload: any
  intervention_id?: string | null
  client_id?: string | null
  pdf_url?: string | null
  envoye_email?: string | null
  envoye_at?: string | null
}): Promise<string | null> {
  const sb = getSupabaseOrNull()
  if (!sb) {
    console.warn('[saveDocument] Supabase non configuré — le document ne sera pas persisté')
    return null
  }
  const row = {
    type: input.type,
    numero: input.numero || null,
    agence: input.agence || null,
    date_emission: input.date_emission || new Date().toISOString().slice(0, 10),
    echeance: input.echeance || null,
    statut: input.statut || 'envoye',
    montant_ht: input.montant_ht ?? null,
    montant_ttc: input.montant_ttc ?? null,
    tva_taux: input.tva_taux ?? null,
    payload: input.payload || {},
    intervention_id: input.intervention_id || null,
    client_id: input.client_id || null,
    pdf_url: input.pdf_url || null,
    envoye_email: input.envoye_email || null,
    envoye_at: input.envoye_at || null,
  }

  // Idempotence : si un document du même (type, numero) existe déjà, on UPDATE
  // au lieu d'INSERT — évite les doublons quand l'utilisateur clique "Enregistrer"
  // puis "Envoyer", ou recharge la page entre deux clics.
  if (row.numero) {
    const { data: existing } = await sb
      .from('documents')
      .select('id')
      .eq('type', row.type)
      .eq('numero', row.numero)
      .limit(1)
      .maybeSingle()
    if (existing?.id) {
      const { error } = await sb.from('documents').update(row).eq('id', existing.id)
      if (error) {
        console.error('[saveDocument:update]', error)
        return null
      }
      return existing.id
    }
  }

  const { data, error } = await sb
    .from('documents')
    .insert(row)
    .select('id')
    .single()
  if (error) {
    console.error('[saveDocument:insert]', error)
    return null
  }
  return data?.id || null
}

/**
 * Construit le patch à appliquer sur un client existant : ne réécrit que les
 * champs non-null/non-vides fournis en entrée (préserve l'existant si l'input
 * est vide). Indispensable pour que la saisie d'un email dans la modale
 * intervention finisse bien dans la fiche client — sinon le PDF facture et
 * l'étape envoi du wizard sortent sans nom ni mail.
 */
function buildClientPatch(input: {
  nom?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
}): Record<string, string> {
  const patch: Record<string, string> = {}
  const trim = (v: string | null | undefined) => (v || '').trim()
  if (trim(input.nom)) patch.nom = trim(input.nom)
  if (trim(input.email)) patch.email = trim(input.email)
  if (trim(input.telephone)) patch.telephone = trim(input.telephone)
  if (trim(input.adresse)) patch.adresse = trim(input.adresse)
  if (trim(input.code_postal)) patch.code_postal = trim(input.code_postal)
  if (trim(input.ville)) patch.ville = trim(input.ville)
  return patch
}

export async function upsertClient(input: {
  nom?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
}): Promise<string | null> {
  const sb = getSupabaseOrNull()
  if (!sb) return null
  const nom = (input.nom || '').trim()
  if (!nom) return null

  // Cherche un client existant : par email d'abord (le plus fiable), sinon
  // par nom+ville. Si trouvé, on MERGE les nouvelles données non-vides au lieu
  // de retourner aveuglément l'ancienne fiche.
  let existingId: string | null = null
  if (input.email) {
    const { data: existing } = await sb
      .from('clients')
      .select('id')
      .eq('email', input.email)
      .limit(1)
      .maybeSingle()
    if (existing?.id) existingId = existing.id
  }
  if (!existingId) {
    const { data: existing } = await sb
      .from('clients')
      .select('id')
      .eq('nom', nom)
      .eq('ville', input.ville || '')
      .limit(1)
      .maybeSingle()
    if (existing?.id) existingId = existing.id
  }

  if (existingId) {
    const patch = buildClientPatch(input)
    if (Object.keys(patch).length > 0) {
      const { error } = await sb.from('clients').update(patch).eq('id', existingId)
      if (error) console.error('[upsertClient update]', error)
    }
    return existingId
  }

  const { data, error } = await sb
    .from('clients')
    .insert({
      nom,
      email: input.email || null,
      telephone: input.telephone || null,
      adresse: input.adresse || null,
      code_postal: input.code_postal || null,
      ville: input.ville || null,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[upsertClient]', error)
    return null
  }
  return data?.id || null
}

/**
 * Met à jour les champs non-vides d'un client identifié explicitement par son ID.
 * Utilisé quand l'UI a déjà résolu le client (autocomplete) mais que l'utilisateur
 * a éventuellement modifié des champs (mail, tel, adresse).
 */
export async function patchClient(id: string, input: {
  nom?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
}): Promise<void> {
  const sb = getSupabaseOrNull()
  if (!sb || !id) return
  const patch = buildClientPatch(input)
  if (Object.keys(patch).length === 0) return
  const { error } = await sb.from('clients').update(patch).eq('id', id)
  if (error) console.error('[patchClient]', error)
}
