import { renderToFile } from '@react-pdf/renderer'
import { createElement } from 'react'
import { AttestationDocument, type AttestationData } from '../components/AttestationPDF'

async function render(v: 'tout-a-legout' | 'fosse-septique' | 'non-conforme', out: string) {
  const base: AttestationData = {
    numero: 'ATT-20260423-TEST',
    date: '2026-04-23',
    variante: v,
    nom: 'EDREI', prenom: 'M.',
    adresse: '1 place du Château',
    codePostal: '01260', ville: 'Cuzieu',
    technicienNom: 'Julien Moreau',
    objet: "Inspection du réseau d'évacuation des eaux usées de l'habitation, en vue d'établir un constat formel de son raccordement, à la demande du propriétaire dans le cadre d'une vente immobilière.",
    methode: "L'inspection a été menée le 23 avril 2026 en présence du propriétaire. Ouverture du regard principal en limite de propriété, passage d'une caméra endoscopique sur l'ensemble du tronçon accessible, relevé de pente et contrôle d'étanchéité par coloration.",
    observations: [
      { label: 'Regard principal accessible', valeur: 'Oui — en limite de propriété', statut: 'ok' },
      { label: 'Diamètre du collecteur', valeur: 'PVC Ø100 mm', statut: 'info' },
      { label: 'Pente relevée', valeur: '2,3 % régulière', statut: 'ok' },
      { label: 'Contre-pente', valeur: 'Aucune', statut: 'ok' },
      { label: 'Branchements parasites', valeur: 'Aucun constaté', statut: 'ok' },
    ],
    conclusion: v === 'non-conforme'
      ? "L'inspection révèle plusieurs non-conformités structurelles majeures du réseau d'évacuation, détaillées au chapitre « Anomalies constatées »."
      : "Le réseau d'évacuation se présente dans un état permettant un écoulement normal des effluents. Aucune anomalie structurelle n'a été constatée lors du passage caméra.",
    reserves: '',
  }

  if (v === 'fosse-septique') {
    (base as any).fosse = {
      volume_m3: '3 m³',
      etat: 'Correct, pas de dégradation visible',
      acces: 'Accès via tampon béton affleurant le jardin',
      derniere_vidange: 'Octobre 2024 (déclarée par le propriétaire)',
    }
  }
  if (v === 'non-conforme') {
    (base as any).anomalies = [
      'Présence d\'une fosse septique intermédiaire non déclarée à la vente.',
      'Fosse partiellement déformée, intégrité hydraulique compromise.',
      'Contre-pente relevée entre la sortie maison et la fosse (~1,5 % inversée sur 2 mètres).',
      'Raccordement abusif des eaux pluviales de toiture dans la fosse.',
    ];
    (base as any).recommandations = [
      'Suppression de la fosse intermédiaire après accord du service assainissement communal.',
      'Création d\'un raccordement direct au réseau public avec reprise des niveaux.',
      'Séparation des eaux pluviales et raccordement sur réseau EP dédié.',
      'Conservation intégrale du présent document à titre probatoire (art. 1641 C. civ.).',
    ]
  }

  await renderToFile(createElement(AttestationDocument, { data: base, photos: [] }), out)
  console.log('OK →', out)
}

async function main() {
  await render('tout-a-legout', '/tmp/test-att-A.pdf')
  await render('fosse-septique', '/tmp/test-att-B.pdf')
  await render('non-conforme', '/tmp/test-att-C.pdf')
}
main().catch(e => { console.error('FAIL:', e); process.exit(1) })
