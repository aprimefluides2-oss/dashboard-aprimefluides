/**
 * File d'attente hors-ligne des accords d'intervention (IndexedDB).
 *
 * Un accord créé sans réseau est stocké ici avec un `local_id` (UUID device).
 * `lib/accord/sync.ts` le rejoue ensuite vers /api/accords ; le serveur
 * déduplique sur `local_id` (colonne UNIQUE). À n'importer que côté client.
 */

/** Une ligne de devis telle qu'envoyée à /api/accords. */
export type LignePayload = {
  tarif_type: string | null
  label: string
  prix_unitaire: number
  unite: string
  quantite: number
  urgent: boolean
}

/** Corps POST /api/accords — partagé par le formulaire, la file et la sync. */
export type AccordCreatePayload = {
  local_id: string
  intervention_id: string | null
  client_id: string | null
  client_nom: string
  client_adresse: string | null
  client_code_postal: string | null
  client_ville: string | null
  client_telephone: string | null
  client_email: string | null
  frais_deplacement: number
  taux_tva: number
  validite_jours: number
  intervention_urgente: boolean
  lignes: LignePayload[]
  // Validation capturée sur le device (cas hors-ligne signé) — sinon null/false.
  signature: string | null
  valide_at: string | null
  demande_expresse: boolean
  renonciation_retractation: boolean
  canal_validation: 'SIGNATURE' | null
}

export type PendingAccord = {
  local_id: string
  created_offline_at: string
  payload: AccordCreatePayload
}

const DB_NAME = 'ltdb-accords-offline'
const DB_VERSION = 1
const STORE = 'pending'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'local_id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Ouverture IndexedDB échouée'))
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error || new Error('Opération IndexedDB échouée'))
        transaction.oncomplete = () => db.close()
      }),
  )
}

/** Ajoute un accord à la file de synchronisation. */
export async function savePendingAccord(payload: AccordCreatePayload): Promise<void> {
  const record: PendingAccord = {
    local_id: payload.local_id,
    created_offline_at: new Date().toISOString(),
    payload,
  }
  await tx('readwrite', store => store.put(record))
}

/** Liste les accords en attente, du plus ancien au plus récent. */
export async function listPendingAccords(): Promise<PendingAccord[]> {
  const all = await tx<PendingAccord[]>('readonly', store => store.getAll())
  return (all || []).sort((a, b) => a.created_offline_at.localeCompare(b.created_offline_at))
}

/** Retire un accord de la file (après synchronisation réussie). */
export async function removePendingAccord(localId: string): Promise<void> {
  await tx('readwrite', store => store.delete(localId))
}

/** Nombre d'accords en attente de synchronisation. */
export async function countPendingAccords(): Promise<number> {
  try {
    return await tx<number>('readonly', store => store.count())
  } catch {
    return 0
  }
}
