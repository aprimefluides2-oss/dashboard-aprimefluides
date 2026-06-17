'use client'
import dynamic from "next/dynamic"
import { useState, useEffect } from "react"
import type { PDFProps } from "@/components/RealisationPDF"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

const PDFPreviewModal = dynamic(() => import("@/components/PDFPreviewModal"), { ssr: false })
const PDFDownloadButton = dynamic(() => import("@/components/RealisationPDF"), { ssr: false })

const sampleData: PDFProps = {
  clientNom: "M. et Mme Durand",
  adresse: "28 avenue Jean Jaurès",
  ville: "Roubaix",
  codePostal: "59100",
  dateIntervention: "2026-04-20",
  typeIntervention: "Débouchage canalisation",
  technicienNom: "Julien Moreau",
  phone: TEL_PRINCIPAL_FALLBACK,
  reference: "LTDB-20260420",
  photos: [],
  rapport: {
    diagnostic: "Canalisation d'évacuation EU obstruée sur environ 4,5 mètres linéaires. Présence massive de graisses figées, dépôts calcaires et résidus alimentaires dans la canalisation fonte ø100. Refoulement constaté au niveau de l'évier cuisine et remontées d'eau en sous-sol technique.",
    travaux_realises: "Débouchage mécanique au furet électrique 20m avec tête de coupe adaptée. Hydrocurage haute pression 200 bars sur l'ensemble du tronçon affecté. Rinçage complet du réseau. Vérification du bon écoulement par test de débit et inspection visuelle.",
    recommandations: "Installation d'un bac à graisses conforme aux normes restauration (obligatoire). Planifier un curage préventif annuel du réseau EU. Remplacement du joint défectueux sur le regard EP n°2. Contrôle caméra du collecteur principal dans les 6 mois.",
    commentaire_technicien: "Intervention réalisée dans de bonnes conditions. Le client a été informé de l'urgence d'installer un bac à graisses. Le réseau est fonctionnel mais reste fragile en l'état.",
    objet: "Débouchage et diagnostic réseau d'évacuation cuisine professionnelle",
    contexte: "Appel urgent du client suite à des remontées d'eaux usées dans le sous-sol technique du restaurant. Évier cuisine professionnelle totalement bouché depuis la veille au soir. Activité du restaurant interrompue — intervention prioritaire demandée pour le matin.",
    localisation: {
      zone: "Sous-sol technique et cuisine professionnelle — réseau EU intérieur, tronçon évier vers colonne descente",
      configuration: "Canalisation fonte ø100mm, pente insuffisante sur 2 mètres (< 1%), 3 coudes à 90° successifs, regard accessible en sous-sol"
    },
    materiel_utilise: [
      "Furet électrique 20m avec tête de coupe ø80",
      "Hydrocureur haute pression 200 bars",
      "Caméra endoscopique pour contrôle post-intervention",
      "Débitmètre portatif pour test d'écoulement"
    ],
    duree_intervention: "2h15 (08h30 — 10h45)",
    conditions_intervention: "Accès par sous-sol technique, éclairage suffisant, ventilation correcte. Présence du responsable sur site.",
    phases: [
      {
        titre: "Diagnostic initial par caméra",
        statut: "critical" as const,
        contexte: "Passage de la caméra endoscopique depuis le regard sous-sol pour localiser précisément l'obstruction.",
        action: "Inspection sur 8 mètres linéaires du réseau EU depuis le regard jusqu'à la colonne de descente.",
        resultat: "Obstruction localisée entre 3,5m et 8m — bouchon compact de graisses et calcaire. Pente insuffisante identifiée entre 5m et 7m (< 1%)."
      },
      {
        titre: "Débouchage mécanique au furet",
        statut: "ok" as const,
        contexte: "Passage du furet électrique avec tête de coupe adaptée pour fragmenter le bouchon principal.",
        action: "3 passages successifs avec montée progressive du diamètre de la tête de coupe (40mm → 60mm → 80mm).",
        resultat: "Bouchon principal éliminé. Écoulement rétabli partiellement — résidus encore présents sur les parois."
      },
      {
        titre: "Hydrocurage haute pression",
        statut: "ok" as const,
        contexte: "Nettoyage complet des parois et élimination des résidus après débouchage mécanique.",
        action: "Hydrocurage à 200 bars sur l'ensemble du tronçon, passages aller-retour pour décoller les graisses adhérentes.",
        resultat: "Canalisation nettoyée sur toute la longueur. Débit restauré à 100%. Test d'écoulement concluant (2,8 L/s)."
      }
    ],
    avis_technique: {
      titre: "Réseau fonctionnel mais vulnérable — travaux complémentaires requis",
      niveau: "warn" as const,
      intro: "Le débouchage a permis de rétablir l'écoulement normal du réseau. Cependant, plusieurs facteurs de risque identifiés rendent une récidive probable sans intervention corrective.",
      points_majeurs: [
        "Absence de bac à graisses : non-conformité réglementaire pour un établissement de restauration, cause directe de l'obstruction récurrente",
        "Pente insuffisante sur 2 mètres : favorise la stagnation et l'accumulation de dépôts, ne peut être corrigée sans reprise partielle du réseau",
        "3 coudes à 90° consécutifs : configuration défavorable qui freine l'écoulement et piège les matières grasses",
        "Joint défectueux regard EP n°2 : risque d'infiltrations croisées EU/EP"
      ],
      diagnostic_final: "Le réseau est opérationnel à court terme mais présente un risque élevé de récidive dans les 3 à 6 mois sans mise en conformité. L'installation d'un bac à graisses est la priorité absolue.",
      recommandation_urgente: "Installation immédiate d'un bac à graisses conforme + curage préventif annuel. Devis joint au présent rapport."
    },
    analyse_table: [
      { probleme: "Bouchon graisses", localisation: "Tronçon 3,5m-8m", description: "Accumulation massive de graisses figées et calcaire obstruant 80% de la section", statut: "critical" as const, label: "CRITIQUE" },
      { probleme: "Pente insuffisante", localisation: "Tronçon 5m-7m", description: "Pente mesurée < 1% au lieu des 2% réglementaires — stagnation favorisée", statut: "warn" as const, label: "À CORRIGER" },
      { probleme: "Coudes à 90°", localisation: "Points 4m, 5,5m, 7m", description: "3 coudes successifs freinant l'écoulement — remplacement par coudes à 45° recommandé", statut: "warn" as const, label: "À PRÉVOIR" },
      { probleme: "Joint regard EP", localisation: "Regard n°2", description: "Joint torique dégradé, légère infiltration constatée — remplacement nécessaire", statut: "info" as const, label: "À PLANIFIER" },
      { probleme: "État canalisation", localisation: "Ensemble tronçon", description: "Fonte en état correct après nettoyage, pas de fissure ni corrosion avancée", statut: "ok" as const, label: "CONFORME" }
    ],
    preconisations: [
      {
        tag: "URGENCE — CONFORMITÉ",
        titre: "Installation bac à graisses",
        items: [
          { k: "Nature", v: "Pose d'un bac à graisses 200L en sortie de cuisine, conforme arrêté du 21/12/1993" },
          { k: "Délai", v: "Sous 15 jours — obligation réglementaire restauration" },
          { k: "Impact", v: "Réduit de 90% le risque d'obstruction par graisses" }
        ]
      },
      {
        tag: "PRÉVENTIF",
        titre: "Programme d'entretien annuel",
        items: [
          { k: "Curage", v: "Hydrocurage préventif 1×/an du réseau EU complet" },
          { k: "Contrôle", v: "Inspection caméra du collecteur principal dans 6 mois" },
          { k: "Regard EP", v: "Remplacement joint torique regard n°2" }
        ]
      }
    ],
    devis: {
      numero: "DV-LTDB-20260420",
      validite_jours: 30,
      tva_taux: 10,
      lignes: [
        { section: "Mise en conformité", designation: "Bac à graisses 200L inox", description: "Fourniture et pose, raccordement EU cuisine", qte: 1, pu_ht: 890 },
        { section: "Mise en conformité", designation: "Raccordement évacuation", description: "Adaptation tuyauterie PVC ø100 vers bac", qte: 1, pu_ht: 185 },
        { section: "Entretien préventif", designation: "Contrat curage annuel", description: "Hydrocurage HP réseau EU complet — 1 passage/an", qte: 1, pu_ht: 320 },
        { section: "Entretien préventif", designation: "Inspection caméra contrôle", description: "Inspection vidéo 15m avec rapport", qte: 1, pu_ht: 195 },
        { section: "Réparations", designation: "Remplacement joint regard EP n°2", description: "Joint torique ø200 + mise en étanchéité", qte: 1, pu_ht: 85 },
      ],
      conditions: [
        "Devis valable 30 jours à compter de la date d'émission",
        "Acompte de 30% à la commande, solde à la réception des travaux",
        "Travaux réalisés sous 15 jours après acceptation du devis",
        "Garantie décennale — attestation fournie sur demande",
        "TVA à taux réduit (10%) applicable aux travaux d'amélioration de l'habitat"
      ]
    }
  }
}

export default function PreviewPdfPage() {
  const [showModal, setShowModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#94a3b8', fontFamily: 'system-ui' }}>
      Chargement...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui', padding: 40 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>Preview PDF — LTDB</h1>
        <p style={{ color: '#94a3b8', marginBottom: 32, fontSize: 15 }}>
          Rapport de test avec données complètes (diagnostic, phases, avis technique, devis)
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
          <PDFDownloadButton {...sampleData} filename="preview-ltdb-rapport.pdf" />
          <button
            onClick={() => setShowModal(true)}
            style={{ background: '#1e40af', color: 'white', padding: '10px 20px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            👁 Aperçu PDF
          </button>
        </div>

        <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#60a5fa' }}>Données de test incluses :</h2>
          <ul style={{ color: '#94a3b8', lineHeight: 2, fontSize: 14, paddingLeft: 20 }}>
            <li><strong style={{ color: '#e2e8f0' }}>Client :</strong> M. et Mme Durand — 28 av. Jean Jaurès, 59100 Roubaix</li>
            <li><strong style={{ color: '#e2e8f0' }}>Type :</strong> Débouchage canalisation</li>
            <li><strong style={{ color: '#e2e8f0' }}>Technicien :</strong> Julien Moreau</li>
            <li><strong style={{ color: '#e2e8f0' }}>Contexte :</strong> Urgence restaurant — évier bouché, refoulement sous-sol</li>
            <li><strong style={{ color: '#e2e8f0' }}>3 phases :</strong> Diagnostic caméra → Furet → Hydrocurage</li>
            <li><strong style={{ color: '#e2e8f0' }}>5 anomalies :</strong> 1 critique, 2 attention, 1 info, 1 conforme</li>
            <li><strong style={{ color: '#e2e8f0' }}>Avis technique :</strong> Réseau fonctionnel mais vulnérable</li>
            <li><strong style={{ color: '#e2e8f0' }}>2 préconisations :</strong> Bac à graisses (urgence) + Entretien annuel</li>
            <li><strong style={{ color: '#e2e8f0' }}>Devis joint :</strong> 5 lignes — 1 675 € HT + TVA 10%</li>
          </ul>
        </div>
      </div>

      <PDFPreviewModal
        open={showModal}
        pdfProps={sampleData}
        onClose={() => setShowModal(false)}
      />
    </div>
  )
}
