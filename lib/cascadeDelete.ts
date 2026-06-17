import { getSupabaseOrNull } from "@/lib/supabase"

const PDFS_BUCKET = process.env.SUPABASE_PDFS_BUCKET || 'intervention-pdfs'
const PHOTOS_BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'interventions-photos'

export type CascadeDeleteResult = {
  ok: boolean
  intervention_id: string
  deleted_documents: number
  deleted_photos: number
  deleted_pdfs: number
  warnings: string[]
}

async function emptyFolder(
  sb: NonNullable<ReturnType<typeof getSupabaseOrNull>>,
  bucket: string,
  folder: string,
): Promise<{ count: number; warning?: string }> {
  const { data: files, error: listErr } = await sb.storage.from(bucket).list(folder, { limit: 1000 })
  if (listErr) return { count: 0, warning: `list ${bucket}/${folder}: ${listErr.message}` }
  if (!files || files.length === 0) return { count: 0 }
  const paths = files.map(f => `${folder}/${f.name}`)
  const { error: rmErr } = await sb.storage.from(bucket).remove(paths)
  if (rmErr) return { count: 0, warning: `remove ${bucket}/${folder}: ${rmErr.message}` }
  return { count: paths.length }
}

/**
 * Cascade hard delete d'une intervention :
 *   1. supprime les documents (factures / devis / attestations) liés
 *   2. vide les dossiers Storage (PDFs + photos) `{interventionId}/...`
 *   3. supprime la ligne intervention
 *
 * IMPORTANT : tous les DELETE Supabase utilisent `.select('id')` car le client
 * peut renvoyer success sans rien supprimer (problème connu sur ce projet,
 * cf fix `persist: DELETE vérifie la suppression réelle`).
 *
 * Best-effort sur Storage : un échec sur les fichiers ne bloque pas la
 * suppression DB (orphelins → stockage perdu, pas de bug fonctionnel).
 */
export async function cascadeDeleteIntervention(interventionId: string): Promise<CascadeDeleteResult> {
  const warnings: string[] = []
  const sb = getSupabaseOrNull()
  if (!sb) {
    return {
      ok: false, intervention_id: interventionId,
      deleted_documents: 0, deleted_photos: 0, deleted_pdfs: 0,
      warnings: ['Supabase non configuré'],
    }
  }

  // 1. Liste les documents liés (pour le compte retourné), puis delete vérifié.
  const { data: docsBefore, error: docListErr } = await sb
    .from('documents')
    .select('id')
    .eq('intervention_id', interventionId)
  if (docListErr) warnings.push(`list documents: ${docListErr.message}`)
  const expectedDocs = docsBefore?.length || 0

  let deletedDocs = 0
  if (expectedDocs > 0) {
    const { data: deletedRows, error: docDelErr } = await sb
      .from('documents')
      .delete()
      .eq('intervention_id', interventionId)
      .select('id')
    if (docDelErr) {
      warnings.push(`delete documents: ${docDelErr.message}`)
    } else {
      deletedDocs = deletedRows?.length || 0
      if (deletedDocs < expectedDocs) {
        warnings.push(`delete documents incomplet: ${deletedDocs}/${expectedDocs} effacés`)
      }
    }
  }

  // 2. Storage best-effort.
  const folder = interventionId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  const [pdfRes, photoRes] = await Promise.all([
    emptyFolder(sb, PDFS_BUCKET, folder),
    emptyFolder(sb, PHOTOS_BUCKET, folder),
  ])
  if (pdfRes.warning) warnings.push(pdfRes.warning)
  if (photoRes.warning) warnings.push(photoRes.warning)

  // 3. Delete intervention avec vérification — c'est le check critique : si
  // 0 ligne effacée, on remonte une erreur claire (sinon le client filtre
  // optimistiquement et la ligne revient au reload, c'est le bug).
  const { data: deletedInts, error: intErr } = await sb
    .from('interventions')
    .delete()
    .eq('id', interventionId)
    .select('id')
  if (intErr) {
    return {
      ok: false, intervention_id: interventionId,
      deleted_documents: deletedDocs,
      deleted_photos: photoRes.count,
      deleted_pdfs: pdfRes.count,
      warnings: [...warnings, `delete intervention: ${intErr.message}`],
    }
  }
  if (!deletedInts || deletedInts.length === 0) {
    return {
      ok: false, intervention_id: interventionId,
      deleted_documents: deletedDocs,
      deleted_photos: photoRes.count,
      deleted_pdfs: pdfRes.count,
      warnings: [...warnings, 'delete intervention: 0 ligne effacée (déjà supprimée ou ID invalide)'],
    }
  }

  return {
    ok: true, intervention_id: interventionId,
    deleted_documents: deletedDocs,
    deleted_photos: photoRes.count,
    deleted_pdfs: pdfRes.count,
    warnings,
  }
}

/**
 * Cascade hard delete depuis un document (facture / devis / attestation).
 *   - Si lié à une intervention → cascade sur l'intervention complète
 *     (= efface aussi le rapport, les autres documents liés, les photos).
 *   - Sinon → supprime juste le document orphelin avec vérification.
 */
export async function cascadeDeleteDocument(documentId: string): Promise<
  | { kind: 'intervention'; result: CascadeDeleteResult }
  | { kind: 'document'; ok: boolean; warnings: string[] }
> {
  const warnings: string[] = []
  const sb = getSupabaseOrNull()
  if (!sb) return { kind: 'document', ok: false, warnings: ['Supabase non configuré'] }

  const { data: doc, error: getErr } = await sb
    .from('documents')
    .select('id, intervention_id, pdf_url')
    .eq('id', documentId)
    .maybeSingle()
  if (getErr) return { kind: 'document', ok: false, warnings: [getErr.message] }
  if (!doc) return { kind: 'document', ok: false, warnings: ['Document introuvable'] }

  if (doc.intervention_id) {
    const result = await cascadeDeleteIntervention(doc.intervention_id)
    return { kind: 'intervention', result }
  }

  if (doc.pdf_url) {
    const m = doc.pdf_url.match(/\/object\/public\/[^/]+\/(.+)$/)
    const path = m ? m[1] : null
    if (path) {
      const { error: rmErr } = await sb.storage.from(PDFS_BUCKET).remove([path])
      if (rmErr) warnings.push(`remove pdf: ${rmErr.message}`)
    }
  }
  const { data: deletedRows, error: delErr } = await sb
    .from('documents')
    .delete()
    .eq('id', documentId)
    .select('id')
  if (delErr) return { kind: 'document', ok: false, warnings: [...warnings, delErr.message] }
  if (!deletedRows || deletedRows.length === 0) {
    return { kind: 'document', ok: false, warnings: [...warnings, '0 ligne effacée (déjà supprimée ou ID invalide)'] }
  }
  return { kind: 'document', ok: true, warnings }
}
