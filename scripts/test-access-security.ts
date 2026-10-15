import { webcrypto } from 'node:crypto'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'
Object.defineProperty(globalThis, 'crypto', {value: webcrypto, configurable:true})
async function main() {
 let checks=0
 const user='audit-user', password='audit-only-password-long-enough-123'
 const auth='Basic '+Buffer.from(`${user}:${password}`).toString('base64')
 const request=(path:string, headers:Record<string,string>={}, method='GET') => new NextRequest('https://example.test'+path,{headers,method})
 delete process.env.APRIME_ACCESS_USER; delete process.env.APRIME_ACCESS_PASSWORD
 assert.equal((await middleware(request('/api/clients'))).status,503); checks++
 process.env.APRIME_ACCESS_USER=user; process.env.APRIME_ACCESS_PASSWORD=password
 for(const path of ['/', '/api/clients','/api/health','/api/publish','/api/accords/123/valider','/api/export/csv']) {
  assert.equal((await middleware(request(path))).status,401); checks++
 }
 for(const value of ['Basic broken', 'Bearer anything','Basic '+Buffer.from('audit-user:wrong').toString('base64')]) {
  assert.equal((await middleware(request('/api/clients',{authorization:value}))).status,401); checks++
 }
 let result=await middleware(request('/api/clients',{authorization:auth}))
 assert.equal(result.headers.get('x-middleware-next'),'1'); checks++
 assert.match(result.headers.get('cache-control')||'',/no-store/); checks++
 assert.equal((await middleware(request('/api/publish',{authorization:auth,origin:'https://evil.test'},'POST'))).status,403); checks++
 assert.equal((await middleware(request('/api/publish',{authorization:auth,'sec-fetch-site':'cross-site'},'POST'))).status,403); checks++
 assert.equal((await middleware(request('/api/publish',{authorization:auth,origin:'https://example.test'},'POST'))).headers.get('x-middleware-next'),'1'); checks++
 assert.equal((await middleware(request('/api/calendar.ics?token=test'))).headers.get('x-middleware-next'),'1'); checks++
 assert.equal((await middleware(request('/api/calendar.ics',{},'POST'))).status,401); checks++
 assert.equal((await middleware(request('/sw.js'))).headers.get('x-middleware-next'),'1'); checks++
 for (const path of ['/api/notify-client/stop-review','/api/facture/stop-reminders','/api/quote-complementaire/stop-reminders']) {
  assert.equal((await middleware(request(path))).headers.get('x-middleware-next'),'1'); checks++
  assert.equal((await middleware(request(path,{},'POST'))).status,401); checks++
 }
 console.log(`${checks} contrôles d’accès réussis — aucun appel réseau ni accès aux données`)
}
main().catch(e=>{console.error(e);process.exitCode=1})
