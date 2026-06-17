/**
 * Catalogue technique pour les rapports d'inspection télévisée (ITV) de canalisations.
 * Codification simplifiée d'après NF EN 13508-2 (codification des inspections télévisuelles
 * des réseaux d'évacuation et d'assainissement extérieurs aux bâtiments).
 *
 * Les codes BA* couvrent les défauts structurels (état de la conduite),
 * les codes BB* couvrent les défauts fonctionnels (exploitation).
 */

export type DefautCategorie = 'structurel' | 'fonctionnel' | 'raccordement' | 'ras'

export type DefautCode = {
  code: string
  libelle: string
  categorie: DefautCategorie
  description: string
  /** Niveau de gravité indicatif : 1 = mineur · 2 = à surveiller · 3 = significatif · 4 = critique */
  gravite: 1 | 2 | 3 | 4
}

/** Défauts structurels (BA*) */
const STRUCTURELS: DefautCode[] = [
  { code: 'BAA', libelle: 'Déformation',                 categorie: 'structurel', gravite: 3, description: 'Variation de la section de la conduite : ovalisation, écrasement.' },
  { code: 'BAB', libelle: 'Fissure',                     categorie: 'structurel', gravite: 3, description: 'Fissure longitudinale, circonférentielle, complexe ou en hélice.' },
  { code: 'BAC', libelle: 'Cassure / Effondrement',      categorie: 'structurel', gravite: 4, description: 'Rupture du tube avec ou sans effondrement, perte de matière.' },
  { code: 'BAD', libelle: 'Brique / élément manquant',   categorie: 'structurel', gravite: 4, description: 'Élément constitutif manquant (brique, partie de tube).' },
  { code: 'BAE', libelle: 'Joint déboîté',               categorie: 'structurel', gravite: 3, description: 'Désaxement des éléments au niveau du joint, ouverture annulaire.' },
  { code: 'BAF', libelle: 'Joint déplacé / déformé',     categorie: 'structurel', gravite: 2, description: 'Joint apparent, écrasé ou pendant à l\'intérieur de la canalisation.' },
  { code: 'BAH', libelle: 'Raccordement défectueux',     categorie: 'raccordement', gravite: 3, description: 'Branchement mal exécuté : non étanche, mal raccordé, désaxé.' },
  { code: 'BAG', libelle: 'Branchement perforant',       categorie: 'raccordement', gravite: 3, description: 'Pénétration intrusive d\'un branchement à l\'intérieur du collecteur principal.' },
  { code: 'BAI', libelle: 'Trou / perforation',          categorie: 'structurel', gravite: 4, description: 'Trou traversant la paroi, perte d\'étanchéité.' },
  { code: 'BAJ', libelle: 'Corps étranger fixé',         categorie: 'structurel', gravite: 2, description: 'Objet enchâssé dans la paroi (béton, métal, outil…).' },
  { code: 'BAK', libelle: 'Corrosion / abrasion',        categorie: 'structurel', gravite: 3, description: 'Attaque chimique ou mécanique de la paroi : surface piquée, érosion du fil d\'eau.' },
  { code: 'BAL', libelle: 'Soudure défectueuse',         categorie: 'structurel', gravite: 2, description: 'Cordon de soudure incomplet, fissuré ou décalé (PE/PEHD, acier).' },
  { code: 'BAM', libelle: 'Revêtement endommagé',        categorie: 'structurel', gravite: 2, description: 'Détérioration du revêtement intérieur (mortier, résine, gainage existant).' },
]

/** Défauts fonctionnels (BB*) */
const FONCTIONNELS: DefautCode[] = [
  { code: 'BBA', libelle: 'Pénétration racinaire',       categorie: 'fonctionnel', gravite: 3, description: 'Racines fines, en chevelu ou massives obstruant la section.' },
  { code: 'BBB', libelle: 'Dépôts adhérents',            categorie: 'fonctionnel', gravite: 2, description: 'Dépôts gras, calcaire, tartre ou béton incrustés sur les parois.' },
  { code: 'BBC', libelle: 'Dépôts non adhérents',        categorie: 'fonctionnel', gravite: 2, description: 'Sables, graviers, sédiments libres dans le fil d\'eau.' },
  { code: 'BBD', libelle: 'Corps étrangers libres',      categorie: 'fonctionnel', gravite: 2, description: 'Objets non scellés (lingettes, plastiques, chiffons, gravats).' },
  { code: 'BBE', libelle: 'Infiltration',                categorie: 'fonctionnel', gravite: 3, description: 'Entrée d\'eau extérieure (nappe, eaux pluviales) par un défaut d\'étanchéité.' },
  { code: 'BBF', libelle: 'Exfiltration',                categorie: 'fonctionnel', gravite: 4, description: 'Fuite d\'effluents vers le sol — pollution potentielle.' },
  { code: 'BBG', libelle: 'Vermine',                     categorie: 'fonctionnel', gravite: 1, description: 'Présence de rongeurs ou blattes dans le réseau.' },
  { code: 'BBH', libelle: 'Contre-pente / défaut de pente', categorie: 'fonctionnel', gravite: 3, description: 'Stagnation d\'eau persistante traduisant une pente inversée ou nulle.' },
  { code: 'BBI', libelle: 'Réduction de section',        categorie: 'fonctionnel', gravite: 3, description: 'Section utile réduite par dépôts ou déformation : perte d\'écoulement.' },
]

const RAS: DefautCode = {
  code: 'RAS',
  libelle: 'Rien à signaler',
  categorie: 'ras',
  gravite: 1,
  description: 'Tronçon en bon état, écoulement normal, pas de désordre visible.',
}

export const DEFAUTS: DefautCode[] = [...STRUCTURELS, ...FONCTIONNELS, RAS]

export function findDefaut(code: string | null | undefined): DefautCode | null {
  if (!code) return null
  return DEFAUTS.find(d => d.code === code) || null
}

export const GRAVITE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Mineur',       color: '#6b7280' },
  2: { label: 'À surveiller', color: '#a16207' },
  3: { label: 'Significatif', color: '#c0392b' },
  4: { label: 'Critique',     color: '#7f1d1d' },
}

/** Matériaux de canalisation rencontrés en assainissement / EU / EP. */
export const MATERIAUX = [
  'PVC',
  'Fonte',
  'Grès',
  'Béton',
  'PE / PEHD',
  'Amiante-ciment',
  'Acier galvanisé',
  'Cuivre',
  'PRV (polyester)',
  'Inconnu / mixte',
] as const

/** Diamètres nominaux (mm) typiques en évacuation domestique et collectif. */
export const DIAMETRES = [
  'DN 40', 'DN 50', 'DN 63', 'DN 75', 'DN 80',
  'DN 100', 'DN 110', 'DN 125', 'DN 150', 'DN 160',
  'DN 200', 'DN 250', 'DN 300', 'DN 315',
  'DN 400', 'DN 500', 'DN 600', 'DN 800',
] as const

/** Type de réseau inspecté. */
export const RESEAUX = [
  'Eaux usées (EU)',
  'Eaux pluviales (EP)',
  'Unitaire (EU + EP)',
  'Branchement particulier',
  'Collecteur public',
  'Réseau intérieur bâtiment',
  'Réseau de drainage',
] as const

/** Matériel d'inspection utilisé. */
export const MATERIELS_INSPECTION = [
  'Caméra pousseuse (push-rod)',
  'Caméra autotractée (crawler / robot)',
  'Tête rotative panoramique',
  'Endoscope flexible',
  'Caméra haute résolution + télémètre',
] as const

/** Préconisations type — base de recommandations courantes. */
export type Preconisation = {
  id: string
  titre: string
  detail: string
  urgence: 'immediate' | 'court-terme' | 'preventive'
}

export const PRECONISATIONS: Preconisation[] = [
  { id: 'hydrocurage', titre: 'Hydrocurage haute pression',
    detail: 'Curage à la lance haute pression pour évacuer dépôts adhérents, racines fines et corps étrangers libres. Restitue la section utile.',
    urgence: 'court-terme' },
  { id: 'curage-mecanique', titre: 'Curage mécanique (furet, fraise, brosse rotative)',
    detail: 'Intervention mécanique pour racines massives, incrustations dures (béton, calcaire) ou bouchon ancien.',
    urgence: 'court-terme' },
  { id: 'reparation-ponctuelle', titre: 'Réparation ponctuelle par manchon (chemisage local)',
    detail: 'Mise en place d\'un manchon résiné ou inox sur la zone défectueuse — réparation sans tranchée, durée ~30 ans.',
    urgence: 'court-terme' },
  { id: 'gainage-continu', titre: 'Chemisage continu (gainage no-dig)',
    detail: 'Réhabilitation sans tranchée du tronçon par tubage souple polymérisé — restaure l\'étanchéité et la résistance mécanique.',
    urgence: 'court-terme' },
  { id: 'remplacement', titre: 'Remplacement par terrassement',
    detail: 'Ouverture, dépose de la canalisation existante et pose d\'un tube neuf. Solution lourde mais définitive en cas d\'effondrement ou de réseau hors d\'âge.',
    urgence: 'immediate' },
  { id: 'reprise-branchement', titre: 'Reprise de branchement / piquage',
    detail: 'Remise en conformité du raccordement défectueux ou perforant : meulage, pose d\'une selle de branchement étanche.',
    urgence: 'court-terme' },
  { id: 'reprise-pente', titre: 'Reprise de pente',
    detail: 'Décaissement et repose du tronçon avec pente conforme (≥ 1 cm/m en EU, ≥ 0,5 cm/m en EP).',
    urgence: 'court-terme' },
  { id: 'inspection-complementaire', titre: 'Inspection complémentaire après curage',
    detail: 'Re-passage caméra une fois le réseau curé pour évaluer précisément l\'état structurel masqué par les dépôts.',
    urgence: 'court-terme' },
  { id: 'surveillance', titre: 'Surveillance périodique',
    detail: 'Inspection ITV recommandée tous les 3 à 5 ans pour anticiper l\'évolution des désordres mineurs.',
    urgence: 'preventive' },
  { id: 'ras', titre: 'Aucune intervention nécessaire',
    detail: 'État du réseau jugé satisfaisant — pas de désordre structurel ni fonctionnel relevé.',
    urgence: 'preventive' },
]

/** Glossaire technique court — utile en pied de rapport. */
export const GLOSSAIRE: { terme: string; def: string }[] = [
  { terme: 'ITV', def: 'Inspection Télévisée des canalisations — passage caméra du réseau pour cartographie des désordres.' },
  { terme: 'DN',  def: 'Diamètre Nominal — référence du diamètre intérieur d\'une canalisation, exprimée en millimètres.' },
  { terme: 'Regard de visite', def: 'Ouvrage maçonné permettant l\'accès au réseau pour curage, inspection ou intervention.' },
  { terme: 'Linéaire', def: 'Longueur cumulée du réseau inspecté, exprimée en mètres.' },
  { terme: 'Fil d\'eau', def: 'Ligne théorique du fond de la canalisation où s\'écoulent les effluents.' },
  { terme: 'Hydrocurage', def: 'Curage par jet d\'eau haute pression (jusqu\'à 200 bars) — le plus efficace contre dépôts gras et racines fines.' },
  { terme: 'Chemisage', def: 'Réhabilitation sans tranchée par insertion d\'une gaine résinée polymérisée à l\'intérieur de la canalisation existante.' },
  { terme: 'Manchon', def: 'Chemisage ponctuel (1 à 3 m) appliqué sur une zone localisée — alternative légère au gainage continu.' },
  { terme: 'EN 13508-2', def: 'Norme européenne de codification des défauts observés lors des inspections télévisuelles des réseaux.' },
]
