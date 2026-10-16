import React from 'react'
import assert from 'node:assert/strict'
import {writeFileSync, readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {renderToBuffer} from '@react-pdf/renderer'
import {InspectionDocument, type InspectionData} from '../components/InspectionCameraPDF'
import {inspectionLocation} from '../lib/inspection-location'
import {validInspectionDraft} from '../lib/inspection-draft'
async function main(){
assert.equal(inspectionLocation({position:'Repère saisi',description:'cave 7'}),'Repère saisi')
assert.equal(inspectionLocation({description:'Collecteur place 29 puis cave 8.'}),'place 29 · cave 8')
assert.equal(inspectionLocation({description:'WC du 1er étage'}),'1er étage')
assert.equal(inspectionLocation({description:'Bouchon à 2 mètres'}),'Repère à compléter')
const legacy={diffusion:'client-prive',statut:'brouillon',conclusionEtat:'bon',precoSelected:[],precoCustom:[],videoManifest:[],observations:[]}
assert.ok(validInspectionDraft(legacy,{...legacy,conclusionPrecision:''}))
assert.ok(!validInspectionDraft({...legacy,conclusionPrecision:42},{...legacy,conclusionPrecision:''}))
const photo='data:image/jpeg;base64,'+readFileSync(new URL('./annotation-fixture.jpg',import.meta.url)).toString('base64')
const data:InspectionData={numero:'ITV-20261016-150907-5c8c5fca',dateInspection:'2026-10-15',technicienNom:'Technicien secteur',client:{nom:'Fictif',adresse:'12 rue Test',ville:'Bezons',codePostal:'95870'},troncon:{},observations:Array.from({length:7},(_,i)=>({position:'',description:`Inspection cave ${i+1}`,photoUrl:photo})),preconisations:[],resume:'Contrôle terminé.',conclusionEtat:'bon',conclusionPrecision:'Contrôle limité au tronçon T1.'}
writeFileSync('/tmp/inspection-layout.pdf',await renderToBuffer(<InspectionDocument data={data}/>))
const text=execFileSync('pdftotext',['/tmp/inspection-layout.pdf','-'],{encoding:'utf8'})
assert.ok(text.includes(data.numero));assert.ok(text.includes('15/10/2026'));assert.ok(text.includes('Contrôle limité au tronçon T1.'));assert.ok(!text.includes('Point non précisé'));assert.ok(text.includes('Photo OBS 01'));assert.ok(!text.includes('Capture OBS 01'))
execFileSync('pdftotext',['-bbox','/tmp/inspection-layout.pdf','/tmp/inspection-layout.html'])
console.log('12 contrôles réussis : repères explicites, absence d’inférence de distance, anciennes sauvegardes, référence longue, conclusion et distinction photo/vidéo.')
}
main().catch(e=>{console.error(e);process.exit(1)})
