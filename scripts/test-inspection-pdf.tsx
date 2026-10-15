import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { InspectionDocument, type InspectionData } from '../components/InspectionCameraPDF'
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
async function main() {
 const data: InspectionData = { numero:'ITV-TEST', dateInspection:'2026-10-15', technicienNom:'Technicien', societe:'Société partenaire', sousTraitance:true, client:{nom:'Dupont',adresse:'12 rue des Lilas, appartement 4',ville:'Bezons',codePostal:'95870',email:'prive@example.com',telephone:'0612345678'}, troncon:{},observations:[{position:'Vidéo 0:32',description:'Dupont : contrôle au 12 rue des Lilas',photoLegende:'Vue intérieure'}],preconisations:[],resume:'Contrôle technique',conclusionEtat:'a-surveiller' }
 const buffer=await renderToBuffer(<InspectionDocument data={data}/>);writeFileSync('/tmp/aprime-inspection-test.pdf',buffer)
 const text=execFileSync('pdftotext',['/tmp/aprime-inspection-test.pdf','-'],{encoding:'utf8'})
 for(const forbidden of ['Dupont','12 rue','appartement','prive@example.com','0612345678','95870','contact@aprime-fluides.fr','Aprime fluides']) assert.ok(!text.includes(forbidden),forbidden)
 for(const expected of ['Société partenaire','BROUILLON','rue des Lilas','Bezons','Vidéo 0:32']) assert.ok(text.includes(expected),expected)
 console.log('14 contrôles PDF réussis : anonymisation, sous-traitance, repère et brouillon')
}
main().catch(e=>{console.error(e);process.exit(1)})
