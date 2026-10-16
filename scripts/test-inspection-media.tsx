import React from 'react'
import {renderToBuffer} from '@react-pdf/renderer'
import {InspectionDocument, type InspectionData} from '../components/InspectionCameraPDF'
import {privateReport} from '../lib/report-privacy'
import {readFileSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
async function main(){
 const photoUrl='data:image/jpeg;base64,'+readFileSync(new URL('./annotation-fixture.jpg',import.meta.url)).toString('base64')
 assert.equal(privateReport({photoUrl}).photoUrl,photoUrl)
 const data:InspectionData={numero:'ITV-MEDIA-TEST',dateInspection:'2026-10-16',technicienNom:'Test',client:{nom:'Client Fictif',adresse:'12 rue Exemple',ville:'Bezons',codePostal:'95870'},troncon:{},observations:[{position:'T1',distanceM:2,pointDepart:'R1',videoReference:'Vidéo 1',timecode:'0:00',description:'Incident fictif',photoUrl,photoLegende:'Annotation de test'}],preconisations:[],resume:'',conclusionEtat:'a-surveiller'}
 writeFileSync('/tmp/aprime-media-test.pdf',await renderToBuffer(<InspectionDocument data={data}/>))
 const images=execFileSync('pdfimages',['-list','/tmp/aprime-media-test.pdf'],{encoding:'utf8'});assert.match(images,/\b640\s+360\b/)
 const text=execFileSync('pdftotext',['/tmp/aprime-media-test.pdf','-'],{encoding:'utf8'});assert.ok(text.includes('Les points relevés'));assert.ok(text.includes('Capture OBS 01'));assert.ok(!text.includes('Client Fictif'));assert.ok(!text.includes('12 rue'))
 console.log('6 contrôles réussis : image intacte et présente dans PDF, récapitulatif et anonymisation')
}
main().catch(e=>{console.error(e);process.exit(1)})
