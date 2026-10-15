/** Device-local recovery. Resolve writes only after the IndexedDB transaction commits. */
const DB = 'aprime-intervention-recovery'
let writes: Promise<unknown> = Promise.resolve()
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Sauvegarde locale indisponible'))
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('drafts')
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Fermez les autres onglets pour activer la sauvegarde locale'))
    request.onsuccess = () => resolve(request.result)
  })
}
async function transaction<T>(mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', mode)
    const request = action(tx.objectStore('drafts'))
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onabort = () => { db.close(); reject(tx.error || request.error || new Error('Sauvegarde locale interrompue')) }
    tx.onerror = () => { /* onabort reports the failure; never report a request as committed early. */ }
  })
}
export async function readRecovery<T>(key: string): Promise<T | undefined> {
  await writes.catch(() => undefined)
  return transaction('readonly', s => s.get(key)) as Promise<T | undefined>
}
export function saveRecovery<T>(key: string, value: T): Promise<void> {
  const result = writes.catch(() => undefined).then(() => transaction('readwrite', s => s.put(value, key))).then(() => undefined)
  writes = result
  return result
}
export function removeRecovery(key: string): Promise<void> {
  const result = writes.catch(() => undefined).then(() => transaction('readwrite', s => s.delete(key))).then(() => undefined)
  writes = result
  return result
}
