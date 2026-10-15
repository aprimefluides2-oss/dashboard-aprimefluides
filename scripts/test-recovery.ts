import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { saveRecovery, readRecovery, removeRecovery } from '../lib/recovery-store'
import { publicationErrors } from '../lib/publication-check'
const require = createRequire(import.meta.url)
const { indexedDB, IDBObjectStore } = require(process.env.APRIME_RECOVERY_TEST_DEPS || 'fake-indexeddb')
Object.assign(globalThis, { indexedDB })
async function main() {
 let checks=0
 const dossier={transcription:'Inspection et curage', rapport:{diagnostic:'Bouchon retiré'}, photos:[{file:new Blob(['photo-test'],{type:'image/jpeg'}), name:'avant.jpg',legende:'Avant'}]}
 await saveRecovery('test',dossier)
 const loaded=await readRecovery<typeof dossier>('test')
 assert.equal(loaded?.rapport.diagnostic,dossier.rapport.diagnostic);checks++
 assert.equal(await loaded?.photos[0].file.text(),'photo-test');checks++
 // An aborted write must never be reported as successful.
 const originalPut=IDBObjectStore.prototype.put
 IDBObjectStore.prototype.put=function(...args: unknown[]) {
  const request=originalPut.apply(this,args)
  request.addEventListener('success',()=>this.transaction.abort())
  return request
 }
 await assert.rejects(saveRecovery('test',{lost:true}));checks++
 IDBObjectStore.prototype.put=originalPut
 assert.equal((await readRecovery<typeof dossier>('test'))?.rapport.diagnostic,dossier.rapport.diagnostic);checks++
 // The queue must recover after failure and preserve ordering on discard/reset.
 await Promise.all([saveRecovery('test',{version:1}),saveRecovery('test',{version:2}),removeRecovery('test')])
 assert.equal(await readRecovery('test'),undefined);checks++
 await saveRecovery('test',{version:3})
 assert.equal((await readRecovery<{version:number}>('test'))?.version,3);checks++
 const valid={title:'Curage à Bezons',content:'<p>Intervention réalisée.</p>',city:'Bezons',postalCode:'95870',slug:'curage-bezons',photoCount:2}
 assert.deepEqual(publicationErrors(valid),[]);checks++
 for(const field of ['title','content','city','postalCode','slug'] as const) {
  assert.ok(publicationErrors({...valid,[field]:''}).length);checks++
 }
 assert.ok(publicationErrors({...valid,content:'<p> </p>'}).length);checks++
 assert.ok(publicationErrors({...valid,postalCode:'9500'}).length);checks++
 assert.ok(publicationErrors({...valid,slug:'../private'}).length);checks++
 assert.ok(publicationErrors({...valid,photoCount:0}).length);checks++
 await removeRecovery('test')
 console.log(`${checks} contrôles réussis : fichiers, reprise, transaction interrompue, effacement ordonné, validation publication. Aucun réseau ni donnée client.`)
}
main().catch(e=>{console.error(e);process.exitCode=1})
