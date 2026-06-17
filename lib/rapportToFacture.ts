import type { RapportData } from "@/components/RealisationPDF"
import type { FactureData, FactureLineData } from "@/components/FacturePDF"
import { detectTypeIntervention } from "@/lib/types-intervention"

export interface RapportToFactureSource {
  rapport: RapportData
  client_nom?: string | null
  client_email?: string | null
  client_adresse?: string | null
  client_code_postal?: string | null
  client_ville?: string | null
  adresse_chantier?: string | null
  type_intervention?: string | null
  date_intervention?: string | null
  reference?: string | null
}

export interface RapportToFacturePrefill {
  client_nom: string
  client_adresse: string
  client_cp: string
  client_ville: string
  adresse_chantier: string
  reference_dossier: string
  client_email: string
  facture: FactureData
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function nextNumero(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const seq = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0')
  return `FA-${y}${m}${day}-${seq}`
}

/**
 * Pour la facture, on veut une désignation COURTE et standardisée
 * (ex: "Débouchage canalisation"), PAS le contenu détaillé du rapport.
 * Le technicien complétera le prix manuellement ; le détail technique reste
 * dans le rapport d'intervention si besoin.
 */
function buildLignesFromRapport(rapport: RapportData, fallbackType: string): FactureLineData[] {
  const lignes: FactureLineData[] = []

  // 1) Lignes issues du devis du rapport (le technicien a chiffré).
  //    On garde les prix mais on remplace la désignation par le type d'intervention
  //    standardisé pour rester court et propre sur la facture.
  const devisLignes = rapport.devis?.lignes
  if (Array.isArray(devisLignes) && devisLignes.length > 0) {
    for (const l of devisLignes) {
      if (!l?.designation) continue
      // Détection prioritaire du type sur l'item lui-même, sinon fallback global
      const detected = detectTypeIntervention(l.designation) || detectTypeIntervention(fallbackType)
      const designation = detected || fallbackType || 'Intervention'
      lignes.push({
        designation,
        description: '',
        qte: Number.isFinite(Number(l.qte)) ? Number(l.qte) : 1,
        unite: 'forfait',
        pu_ht: Number.isFinite(Number(l.pu_ht)) ? Number(l.pu_ht) : 0,
        inclus: false,
      })
    }
  }

  // 2) À défaut : une ligne unique avec le libellé court du type d'intervention.
  if (lignes.length === 0) {
    const detected = detectTypeIntervention(rapport.objet)
      || detectTypeIntervention(rapport.travaux_realises)
      || detectTypeIntervention(fallbackType)
    lignes.push({
      designation: detected || fallbackType || 'Intervention',
      description: '',
      qte: 1,
      unite: 'forfait',
      pu_ht: 0,
      inclus: false,
    })
  }

  return lignes
}

function buildObservations(rapport: RapportData): string {
  // Priorité : diagnostic_final → diagnostic → commentaire technicien
  const candidates = [
    rapport.avis_technique?.diagnostic_final,
    rapport.diagnostic,
    rapport.commentaire_technicien,
  ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
  return candidates[0]?.trim() || ''
}

function buildRecommandation(rapport: RapportData): string {
  const candidates = [
    rapport.avis_technique?.recommandation_urgente,
    rapport.recommandations,
  ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
  return candidates[0]?.trim() || ''
}

/**
 * Construit un payload de facture pré-rempli à partir d'un rapport d'intervention.
 * Le payload est compatible avec celui que la page Devis → Facture stocke dans
 * sessionStorage (clé `ltdb_devis_to_facture`).
 */
export function buildFactureFromRapport(src: RapportToFactureSource): RapportToFacturePrefill {
  const rapport = src.rapport
  const numero = nextNumero()
  const date = src.date_intervention || todayISO()

  // Libellé court : on essaie d'inférer un type d'intervention standardisé
  // (ex: "Débouchage canalisation") plutôt que de recopier le rapport.
  const objet = detectTypeIntervention(src.type_intervention)
    || detectTypeIntervention(rapport.objet)
    || detectTypeIntervention(rapport.travaux_realises)
    || src.type_intervention
    || 'Intervention'

  const refLabel = src.reference || rapport.reference || ''
  const reference_dossier = refLabel
    ? `Rapport ${refLabel}`
    : `Rapport du ${date.split('-').reverse().join('/')}`

  const facture: FactureData = {
    numero,
    date_facture: date,
    echeance: 'À réception',
    objet,
    reference_dossier,
    lignes: buildLignesFromRapport(rapport, objet),
    tva_taux: 10,
    mode_reglement: '',
    observations: buildObservations(rapport),
    recommandation: buildRecommandation(rapport),
  }

  return {
    client_nom: src.client_nom || '',
    client_adresse: src.client_adresse || '',
    client_cp: src.client_code_postal || '',
    client_ville: src.client_ville || '',
    adresse_chantier: src.adresse_chantier || 'idem',
    reference_dossier,
    client_email: src.client_email || '',
    facture,
  }
}
