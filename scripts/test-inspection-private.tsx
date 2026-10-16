import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { InspectionDocument, type InspectionData } from '../components/InspectionCameraPDF'
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
async function extract(data: InspectionData) {
 writeFileSync('/tmp/aprime-inspection-private-test.pdf',await renderToBuffer(<InspectionDocument data={data}/>))
 return execFileSync('pdftotext',['-layout','/tmp/aprime-inspection-private-test.pdf','-'],{encoding:'utf8'})
}
async function main() {
 const data: InspectionData = {diffusion:'client-prive',numero:'ITV-PRIVE',dateInspection:'2026-10-16',technicienNom:'Technicien',societe:'Partenaire',sousTraitance:true,client:{nom:'Dupont',adresse:'12 rue des Lilas, bâtiment B',codePostal:'95870',ville:'Bezons',email:'secret@example.com'},troncon:{},observations:[{position:'T1',troncon:'T1',videoReference:'Vidéo 1',timecode:'0:32',pointDepart:'Regard R1',sensInspection:'R1 vers maison',distanceM:2,distanceSource:'Compteur visible dans la vidéo',description:'Cassure visible'},{position:'T2',videoReference:'Vidéo 2',timecode:'2:05',description:'Inspection partielle'},{position:'T3',videoReference:'Vidéo 3',timecode:'0:00',distanceM:0,description:'Défaut au départ'}],preconisations:[],resume:'Relevé à valider',conclusionEtat:'a-surveiller'}
 const text=await extract(data)
 for(const expected of ['12 rue des Lilas','95870','CONFIDENTIEL','ne pas publier','Vidéo 1','Vidéo 2','Vidéo 3','Distance : 2 m','Distance : 0 m','Distance non mesurée','Regard R1','0:32','Compteur visible']) assert.ok(text.includes(expected),expected)
 for(const forbidden of ['Dupont','secret@example.com','contact@aprime-fluides.fr']) assert.ok(!text.includes(forbidden),forbidden)
 const anonymised=await extract({...data,diffusion:'anonymise'})
 for(const forbidden of ['12 rue','bâtiment B','95870','Dupont']) assert.ok(!anonymised.includes(forbidden),forbidden)
 assert.ok(anonymised.includes('rue des Lilas'))
 console.log('21 contrôles PDF réussis : adresse privée, copie anonymisée, plusieurs vidéos, distances zéro/inconnue et confidentialité')
}
main().catch(e=>{console.error(e);process.exit(1)})
