/**
 * Tests d'anonymisation des textes publiés sur le site.
 *
 *   npx tsx scripts/test-anonymize-public.ts
 *
 * Deux familles de cas, aussi importantes l'une que l'autre :
 *  - À NETTOYER : la donnée personnelle doit disparaître ;
 *  - TÉMOINS : un texte technique légitime doit ressortir INTACT
 *    (un filtre qui mange « la rue était inondée » est un filtre cassé).
 */
import { anonymizePublicText, detectPersonalData, anonymizePublishFormData } from '../lib/anonymize-public'

let echecs = 0

function attendu(entree: string, sortie: string, libelle: string) {
  const obtenu = anonymizePublicText(entree)
  const ok = obtenu === sortie
  if (!ok) {
    echecs++
    console.log(`❌ ${libelle}\n   entrée : ${entree}\n   obtenu : ${obtenu}\n   attendu: ${sortie}`)
  } else {
    console.log(`✅ ${libelle}`)
  }
  // Idempotence : repasser le filtre ne doit plus rien changer.
  const deuxiemePasse = anonymizePublicText(obtenu)
  if (deuxiemePasse !== obtenu) {
    echecs++
    console.log(`❌ ${libelle} — NON IDEMPOTENT\n   1re passe : ${obtenu}\n   2e passe  : ${deuxiemePasse}`)
  }
}

console.log('\n--- À NETTOYER ---')
attendu(
  "Intervention au 12 rue des Lilas à Argenteuil pour un WC bouché.",
  "Intervention à Argenteuil pour un WC bouché.",
  'adresse numérotée retirée, ville conservée',
)
attendu(
  "Nous sommes intervenus chez M. Dupont à Sannois.",
  "Nous sommes intervenus chez le client à Sannois.",
  'civilité + nom → « le client »',
)
attendu(
  "Mme et M. Durand nous ont appelés en urgence.",
  "le client nous ont appelés en urgence.",
  'couple avec civilités',
)
attendu(
  "Chantier 3 bis avenue Foch, 95100 Argenteuil (Val-d'Oise).",
  "Chantier, 95100 Argenteuil (Val-d'Oise).",
  'code postal, ville et département conservés',
)
attendu(
  "Accès par le digicode 45B12, bâtiment C.",
  "Accès par le digicode.",
  "code d'accès et bâtiment retirés",
)
attendu(
  "La résidence Les Tilleuls subissait des refoulements.",
  "Une résidence subissait des refoulements.",
  'résidence nommée → générique',
)
attendu(
  "<p>Intervenu au 8 impasse du Moulin à Bezons.</p>",
  "<p>Intervenu à Bezons.</p>",
  'HTML : le texte est nettoyé, les balises intactes',
)

console.log('\n--- TÉMOINS (doivent rester INTACTS) ---')
const temoins = [
  "Les eaux usées refoulaient dans la rue devant l'immeuble.",
  "La colonne d'évacuation dessert les 4 étages du bâtiment.",
  "Intervention à Argenteuil (95100), Val-d'Oise, sur une canalisation de 100 mm.",
  "Le regard extérieur était obstrué sur 3 mètres.",
  "Hydrocurage à 400 bars, 45 L/min, puis inspection caméra.",
  "<a href=\"https://www.aprime-fluides.fr/debouchage-canalisation-argenteuil-95100\">débouchage à Argenteuil</a>",
  "Le client nous a rappelés 15 jours après pour un contrôle.",
  "Nous sommes intervenus en 2 heures sur place, place de la Mairie était barrée.",
]
for (const t of temoins) {
  const obtenu = anonymizePublicText(t)
  if (obtenu !== t) {
    echecs++
    console.log(`❌ TÉMOIN MODIFIÉ\n   avant : ${t}\n   après : ${obtenu}`)
  } else {
    console.log(`✅ intact : ${t.slice(0, 60)}…`)
  }
}

console.log('\n--- DÉTECTION (journalisation) ---')
const cas: Array<[string, number]> = [
  ["Intervention au 12 rue des Lilas à Argenteuil.", 1],
  ["Chez Mme Martin, WC bouché.", 1],
  ["Débouchage de WC à Argenteuil, Val-d'Oise.", 0],
]
for (const [texte, attenduNb] of cas) {
  const trouves = detectPersonalData(texte)
  const ok = (trouves.length > 0) === (attenduNb > 0)
  if (!ok) { echecs++; console.log(`❌ détection : ${texte} → ${JSON.stringify(trouves)}`) }
  else console.log(`✅ détection ${trouves.length ? `(${trouves.join(', ')})` : '(rien)'} : ${texte.slice(0, 45)}…`)
}

console.log('\n--- PAYLOAD DE PUBLICATION (dernière barrière) ---')
{
  const fd = new FormData()
  fd.append('title', "Débouchage WC chez M. Dupont à Argenteuil")
  fd.append('description', "Intervention au 12 rue des Lilas à Argenteuil (95100).")
  fd.append('content', "<p>Nous sommes intervenus au 12 rue des Lilas à Argenteuil.</p>")
  fd.append('location', 'Argenteuil')
  fd.append('postal_code', '95100')
  fd.append('client_nom', 'Jean Dupont')
  fd.append('client_email', 'jean.dupont@example.com')
  fd.append('client_adresse', '12 rue des Lilas 95100 Argenteuil')
  fd.append('transcription', "Alors on est chez M. Dupont au 12 rue des Lilas…")
  fd.append('faq_json', JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [{ '@type': 'Question', name: "Où êtes-vous intervenus ?",
      acceptedAnswer: { '@type': 'Answer', text: "Au 12 rue des Lilas à Argenteuil, chez M. Dupont." } }],
  }))
  fd.append('before_image', new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' }))

  const { fd: sortie, retires } = anonymizePublishFormData(fd)
  const verifs: Array<[string, boolean]> = [
    ["identité du client non transmise", !['client_nom', 'client_email', 'client_adresse', 'transcription'].some((k) => sortie.has(k))],
    ["ville conservée", sortie.get('location') === 'Argenteuil'],
    ["code postal conservé", sortie.get('postal_code') === '95100'],
    ["titre anonymisé", !/Dupont/.test(String(sortie.get('title')))],
    ["description sans adresse", !/rue des Lilas/.test(String(sortie.get('description')))],
    ["contenu HTML sans adresse", !/rue des Lilas/.test(String(sortie.get('content')))],
    ["balises HTML préservées", /<p>.*<\/p>/.test(String(sortie.get('content')))],
    ["FAQ JSON nettoyée et re-sérialisable", (() => {
      const j = JSON.parse(String(sortie.get('faq_json')))
      const t = j.mainEntity[0].acceptedAnswer.text
      return !/Dupont|rue des Lilas/.test(t) && j['@type'] === 'FAQPage' && /Argenteuil/.test(t)
    })()],
    ["photo transmise intacte", sortie.get('before_image') instanceof File],
    ["retraits journalisés", retires.length > 0],
  ]
  for (const [libelle, ok] of verifs) {
    if (!ok) { echecs++; console.log(`❌ ${libelle}`) } else console.log(`✅ ${libelle}`)
  }
  console.log(`   (journal : ${retires.join(', ')})`)
}

console.log(echecs === 0 ? '\n✅ Tous les tests passent.' : `\n❌ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
