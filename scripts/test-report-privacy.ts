import assert from 'node:assert/strict'
import { privateReport, streetOnly } from '../lib/report-privacy'
assert.equal(streetOnly('12 bis rue des Lilas, bâtiment B'),'rue des Lilas')
assert.equal(streetOnly('Appartement 4'),'')
const result=privateReport({client_nom:'Dupont',diagnostic:'Chez Dupont au 12 rue des Lilas à Bezons. Curage à 150 bars sur 20 mètres.'},'Dupont')
assert.equal(result.client_nom,'')
assert.ok(!result.diagnostic.includes('Dupont'))
assert.ok(!result.diagnostic.includes('12 rue'))
assert.ok(result.diagnostic.includes('dans la rue des Lilas'))
assert.ok(!result.diagnostic.includes('au rue'))
assert.ok(result.diagnostic.includes('150 bars'))
assert.ok(result.diagnostic.includes('20 mètres'))
console.log('9 contrôles de confidentialité du rapport réussis.')
