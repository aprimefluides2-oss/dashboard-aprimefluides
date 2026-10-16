import React from 'react'
import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {renderToBuffer} from '@react-pdf/renderer'
import {InspectionDocument, type InspectionData} from '../components/InspectionCameraPDF'
async function main(){
 const base:InspectionData={numero:'ITV-BRAND-TEST',dateInspection:'2026-10-16',technicienNom:'Technicien secteur',client:{nom:'Client fictif',adresse:'12 rue Test',ville:'Bezons',codePostal:'95870'},troncon:{diametre:'DN 100'},observations:[{position:'T1',description:'Contrôle fictif terminé.'}],preconisations:[],resume:'Essai de présentation.',conclusionEtat:'bon',conclusionPrecision:'Portion T1 uniquement.'}
 for(const [name,overrides] of [['aprime',{}],['partenaire',{societe:'Entreprise partenaire',sousTraitance:true}]] as const){
  const path=`/tmp/inspection-brand-${name}.pdf`
  writeFileSync(path,await renderToBuffer(<InspectionDocument data={{...base,...overrides}}/>))
  const text=execFileSync('pdftotext',[path,'-'],{encoding:'utf8'})
  const images=execFileSync('pdfimages',['-list',path],{encoding:'utf8'})
  assert.ok(text.replace(/\s+/g," ").includes("Compte rendu d'intervention"));assert.ok(text.includes('Les points relevés'))
  assert.ok(!text.includes('Client fictif'));assert.ok(!text.includes('12 rue'))
  assert.ok(!text.includes('Chemisage'));assert.ok(!text.includes('Hydrocurage'))
  if(name==='aprime'){assert.match(images,/\bimage\b/);assert.ok(text.includes('Aprime Fluides'));assert.ok(text.includes('Depuis 2005'))}
  else{assert.ok(!/\bimage\b/.test(images));assert.ok(!text.includes('Aprime Fluides'));assert.ok(text.includes('Entreprise partenaire'));assert.ok(!text.includes('Depuis 2005'))}
 }
 console.log('19 contrôles de marque réussis : logo Aprime, neutralité sous-traitance, confidentialité et glossaire limité.')
}
main().catch(e=>{console.error(e);process.exit(1)})
