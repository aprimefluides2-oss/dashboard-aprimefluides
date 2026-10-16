import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validInspectionDraft} from '../lib/inspection-draft'
const path=process.argv[2];if(!path)throw new Error('Indiquer une copie de test exportée par le navigateur')
const data=JSON.parse(readFileSync(path,'utf8')).data
assert.ok(validInspectionDraft(data,data))
const clone=()=>structuredClone(data)
let bad=clone();bad.observations[1].photoUrl='https://external.example/private.jpg';assert.ok(!validInspectionDraft(bad,data))
bad=clone();bad.observations[1].distanceM=-1;assert.ok(!validInspectionDraft(bad,data))
bad=clone();bad.observations[1].annotations[0].x1=Infinity;assert.ok(!validInspectionDraft(bad,data))
bad=clone();bad.clientAdresse={};assert.ok(!validInspectionDraft(bad,data))
bad=clone();bad.diffusion='public';assert.ok(!validInspectionDraft(bad,data))
assert.equal(data.observations[1].annotations.length,2);assert.ok(data.observations[1].originalPhotoUrl);assert.notEqual(data.observations[1].photoUrl,data.observations[1].originalPhotoUrl)
console.log('9 contrôles de copie exportée réussis : reprise, annotations, original conservé, refus des copies invalides')
