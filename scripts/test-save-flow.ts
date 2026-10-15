import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { File as NodeFile } from 'node:buffer'
Object.assign(globalThis,{File:globalThis.File || NodeFile})
process.env.SUPABASE_URL='https://audit.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY='audit-placeholder'
let failUpload=false, missingRow=false, databaseWrites=0, uploads=0
let saved: Record<string,unknown>={}
globalThis.fetch=async(input,init)=>{
 const request=input instanceof Request?input:undefined
 const u=new URL(request?.url || String(input));const method=init?.method || request?.method || 'GET'
 if(u.hostname!=='audit.supabase.co') throw new Error('Unexpected network blocked')
 if(u.pathname.startsWith('/storage/v1/object/')) {
  uploads++
  return new Response(JSON.stringify(failUpload?{error:'simulated upload failure',message:'simulated failure',statusCode:'500'}:{Key:'test/photo.jpg'}),{status:failUpload?500:200,headers:{'content-type':'application/json'}})
 }
 if(u.pathname==='/rest/v1/interventions' && method==='PATCH') {
  databaseWrites++; saved=JSON.parse(String(init?.body))
  return new Response(JSON.stringify(missingRow?[]:[{id:'test-intervention'}]),{headers:{'content-type':'application/json'}})
 }
 throw new Error(`Unexpected request blocked: ${method} ${u.pathname}`)
}
async function main(){
 const {POST}=await import('../app/api/save-rapport/route')
 const json=(body:unknown)=>new NextRequest('https://app.example.test/api/save-rapport',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
 const multipart=(manifest:unknown,photo=true)=>{
  const form=new FormData()
  form.set('meta',JSON.stringify({interventionId:'test-intervention',rapport:{diagnostic:'Test uniquement'}}))
  form.set('photosManifest',JSON.stringify(manifest))
  if(photo) form.set('photo_0',new Blob(['test-image'],{type:'image/jpeg'}),'photo.jpg')
  return new NextRequest('https://app.example.test/api/save-rapport',{method:'POST',body:form})
 }
 let checks=0
 assert.equal((await POST(json({}))).status,400);checks++
 assert.equal((await POST(multipart({invalid:true}))).status,400);checks++
 assert.equal(databaseWrites,0);checks++
 failUpload=true
 assert.equal((await POST(multipart([{fileKey:'photo_0',legende:'Avant'}]))).status,502);checks++
 assert.equal(databaseWrites,0);checks++
 failUpload=false
 assert.equal((await POST(multipart([{fileKey:'photo_0'}],false))).status,502);checks++
 assert.equal(databaseWrites,0);checks++
 missingRow=true
 assert.equal((await POST(json({interventionId:'missing',rapport:{diagnostic:'Test'}}))).status,500);checks++
 missingRow=false
 const savedResponse=await POST(json({interventionId:'test-intervention',rapport:{diagnostic:'Test'}}))
 assert.equal(savedResponse.status,200);checks++
 assert.equal('photos_urls' in saved,false);checks++
 const withPhoto=await POST(multipart([{fileKey:'photo_0',legende:'Avant'}]))
 assert.equal(withPhoto.status,200);checks++
 const body=await withPhoto.json()
 assert.equal(body.photos_urls.length,1);checks++
 assert.deepEqual(body.photos_legendes,['Avant']);checks++
 assert.equal(uploads,2);checks++
 console.log(`${checks} contrôles de sauvegarde réussis, réseau et base entièrement simulés.`)
}
main().catch(e=>{console.error(e);process.exitCode=1})
