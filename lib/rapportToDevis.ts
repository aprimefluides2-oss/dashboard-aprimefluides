import type { RapportData } from "@/components/RealisationPDF"
import type { DevisData, DevisLineData } from "@/components/DevisPDF"
import { detectTypeIntervention } from "@/lib/types-intervention"
import type { RapportToFactureSource } from "@/lib/rapportToFacture"

export type RapportToDevisPrefill = {
  client_nom: string
  client_prenom: string
  client_nom_famille: string
  client_adresse: string
  client_cp: string
  client_ville: string
  adresse_chantier: string
  reference_dossier: string
  client_email: string
  devis: DevisData
}

export function splitNomPrenom(nomComplet: string): { prenom: string; nomFamille: string } {
  const raw = (nomComplet || "").trim().replace(/^(m\.|mme|mr|mrs|monsieur|madame)\s+/i, "").trim()
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { prenom: "", nomFamille: "" }
  if (parts.length === 1) return { prenom: "", nomFamille: parts[0] }
  return { prenom: parts[0], nomFamille: parts.slice(1).join(" ") }
}

export function joinNomPrenom(prenom: string, nomFamille: string): string {
  return [prenom.trim(), nomFamille.trim()].filter(Boolean).join(" ").trim()
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function nextDevisNumero(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const seq = String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0")
  return `DV-${y}${m}${day}-${seq}`
}

function buildLignesDevis(rapport: RapportData, fallbackType: string): DevisLineData[] {
  const devisLignes = rapport.devis?.lignes
  if (Array.isArray(devisLignes) && devisLignes.length > 0) {
    return devisLignes
      .filter((l) => l?.designation)
      .map((l) => {
        const row = l as DevisLineData & { unite?: string }
        return {
          section: typeof row.section === "string" ? row.section : undefined,
          designation: String(row.designation).trim(),
          description: typeof row.description === "string" ? row.description : "",
          qte: Number.isFinite(Number(row.qte)) ? Number(row.qte) : 1,
          unite: typeof row.unite === "string" && row.unite.trim() ? row.unite : "forfait",
          pu_ht: Number.isFinite(Number(row.pu_ht)) ? Number(row.pu_ht) : 0,
        }
      })
  }

  const type =
    detectTypeIntervention(rapport.objet) ||
    detectTypeIntervention(rapport.travaux_realises) ||
    detectTypeIntervention(fallbackType) ||
    fallbackType ||
    "Intervention"

  return [
    {
      designation: type,
      description: "",
      qte: 1,
      unite: "forfait",
      pu_ht: 0,
    },
  ]
}

export function buildDevisFromRapport(src: RapportToFactureSource): RapportToDevisPrefill {
  const rapport = src.rapport
  const { prenom, nomFamille } = splitNomPrenom(src.client_nom || "")
  const date = src.date_intervention || todayISO()
  const refLabel = src.reference || rapport.reference || ""
  const reference_dossier = refLabel
    ? `Intervention ${refLabel}`
    : `Intervention du ${date.split("-").reverse().join("/")}`

  const objet =
    detectTypeIntervention(src.type_intervention) ||
    detectTypeIntervention(rapport.objet) ||
    src.type_intervention ||
    "Travaux complémentaires"

  const embedded = rapport.devis as Partial<DevisData> | null | undefined
  const devis: DevisData = {
    numero: embedded?.numero || nextDevisNumero(),
    date_devis: date,
    validite_jours: typeof embedded?.validite_jours === "number" ? embedded.validite_jours : 30,
    majoration_note: embedded?.majoration_note || "",
    objet: typeof embedded?.objet === "string" && embedded.objet.trim() ? embedded.objet : objet,
    reference_dossier,
    lignes: buildLignesDevis(rapport, objet),
    tva_taux: embedded?.tva_taux === 0 || embedded?.tva_taux === 20 ? embedded.tva_taux : 10,
    conditions: embedded?.conditions,
    modalites: embedded?.modalites,
    constats_conformes: embedded?.constats_conformes,
    constats_critiques: embedded?.constats_critiques,
    non_garantie: embedded?.non_garantie,
  }

  return {
    client_nom: joinNomPrenom(prenom, nomFamille),
    client_prenom: prenom,
    client_nom_famille: nomFamille,
    client_adresse: src.client_adresse || "",
    client_cp: src.client_code_postal || "",
    client_ville: src.client_ville || "",
    adresse_chantier: src.adresse_chantier || "idem",
    reference_dossier,
    client_email: src.client_email || "",
    devis,
  }
}
