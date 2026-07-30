/**
 * Tests de `lib/fix-transcription.ts` — exécuter : npx tsx scripts/test-fix-transcription.ts
 *
 * Le 2e bloc (TEMOINS) est le plus important : il vérifie l'IDEMPOTENCE, c.-à-d.
 * qu'un texte déjà correct ressort intact. La première version du module
 * transformait « eaux usées » en « eaux uséeses » (piège `\b` + accents, cf.
 * en-tête du module) — ce test existe pour que ça ne se reproduise pas.
 */
import { fixTranscription, fixGeneratedText } from '../lib/fix-transcription'

let echecs = 0

function attendu(entree: string, sortie: string, libelle: string) {
  const obtenu = fixTranscription(entree)
  if (obtenu !== sortie) {
    echecs++
    console.error(`✗ ${libelle}\n   entrée  : ${entree}\n   attendu : ${sortie}\n   obtenu  : ${obtenu}`)
  } else {
    console.log(`✓ ${libelle}`)
  }
}

function temoin(texte: string) {
  const obtenu = fixTranscription(texte)
  if (obtenu !== texte) {
    echecs++
    console.error(`✗ TÉMOIN modifié à tort\n   avant : ${texte}\n   après : ${obtenu}`)
  } else {
    console.log(`✓ témoin intact : ${texte}`)
  }
}

console.log('--- Corrections attendues')
attendu("pannes d'apparuits sanitaires", "pannes d'appareils sanitaires", 'apparuits → appareils')
attendu('sanibroyeur qui disjonc te', 'sanibroyeur qui disjoncte', 'mot coupé : disjonc te')
attendu('canalisation à débouch er', 'canalisation à déboucher', 'mot coupé : débouch er')
attendu("l'évacu ation est rétablie", "l'évacuation est rétablie", 'mot coupé : évacu ation')
attendu('un sani broyeur neuf', 'un sanibroyeur neuf', 'sani broyeur → sanibroyeur')
attendu('hydro curage à 200 bars', 'hydrocurage à 200 bars', 'hydro curage → hydrocurage')
attendu('le syphon était bouché', 'le siphon était bouché', 'syphon → siphon')
attendu('pompe de relevement HS', 'pompe de relevage HS', 'relevement → relevage')
attendu('regard de visites en cour', 'regard de visite en cour', 'regard de visites')
attendu('espace avant virgule , ici', 'espace avant virgule, ici', 'ponctuation')

console.log('\n--- Témoins : textes DÉJÀ corrects, doivent rester identiques')
;[
  'les eaux usées stagnaient dans le regard',
  '800 litres d’eaux usées évacués',
  'des appareils sanitaires au rez-de-chaussée',
  'le sanibroyeur disjoncte à la mise en route',
  'canalisations bouchées par des lingettes',
  'un regard de visite accessible',
  'une fosse toutes eaux de 3 000 litres',
  'vidange du bac à graisse',
  'la pompe de relevage a été remplacée',
  'hydrocurage puis inspection vidéo',
  'le siphon a été démonté',
  'colonne EU de l’immeuble',
  'disjoncteur différentiel déclenché',
  'installation terminée, évacuation fluide, remplacement validé',
  'obstruction due aux graisses ; raccordement contrôlé',
  'fonctionnement vérifié après remise en service',
].forEach(temoin)

console.log('\n--- HTML : balises et attributs intacts')
const html =
  '<p>Les <strong>eaux usées</strong> du <a href="https://x.fr/eaux-usees-a-b">regard</a> — apparuits HS</p>'
const attenduHtml =
  '<p>Les <strong>eaux usées</strong> du <a href="https://x.fr/eaux-usees-a-b">regard</a> — appareils HS</p>'
const obtenuHtml = fixGeneratedText(html)
if (obtenuHtml !== attenduHtml) {
  echecs++
  console.error(`✗ HTML\n   attendu : ${attenduHtml}\n   obtenu  : ${obtenuHtml}`)
} else {
  console.log('✓ HTML : texte corrigé, balises/href intacts')
}

console.log('\n--- Idempotence : 2 passes = 1 passe')
for (const t of [
  "pannes d'apparuits sanitaires et eaux usées",
  html,
  'sanibroyeur qui disjonc te, eaux usées stagnantes',
]) {
  const une = fixGeneratedText(t)
  const deux = fixGeneratedText(une)
  if (une !== deux) {
    echecs++
    console.error(`✗ non idempotent\n   1 passe : ${une}\n   2 passes: ${deux}`)
  } else {
    console.log('✓ idempotent')
  }
}

console.log(echecs === 0 ? '\n✅ TOUS LES TESTS PASSENT' : `\n❌ ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
