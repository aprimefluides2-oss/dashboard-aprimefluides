'use client'
import React from "react"
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer"

/* ============ CHARTE ============ */
const C = {
  navy: '#1e3a6f',
  navyDark: '#142a52',
  navyMid: '#2d4f8f',
  red: '#c0392b',
  rowAlt: '#eaf1fa',
  rowSoft: '#f2f6fb',
  border: '#d9dfe7',
  text: '#1e293b',
  muted: '#6b7280',
  white: '#ffffff',
  bgSoft: '#f6f8fb',
}

/* ============ STYLES ============ */
const s = StyleSheet.create({
  page: {
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.text,
    backgroundColor: C.white,
    lineHeight: 1.45,
  },
  /* Header (flow-placed + fixed) */
  headerTop: {
    paddingHorizontal: 40, paddingTop: 18, paddingBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.white,
    borderBottomWidth: 2, borderBottomColor: C.red,
  },
  brandRow: { flexDirection: 'row', alignItems: 'baseline' },
  brandName: {
    color: C.navy, fontSize: 11, fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.4, marginRight: 8,
  },
  brandTag: { color: C.muted, fontSize: 8 },
  headerPhone: { color: C.text, fontSize: 8.5, fontFamily: 'Helvetica-Oblique' },

  content: { paddingHorizontal: 40, paddingTop: 10, paddingBottom: 10, flexGrow: 1 },

  /* Title block */
  titleBlock: {
    flexDirection: 'row', marginTop: 4, marginBottom: 14,
  },
  titleRedBar: { width: 6, backgroundColor: C.red },
  titleInner: {
    flex: 1, backgroundColor: C.navy,
    paddingVertical: 18, paddingHorizontal: 22,
  },
  titleMain: {
    color: C.white, fontSize: 22, fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1.15,
  },
  titleSub: { color: '#c8d4e8', fontSize: 10, marginTop: 10, lineHeight: 1.4 },

  /* Émetteur / Client header table */
  partyTable: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: C.border, marginBottom: 14,
  },
  partyCol: { flex: 1 },
  partyColSep: { borderRightWidth: 1, borderRightColor: C.border },
  partyHead: {
    backgroundColor: C.navy, paddingVertical: 7, paddingHorizontal: 12,
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    letterSpacing: 0.5,
  },
  partyBody: {
    paddingVertical: 10, paddingHorizontal: 12,
  },
  partyName: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 4 },
  partyLine: { color: C.text, fontSize: 9, marginBottom: 2, lineHeight: 1.4 },
  partyLabel: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 6, marginBottom: 2 },
  partyMuted: { color: C.muted, fontSize: 8.5, marginTop: 6 },

  /* Section band */
  bandNavy: {
    backgroundColor: C.navy, paddingVertical: 8, paddingHorizontal: 14,
    marginTop: 10, marginBottom: 0,
  },
  bandRed: {
    backgroundColor: C.red, paddingVertical: 8, paddingHorizontal: 14,
    marginTop: 14, marginBottom: 0,
  },
  bandTeal: {
    backgroundColor: '#0d9488', paddingVertical: 8, paddingHorizontal: 14,
    marginTop: 14, marginBottom: 0,
  },
  bandTxt: {
    color: C.white, fontSize: 10, fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },

  /* Objet (text box under band) */
  objetBox: {
    borderWidth: 1, borderColor: C.border, borderTopWidth: 0,
    backgroundColor: C.rowSoft,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 10,
  },
  objetText: { color: C.text, fontSize: 9.5, lineHeight: 1.5 },

  /* Constats (conforme / critique / non garantie) */
  constatItem: {
    borderWidth: 1, borderColor: C.border, borderTopWidth: 0,
    paddingVertical: 10, paddingHorizontal: 12,
    marginBottom: 0,
  },
  constatItemLast: { marginBottom: 10 },
  constatTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: C.navy, marginBottom: 4 },
  constatLoc: { fontSize: 8.5, color: C.muted, marginBottom: 4 },
  constatDesc: { fontSize: 9, color: C.text, lineHeight: 1.45 },

  /* Devis table */
  devisTable: {
    borderWidth: 1, borderColor: C.border,
    marginTop: 8, marginBottom: 12,
  },
  devisHead: {
    flexDirection: 'row', backgroundColor: C.navy,
  },
  devisHeadCell: {
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    paddingVertical: 9, paddingHorizontal: 10,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  devisSectionRow: {
    flexDirection: 'row', backgroundColor: C.rowAlt,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  devisSectionCell: {
    width: '100%', paddingVertical: 6, paddingHorizontal: 12,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
  },
  devisLine: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border,
  },
  devisDesig: {
    paddingVertical: 9, paddingHorizontal: 10,
    color: C.text, fontSize: 9, lineHeight: 1.45,
  },
  devisDesigStrong: { fontFamily: 'Helvetica-Bold', color: C.text },
  devisDesigMuted: { color: C.muted, fontSize: 8.5 },
  devisCell: {
    paddingVertical: 9, paddingHorizontal: 10,
    color: C.text, fontSize: 9, textAlign: 'right',
  },
  devisCellC: { textAlign: 'center' },

  /* Totaux (right-aligned) */
  totauxWrap: {
    alignSelf: 'flex-end',
    width: '52%',
    borderWidth: 1, borderColor: C.border,
    marginBottom: 14,
  },
  totauxRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  totauxRowLast: { borderBottomWidth: 0 },
  totauxRowTtc: { backgroundColor: C.navy, borderBottomWidth: 0 },
  totauxLbl: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  totauxV: { color: C.text, fontSize: 9 },
  totauxLblTtc: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 10.5 },
  totauxVTtc: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 11 },

  /* Conditions table */
  condTable: {
    borderWidth: 1, borderColor: C.border,
    marginBottom: 12,
  },
  condRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  condRowLast: { borderBottomWidth: 0 },
  condLabel: {
    width: '35%', paddingVertical: 9, paddingHorizontal: 12,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  condValue: {
    flex: 1, paddingVertical: 9, paddingHorizontal: 12,
    color: C.text, fontSize: 9, lineHeight: 1.45,
  },

  /* Modalités box */
  modalitesBox: {
    borderWidth: 1, borderColor: C.border, borderTopWidth: 0,
    padding: 14, marginBottom: 10,
  },
  modalitesP: {
    color: C.text, fontSize: 9.5, marginBottom: 6, lineHeight: 1.5,
  },
  modalitesStrong: { fontFamily: 'Helvetica-Bold' },
  modalitesMuted: {
    color: C.muted, fontSize: 8, marginTop: 4, lineHeight: 1.4, fontStyle: 'italic',
  },

  /* Attestation TVA */
  attestation: {
    color: C.text, fontSize: 8.5, fontFamily: 'Helvetica-Oblique',
    lineHeight: 1.5, marginVertical: 12,
  },
  attestationStrong: { fontFamily: 'Helvetica-BoldOblique' },

  /* Signature 2-col table */
  sigTable: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: C.border,
    marginTop: 6, marginBottom: 10,
  },
  sigCol: { flex: 1 },
  sigColSep: { borderRightWidth: 1, borderRightColor: C.border },
  sigHead: {
    backgroundColor: C.navy,
    paddingVertical: 7, paddingHorizontal: 12,
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 9,
  },
  sigBody: {
    paddingVertical: 14, paddingHorizontal: 12, minHeight: 90,
  },
  sigLine: { color: C.text, fontSize: 9, marginBottom: 10 },
  sigMention: { color: C.text, fontSize: 9, marginBottom: 6 },
  sigMentionStrong: { fontFamily: 'Helvetica-Bold' },

  /* Footer (flow-placed + fixed) */
  footer: {
    paddingHorizontal: 40, paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.white,
  },
  footerL: { color: C.muted, fontSize: 7.5, lineHeight: 1.4 },
  footerR: { color: C.muted, fontSize: 7.5, textAlign: 'right' },
})

/* ============ TYPES ============ */
export interface DevisConstatItem {
  intitule: string
  localisation?: string
  description: string
}

export interface DevisLineData {
  section?: string            // Titre de section (ex: "1. Suppression de la fosse septique")
  designation: string         // Désignation principale
  description?: string        // Précisions additionnelles (souvent entre parenthèses)
  qte: number
  unite?: string              // 'forfait', 'ml', 'm²', 'u', 'h'...
  pu_ht: number
}

export interface DevisConditions {
  validite?: string
  delai_execution?: string
  duree_chantier?: string
  garanties?: string
  assurance?: string
  particulieres?: string
}

export interface DevisModalites {
  acompte_pct?: number        // % (défaut 30)
  modes_paiement?: string[]
}

export interface DevisData {
  numero: string              // "DV-20260422-001"
  date_devis: string          // ISO ou "JJ/MM/AAAA" — sera formaté
  validite_jours?: number     // défaut 30
  majoration_note?: string    // "100 % après 17 h, week-ends & jours fériés" ou ""
  objet: string               // Paragraphe explicatif
  reference_dossier?: string  // ex: "Rapport d'intervention du 11/04/2026"
  lignes: DevisLineData[]
  tva_taux?: number           // 10 ou 20 (défaut 10)
  tva_reduite_attestation?: boolean   // si true, affiche paragraphe attestation
  conditions?: DevisConditions
  modalites?: DevisModalites
  constats_conformes?: DevisConstatItem[]
  constats_critiques?: DevisConstatItem[]
  non_garantie?: string
}

export interface EmetteurData {
  raisonSociale: string
  adresseLignes: string[]     // ["6 allée ...", "42000 Saint-Étienne"]
  telephone: string
  email: string
  rcs?: string
  capital?: string
  siret?: string
  tva?: string
}

export interface ClientData {
  nom: string                 // "M. EDREI"
  adresseLignes: string[]     // ["1 place du Château", "01 Cuzieu"]
  adresseChantier?: string    // "idem" ou autre
}

export interface DevisPDFProps {
  emetteur: EmetteurData
  client: ClientData
  devis: DevisData
  phone?: string              // Téléphone affiché dans le header (défaut = emetteur.telephone)
}

/* ============ HELPERS ============ */
const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[\u00A0\u202F\u2007\u2009\u200A]/g, ' ') + ' €'

const fmtDateFR = (raw: string) => {
  if (!raw) return ''
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return raw
}

/* Group lines by section (preserving order of first occurrence) */
function groupBySection(lines: DevisLineData[]): { section: string; items: DevisLineData[] }[] {
  const order: string[] = []
  const map = new Map<string, DevisLineData[]>()
  lines.forEach(l => {
    const key = l.section || 'Prestations'
    if (!map.has(key)) { map.set(key, []); order.push(key) }
    map.get(key)!.push(l)
  })
  return order.map(section => ({ section, items: map.get(section)! }))
}

const Header = ({ emetteur, phone }: { emetteur: EmetteurData; phone?: string }) => (
  <View style={s.headerTop} fixed>
    <View style={s.brandRow}>
      <Text style={s.brandName}>Aprime fluides</Text>
      <Text style={s.brandTag}>Assainissement · Débouchage · Pompage · Inspection caméra</Text>
    </View>
    <Text style={s.headerPhone}>Tél. {phone || emetteur.telephone}</Text>
  </View>
)

const Footer = ({ emetteur }: { emetteur: EmetteurData }) => {
  const line1 = [
    emetteur.raisonSociale,
    ...emetteur.adresseLignes,
  ].filter(Boolean).join(' · ')
  const line2 = [
    emetteur.capital ? `Capital ${emetteur.capital}` : '',
    emetteur.rcs || '',
    emetteur.email || '',
  ].filter(Boolean).join(' · ')
  return (
    <View style={s.footer} fixed>
      <View>
        <Text style={s.footerL}>{line1}</Text>
        {line2 ? <Text style={s.footerL}>{line2}</Text> : null}
      </View>
      <Text style={s.footerR} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  )
}

/* ============ DOCUMENT ============ */
export function DevisDocument({ emetteur, client, devis, phone }: DevisPDFProps) {
  const validite = devis.validite_jours ?? 30
  const dateFmt = fmtDateFR(devis.date_devis)
  const tvaTaux = devis.tva_taux ?? 10

  const totalHT = devis.lignes.reduce((sum, l) => sum + l.pu_ht * l.qte, 0)
  const tva = totalHT * tvaTaux / 100
  const totalTTC = totalHT + tva

  const acomptePct = devis.modalites?.acompte_pct ?? 30
  const acompteTTC = totalTTC * acomptePct / 100
  const soldePct = 100 - acomptePct
  const soldeTTC = totalTTC - acompteTTC

  const modesPaiement = devis.modalites?.modes_paiement && devis.modalites.modes_paiement.length > 0
    ? devis.modalites.modes_paiement
    : ['Chèque', 'Virement bancaire', 'Carte bancaire', 'Espèces (dans la limite légale)']

  const sections = groupBySection(devis.lignes)

  const subTitle = [
    `N° ${devis.numero}`,
    `établi le ${dateFmt}`,
    `valable ${validite} jours`,
    devis.majoration_note ? `majoration ${devis.majoration_note}` : '',
  ].filter(Boolean).join(' · ')

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header emetteur={emetteur} phone={phone} />

        <View style={s.content}>
          {/* ===== Title ===== */}
          <View style={s.titleBlock} wrap={false}>
            <View style={s.titleRedBar} />
            <View style={s.titleInner}>
              <Text style={s.titleMain}>Devis estimatif</Text>
              <Text style={s.titleSub}>{subTitle}</Text>
            </View>
          </View>

          {/* ===== Émetteur / Client ===== */}
          <View style={s.partyTable} wrap={false}>
            <View style={[s.partyCol, s.partyColSep]}>
              <Text style={s.partyHead}>ÉMETTEUR</Text>
              <View style={s.partyBody}>
                <Text style={s.partyName}>{emetteur.raisonSociale}</Text>
                {emetteur.adresseLignes.map((l, i) => (
                  <Text key={i} style={s.partyLine}>{l}</Text>
                ))}
                <Text style={s.partyLine}>Tél. {emetteur.telephone}</Text>
                <Text style={s.partyLine}>{emetteur.email}</Text>
                {emetteur.rcs ? <Text style={s.partyMuted}>{emetteur.rcs}</Text> : null}
                {emetteur.siret ? <Text style={s.partyMuted}>SIRET {emetteur.siret}</Text> : null}
              </View>
            </View>
            <View style={s.partyCol}>
              <Text style={s.partyHead}>CLIENT</Text>
              <View style={s.partyBody}>
                <Text style={s.partyName}>{client.nom}</Text>
                {client.adresseLignes.map((l, i) => (
                  <Text key={i} style={s.partyLine}>{l}</Text>
                ))}
                {client.adresseChantier ? (
                  <>
                    <Text style={s.partyLabel}>Adresse du chantier :</Text>
                    <Text style={s.partyLine}>{client.adresseChantier}</Text>
                  </>
                ) : null}
                {devis.reference_dossier ? (
                  <Text style={[s.partyLine, { marginTop: 6 }]}>
                    <Text style={s.modalitesStrong}>Réf. dossier : </Text>
                    {devis.reference_dossier}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* ===== Objet ===== */}
          {devis.objet ? (
            <View wrap={false}>
              <View style={s.bandNavy}>
                <Text style={s.bandTxt}>Objet du devis</Text>
              </View>
              <View style={s.objetBox}>
                <Text style={s.objetText}>{devis.objet}</Text>
              </View>
            </View>
          ) : null}

          {/* ===== Constats conformes ===== */}
          {(devis.constats_conformes?.length ?? 0) > 0 ? (
            <View>
              <View style={s.bandTeal} wrap={false}>
                <Text style={s.bandTxt}>Conforme</Text>
              </View>
              {devis.constats_conformes!.map((row, i) => (
                <View
                  key={i}
                  style={[
                    s.constatItem,
                    i === devis.constats_conformes!.length - 1 ? s.constatItemLast : {},
                  ]}
                  wrap={false}
                >
                  <Text style={s.constatTitle}>{row.intitule}</Text>
                  {row.localisation ? <Text style={s.constatLoc}>{row.localisation}</Text> : null}
                  <Text style={s.constatDesc}>{row.description}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ===== Constats critiques ===== */}
          {(devis.constats_critiques?.length ?? 0) > 0 ? (
            <View>
              <View style={s.bandRed} wrap={false}>
                <Text style={s.bandTxt}>Critique</Text>
              </View>
              {devis.constats_critiques!.map((row, i) => (
                <View
                  key={i}
                  style={[
                    s.constatItem,
                    i === devis.constats_critiques!.length - 1 ? s.constatItemLast : {},
                  ]}
                  wrap={false}
                >
                  <Text style={s.constatTitle}>{row.intitule}</Text>
                  {row.localisation ? <Text style={s.constatLoc}>{row.localisation}</Text> : null}
                  <Text style={s.constatDesc}>{row.description}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ===== Non garantie ===== */}
          {devis.non_garantie ? (
            <View wrap={false}>
              <View style={s.bandNavy}>
                <Text style={s.bandTxt}>Non garantie suite à notre intervention</Text>
              </View>
              <View style={s.objetBox}>
                <Text style={s.objetText}>{devis.non_garantie}</Text>
              </View>
            </View>
          ) : null}

          {/* ===== Tableau désignation ===== */}
          <View style={s.devisTable}>
            <View style={s.devisHead} fixed>
              <Text style={[s.devisHeadCell, { width: '52%' }]}>Désignation</Text>
              <Text style={[s.devisHeadCell, { width: '10%', textAlign: 'center' }]}>Qté</Text>
              <Text style={[s.devisHeadCell, { width: '12%', textAlign: 'center' }]}>Unité</Text>
              <Text style={[s.devisHeadCell, { width: '13%', textAlign: 'right' }]}>P.U. H.T.</Text>
              <Text style={[s.devisHeadCell, { width: '13%', textAlign: 'right' }]}>Total H.T.</Text>
            </View>

            {sections.map((sec, si) => (
              <View key={si}>
                <View style={s.devisSectionRow}>
                  <Text style={s.devisSectionCell}>{sec.section}</Text>
                </View>
                {sec.items.map((l, li) => (
                  <View key={li} style={s.devisLine} wrap={false}>
                    <View style={{ width: '52%' }}>
                      <Text style={[s.devisDesig, s.devisDesigStrong]}>{l.designation}</Text>
                      {l.description ? (
                        <Text style={[s.devisDesig, s.devisDesigMuted, { paddingTop: 0 }]}>{l.description}</Text>
                      ) : null}
                    </View>
                    <Text style={[s.devisCell, s.devisCellC, { width: '10%' }]}>{l.qte}</Text>
                    <Text style={[s.devisCell, s.devisCellC, { width: '12%' }]}>{l.unite || '—'}</Text>
                    <Text style={[s.devisCell, { width: '13%' }]}>{fmtEur(l.pu_ht)}</Text>
                    <Text style={[s.devisCell, { width: '13%' }]}>{fmtEur(l.pu_ht * l.qte)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* ===== Totaux ===== */}
          <View style={s.totauxWrap} wrap={false}>
            <View style={s.totauxRow}>
              <Text style={s.totauxLbl}>Total H.T.</Text>
              <Text style={s.totauxV}>{fmtEur(totalHT)}</Text>
            </View>
            <View style={s.totauxRow}>
              <Text style={s.totauxLbl}>Majoration</Text>
              <Text style={s.totauxV}>—</Text>
            </View>
            <View style={s.totauxRow}>
              <Text style={s.totauxLbl}>
                TVA {tvaTaux} %{devis.tva_reduite_attestation ? ' (taux réduit — travaux d\'amélioration)' : ''}
              </Text>
              <Text style={s.totauxV}>{fmtEur(tva)}</Text>
            </View>
            <View style={[s.totauxRow, s.totauxRowTtc, s.totauxRowLast]}>
              <Text style={s.totauxLblTtc}>MONTANT T.T.C.</Text>
              <Text style={s.totauxVTtc}>{fmtEur(totalTTC)}</Text>
            </View>
          </View>

          {/* ===== Conditions d'exécution ===== */}
          {devis.conditions ? (
            <View>
              <View style={s.bandNavy} wrap={false}>
                <Text style={s.bandTxt}>Conditions d&apos;exécution</Text>
              </View>
              <View style={s.condTable}>
                {[
                  { k: 'Validité du devis', v: devis.conditions.validite || `${validite} jours à compter de la date d'établissement` },
                  { k: "Délai d'exécution", v: devis.conditions.delai_execution || '—' },
                  { k: 'Durée estimée du chantier', v: devis.conditions.duree_chantier || '—' },
                  { k: 'Garanties', v: devis.conditions.garanties || '—' },
                  { k: 'Assurance', v: devis.conditions.assurance || '—' },
                  { k: 'Conditions particulières', v: devis.conditions.particulieres || '—' },
                ].map((row, i, arr) => (
                  <View key={i} style={[s.condRow, i === arr.length - 1 ? s.condRowLast : {}]} wrap={false}>
                    <Text style={s.condLabel}>{row.k}</Text>
                    <Text style={s.condValue}>{row.v}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* ===== Modalités de règlement ===== */}
          <View>
            <View style={s.bandRed} wrap={false}>
              <Text style={s.bandTxt}>Modalités de règlement</Text>
            </View>
            <View style={s.modalitesBox}>
              <Text style={s.modalitesP}>
                <Text style={s.modalitesStrong}>Acompte à la commande : </Text>
                {acomptePct} % soit {fmtEur(acompteTTC)} TTC
              </Text>
              <Text style={s.modalitesP}>
                <Text style={s.modalitesStrong}>Solde : </Text>
                {soldePct} % soit {fmtEur(soldeTTC)} TTC à la réception des travaux
              </Text>
              <Text style={s.modalitesP}>
                <Text style={s.modalitesStrong}>Modes de paiement acceptés : </Text>
                {modesPaiement.join(' · ')}
              </Text>
              <Text style={s.modalitesMuted}>
                Indemnité forfaitaire de recouvrement en cas de retard de paiement : 40 € (art. L441-10 C. com.) · Pas d&apos;escompte pour règlement anticipé.
              </Text>
            </View>
          </View>

          {/* ===== Attestation TVA 10% ===== */}
          {devis.tva_reduite_attestation ? (
            <Text style={s.attestation}>
              Je soussigné <Text style={s.attestationStrong}>{client.nom}</Text> atteste par la présente que les travaux qui font l&apos;objet du présent devis sont réalisés à l&apos;adresse précitée, à usage d&apos;habitation à plus de 50 % et que la construction est achevée depuis plus de 2 ans (attestation permettant l&apos;application du taux réduit de TVA à 10 %, art. 279-0 bis du CGI).
            </Text>
          ) : null}

          {/* ===== Signatures ===== */}
          <View style={s.sigTable} wrap={false}>
            <View style={[s.sigCol, s.sigColSep]}>
              <Text style={s.sigHead}>{emetteur.raisonSociale}</Text>
              <View style={s.sigBody}>
                <Text style={s.sigLine}>Date : {dateFmt}</Text>
                <Text style={s.sigLine}>Cachet &amp; signature :</Text>
              </View>
            </View>
            <View style={s.sigCol}>
              <Text style={s.sigHead}>Client — Bon pour accord, devis approuvé</Text>
              <View style={s.sigBody}>
                <Text style={s.sigMention}>
                  <Text style={s.sigMentionStrong}>{client.nom}</Text>
                </Text>
                <Text style={s.sigLine}>Date : ______________________</Text>
                <Text style={s.sigMention}>
                  Mention « <Text style={s.sigMentionStrong}>Bon pour accord</Text> » + signature :
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Footer emetteur={emetteur} />
      </Page>
    </Document>
  )
}

interface DownloadButtonProps extends DevisPDFProps {
  filename?: string
}

export default function DevisDownloadButton(props: DownloadButtonProps) {
  const filename = props.filename || `devis-${(props.client.nom || 'client').toLowerCase().replace(/\s+/g, '-')}-${props.devis.numero}.pdf`
  return (
    <PDFDownloadLink document={<DevisDocument {...props} />} fileName={filename}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="bg-blue-800 text-white px-4 py-2 rounded-lg hover:bg-blue-900 disabled:opacity-50 font-semibold"
        >
          {loading ? 'Génération PDF...' : '⬇ Télécharger le devis PDF'}
        </button>
      )}
    </PDFDownloadLink>
  )
}
