import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { File as NodeFile } from 'node:buffer'
Object.assign(globalThis, { File: globalThis.File || NodeFile })
process.env.SUPABASE_URL='https://audit.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY='audit-placeholder-not-a-real-key'
process.env.CLIENT_API_URL='https://publication.example.test'
process.env.CLIENT_PUBLISH_TOKEN='audit-placeholder'
let failedPhoto=false, incompleteReply=false, failedTracking=false, invalidContent=false
let publications=0, tracking=0, checkedBody=false
let pageExists=false, anotherOwner=false, siteUnavailable=false
let sent: FormData | undefined
const row={id:'11111111-1111-4111-8111-111111111111',reference:'TEST',type_intervention:'Curage canalisation',ville:'Bezons',code_postal:'95870',rapport_json:{diagnostic:'Test'},publie_slug:'',seo_json:{meta_title:'Curage professionnel à Bezons',howto_json:JSON.stringify({'@type':'HowTo',step:[{text:'Inspection'},{text:'Curage'}]}),titre_h1:'Curage à Bezons',contenu_principal:'<p>Curage et contrôle.</p>',slug:'curage-bezons-test',faq:[]},photos_urls:['https://audit.supabase.co/storage/v1/object/public/interventions-photos/test.jpg'],photos_legendes:['Avant'],client_id:null,technicien_id:null,date_realisee:'2026-10-15'}
// Every outbound request is intercepted; unknown destinations abort the test.
globalThis.fetch=async(input,init)=>{
 const req=input instanceof Request?input:undefined
 const url=new URL(req?.url || String(input)); const method=init?.method || req?.method || 'GET'
 if(url.hostname==='publication.example.test' && url.pathname.startsWith('/api/gallery/') && method==='GET') return new Response('{}',{status:siteUnavailable?503:pageExists?200:404})
 if(url.hostname==='audit.supabase.co' && url.pathname==='/rest/v1/interventions') {
  if(uSafe(url)) return new Response(anotherOwner?'[{"id":"another-intervention"}]':'[]',{headers:{'content-type':'application/json'}})
  if(method==='PATCH') {tracking++;return new Response(JSON.stringify(failedTracking?{message:'test failure',code:'test'}:[{id:row.id}]),{status:failedTracking?500:200,headers:{'content-type':'application/json'}})}
  return new Response(JSON.stringify([{...row,seo_json:{...row.seo_json,contenu_principal:invalidContent?'':row.seo_json.contenu_principal}}]),{headers:{'content-type':'application/json'}})
 }
 if(url.hostname==='audit.supabase.co' && url.pathname.startsWith('/storage/v1/render/image/public/')) return new Response(failedPhoto?'unavailable':new Uint8Array([255,216,255,217]),{status:failedPhoto?404:200,headers:{'content-type':failedPhoto?'text/plain':'image/jpeg'}})
 if(url.hostname==='publication.example.test' && url.pathname==='/api/gallery/publish/' && method==='POST') {
  publications++
  const form=init?.body as FormData
  sent=form
  assert.ok(form.get('before_image') instanceof Blob)
  assert.equal(form.get('client_email'),null)
  checkedBody=true
  return new Response(incompleteReply?'{}':JSON.stringify({slug:form.get('slug')}),{status:201,headers:{'content-type':'application/json'}})
 }
 throw new Error(`Unexpected network request blocked: ${method} ${url.hostname}${url.pathname}`)
}
function uSafe(url: URL) { return (url.searchParams.get('id') || '').startsWith('neq.') }
async function main(){
 const {POST}=await import('../app/api/publish/from-intervention/route')
 const request=()=>new NextRequest('https://app.example.test/api/publish/from-intervention',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({interventionId:row.id})})
 let checks=0
 anotherOwner=true
 assert.equal((await POST(request())).status,409);checks++
 assert.equal(publications,0);checks++
 anotherOwner=false;pageExists=true
 assert.equal((await POST(request())).status,409);checks++
 assert.equal(publications,0);checks++
 pageExists=false;siteUnavailable=true
 assert.equal((await POST(request())).status,503);checks++
 assert.equal(publications,0);checks++
 siteUnavailable=false
 failedPhoto=true
 assert.equal((await POST(request())).status,502);checks++
 assert.equal(publications,0);checks++
 failedPhoto=false;invalidContent=true
 assert.equal((await POST(request())).status,400);checks++
 assert.equal(publications,0);checks++
 invalidContent=false;incompleteReply=true
 assert.equal((await POST(request())).status,502);checks++
 assert.equal(tracking,0);checks++
 incompleteReply=false;failedTracking=true
 const partial=await (await POST(request())).json()
 assert.equal(partial.ok,true);checks++
 assert.match(partial.warning,/Ne republiez pas/);checks++
 failedTracking=false
 const success=await (await POST(request())).json()
 assert.equal(success.slug,'curage-bezons-test');checks++
 assert.equal(success.warning,undefined);checks++
 assert.equal(checkedBody,true);checks++
 assert.equal(sent?.get('meta_title'),'Curage professionnel à Bezons');checks++
 assert.ok(String(sent?.get('howto_json')).includes('HowTo'));checks++
 assert.equal(sent?.get('rapport_json'),null);checks++
 row.publie_slug='adresse-publiee-conservee'
 row.seo_json.slug='adresse-regeneree-a-ignorer'
 const republished=await (await POST(request())).json()
 assert.equal(sent?.get('slug'),'adresse-publiee-conservee');checks++
 assert.equal(republished.slug,'adresse-publiee-conservee');checks++
 console.log(`${checks} contrôles de publication réussis : données simulées, aucun accès réseau réel.`)
}
main().catch(e=>{console.error(e);process.exitCode=1})
