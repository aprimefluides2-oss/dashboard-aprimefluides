import { renderToFile, pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import { writeFileSync } from 'fs'
import { RealisationDocument, type PDFProps } from '../components/RealisationPDF'
import { DevisDocument, type DevisPDFProps } from '../components/DevisPDF'
import { FactureDocument, type FacturePDFProps } from '../components/FacturePDF'

const rapportProps: PDFProps = {
  clientNom: "M. et Mme Durand",
  adresse: "28 avenue Jean Jaurès",
  ville: "Roubaix",
  codePostal: "59100",
  dateIntervention: "2026-04-20",
  typeIntervention: "Débouchage canalisation",
  technicienNom: "Julien Moreau",
  phone: "06 42 18 55 03",
  reference: "APR-20260420",
  photos: [],
  rapport: {
    diagnostic: "Canalisation d'évacuation EU obstruée sur environ 4,5 mètres linéaires. Présence massive de graisses figées.",
    travaux_realises: "Débouchage mécanique au furet électrique 20m avec tête de coupe adaptée.",
    recommandations: "Installation d'un bac à graisses conforme.",
    commentaire_technicien: "Intervention réalisée dans de bonnes conditions.",
    objet: "Débouchage et diagnostic réseau d'évacuation cuisine professionnelle",
    contexte: "Appel urgent du client suite à des remontées d'eaux usées dans le sous-sol technique.",
    localisation: {
      zone: "Sous-sol technique — réseau EU intérieur",
      configuration: "Canalisation fonte ø100mm, pente insuffisante"
    },
    materiel_utilise: ["Furet électrique 20m", "Hydrocureur 200 bars"],
    duree_intervention: "2h15",
    conditions_intervention: "Accès par sous-sol technique.",
    phases: [
      { titre: "Diagnostic initial par caméra", statut: "critical", contexte: "Passage caméra.", action: "Inspection sur 8m.", resultat: "Obstruction localisée." },
      { titre: "Débouchage mécanique au furet", statut: "ok", contexte: "Furet électrique.", action: "3 passages successifs.", resultat: "Bouchon éliminé." },
      { titre: "Hydrocurage haute pression", statut: "ok", contexte: "Nettoyage complet.", action: "Hydrocurage 200 bars.", resultat: "Canalisation nettoyée." }
    ],
    avis_technique: {
      titre: "Réseau fonctionnel mais vulnérable",
      niveau: "critical",
      intro: "Le débouchage a permis de rétablir l'écoulement normal.",
      points_majeurs: ["Absence de bac à graisses", "Pente insuffisante"],
      diagnostic_final: "Le réseau est opérationnel mais à risque.",
      recommandation_urgente: "Installation immédiate d'un bac à graisses."
    },
    analyse_table: [
      { probleme: "Bouchon graisses", localisation: "3,5m-8m", description: "Accumulation massive", statut: "critical", label: "CRITIQUE" },
      { probleme: "Pente insuffisante", localisation: "5m-7m", description: "< 1%", statut: "warn", label: "À CORRIGER" },
    ],
    preconisations: [
      {
        tag: "URGENCE",
        titre: "Installation bac à graisses",
        items: [
          { k: "Nature", v: "Pose d'un bac 200L" },
          { k: "Délai", v: "Sous 15 jours" }
        ]
      }
    ]
  }
}

const devisProps: DevisPDFProps = {
  emetteur: {
    raisonSociale: "Aprime fluides",
    adresseLignes: ["1, rue Jean Carasso", "95870 Bezons"],
    telephone: "01 39 47 17 09",
    email: "contact@aprime-fluides.fr",
  },
  client: {
    nom: "M. EDREI",
    adresseLignes: ["1 place du Château", "01260 Cuzieu"],
    adresseChantier: "idem",
  },
  devis: {
    numero: "DV-20260423-001",
    date_devis: "2026-04-23",
    validite_jours: 30,
    majoration_note: "100 % après 17 h, week-ends & jours fériés",
    objet: "Travaux de remise en conformité du réseau d'évacuation : suppression de la fosse intermédiaire et création d'un raccordement direct.",
    reference_dossier: "Rapport d'intervention du 11/04/2026",
    lignes: [
      { section: "1. Suppression de la fosse septique", designation: "Pompage et vidange intégrale", description: "Évacuation effluents en filière agréée", qte: 1, unite: "forfait", pu_ht: 390 },
      { section: "1. Suppression de la fosse septique", designation: "Condamnation de la fosse", description: "Comblement au sable stabilisé", qte: 1, unite: "forfait", pu_ht: 1290 },
      { section: "2. Création du raccordement", designation: "Sciage de la dalle béton", description: "tranchée 8 ml, profondeur 40 cm", qte: 8, unite: "ml", pu_ht: 95 },
      { section: "2. Création du raccordement", designation: "Pose canalisation CR8 Ø125", qte: 8, unite: "ml", pu_ht: 115 },
    ],
    tva_taux: 10,
    tva_reduite_attestation: true,
    conditions: {
      validite: "30 jours à compter de la date d'établissement",
      delai_execution: "À convenir avec le client — sous 2 à 4 semaines après validation",
      duree_chantier: "3 à 5 jours ouvrés selon accès et météo",
      garanties: "Garantie décennale sur ouvrages enterrés · Garantie de parfait achèvement 1 an",
      assurance: "RC Pro et décennale Aprime fluides en cours de validité",
      particulieres: "Accès engin et zone de stockage à assurer par le client",
    },
    modalites: {
      acompte_pct: 30,
      modes_paiement: ["Chèque", "Virement bancaire", "Carte bancaire", "Espèces"],
    },
  },
}

const factureProps: FacturePDFProps = {
  emetteur: {
    raisonSociale: 'Aprime fluides',
    adresseLignes: ['1, rue Jean Carasso', '95870 Bezons'],
    telephone: '01 39 47 17 09',
    email: 'contact@aprime-fluides.fr',
  },
  client: {
    nom: 'SCI Exemple',
    adresseLignes: ['12 rue des Lilas', '95100 Argenteuil'],
  },
  phone: '01 39 47 17 09',
  facture: {
    numero: 'FA-20260429-2008',
    date_facture: '2026-04-29',
    echeance: 'Réglée',
    objet: 'Débouchage et curage colonne EU — immeuble collectif',
    reference_dossier: 'Rapport APR-20260420',
    tva_taux: 10,
    mode_reglement: 'Réglé par virement le 28/04/2026.',
    observations: 'Écoulement rétabli, contrôle caméra OK sur 12 m.',
    recommandation: 'Entretien annuel du réseau.',
    lignes: [
      { designation: 'Intervention débouchage', description: 'Furet + hydrocurage', qte: 1, unite: 'forfait', pu_ht: 420 },
      { designation: 'Inspection caméra', description: 'Compte-rendu vidéo', qte: 1, unite: 'forfait', pu_ht: 195 },
    ],
  },
}

async function main() {
  console.log('[renderToFile] rapport...')
  await renderToFile(createElement(RealisationDocument, rapportProps), '/tmp/test-rapport.pdf')
  console.log('  → /tmp/test-rapport.pdf')

  console.log('[renderToFile] devis...')
  await renderToFile(createElement(DevisDocument, devisProps), '/tmp/test-devis.pdf')
  console.log('  → /tmp/test-devis.pdf')

  console.log('[renderToFile] facture...')
  await renderToFile(createElement(FactureDocument, factureProps), '/tmp/test-facture.pdf')
  console.log('  → /tmp/test-facture.pdf')

  // Simule le chemin BROWSER : pdf(<Doc/>).toBlob()
  async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as any))
    return Buffer.concat(chunks)
  }

  console.log('[pdf().toBlob()-like] rapport (browser-path)...')
  const doc1 = pdf(createElement(RealisationDocument, rapportProps))
  const stream1 = await doc1.toBuffer()
  const buf1 = await collect(stream1 as any)
  writeFileSync('/tmp/test-rapport-browser.pdf', buf1)
  console.log('  → /tmp/test-rapport-browser.pdf size=', buf1.length)

  console.log('[pdf().toBlob()-like] devis (browser-path)...')
  const doc2 = pdf(createElement(DevisDocument, devisProps))
  const stream2 = await doc2.toBuffer()
  const buf2 = await collect(stream2 as any)
  writeFileSync('/tmp/test-devis-browser.pdf', buf2)
  console.log('  → /tmp/test-devis-browser.pdf size=', buf2.length)

  console.log('[pdf().toBlob()-like] facture (browser-path)...')
  const doc3 = pdf(createElement(FactureDocument, factureProps))
  const stream3 = await doc3.toBuffer()
  const buf3 = await collect(stream3 as any)
  writeFileSync('/tmp/test-facture-browser.pdf', buf3)
  console.log('  → /tmp/test-facture-browser.pdf size=', buf3.length)
}

main().catch(err => {
  console.error('FAIL:', err)
  process.exit(1)
})
