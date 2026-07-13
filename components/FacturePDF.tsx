'use client'
import React from "react"
import { Document, Page, Text, View, Image, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer"
import type { EmetteurData, ClientData } from "./DevisPDF"
import type { Agence } from "@/lib/agences"
import { getTechnicienSignature } from "@/lib/technicien-signature"

export type { Agence } from "@/lib/agences"
export { AGENCES } from "@/lib/agences"

/* ============ CHARTE ============ */
const C = {
  navy: '#1e3a6f',
  navyDark: '#142a52',
  red: '#c0392b',
  greenDark: '#0f5132',
  greenSoft: '#e8f3ec',
  greenBorder: '#a3c9b3',
  yellowDark: '#7c5e00',
  yellowSoft: '#fff8dc',
  yellowBorder: '#e8d384',
  rowAlt: '#eaf1fa',
  rowSoft: '#f2f6fb',
  border: '#d9dfe7',
  text: '#1e293b',
  muted: '#6b7280',
  white: '#ffffff',
  black: '#000000',
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
  /* Header */
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
    color: C.white, fontSize: 24, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1.15,
  },
  titleSub: { color: '#c8d4e8', fontSize: 10, marginTop: 10, lineHeight: 1.4 },

  /* Métadonnées (3 colonnes) */
  metaTable: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: C.border,
    marginBottom: 10,
  },
  metaCell: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 12,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  metaCellLast: { borderRightWidth: 0 },
  metaLabel: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  metaValue: { color: C.text, fontSize: 9, marginTop: 1 },
  metaValueRegle: { color: '#0f7a3b', fontFamily: 'Helvetica-Bold' },

  /* Émetteur / Client */
  partyTable: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: C.border, marginBottom: 14,
  },
  partyCol: { flex: 1 },
  partyColSep: { borderRightWidth: 1, borderRightColor: C.border },
  partyHead: {
    paddingVertical: 7, paddingHorizontal: 12,
    color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    letterSpacing: 0.5,
  },
  partyBody: {
    paddingVertical: 10, paddingHorizontal: 12,
  },
  partyName: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 4 },
  partyLine: { color: C.text, fontSize: 9, marginBottom: 2, lineHeight: 1.4 },
  partyLabel: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 6, marginBottom: 2 },
  agenceBar: { height: 5, backgroundColor: C.black, marginTop: 10, marginBottom: 6 },
  agenceText: { fontFamily: 'Helvetica-Oblique', fontSize: 9, color: C.text },

  /* Objet (ligne simple) */
  objetLine: { marginVertical: 8, fontSize: 9.5 },
  objetLabel: { fontFamily: 'Helvetica-Bold' },

  /* Tableau désignation */
  itemsTable: {
    borderWidth: 1, borderColor: C.border,
    marginTop: 8, marginBottom: 12,
  },
  itemsHead: {
    flexDirection: 'row', backgroundColor: C.navy,
  },
  itemsHeadCell: {
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    paddingVertical: 9, paddingHorizontal: 10,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  itemsLine: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border,
  },
  itemsDesig: {
    paddingVertical: 9, paddingHorizontal: 10,
    color: C.text, fontSize: 9, lineHeight: 1.45,
  },
  itemsDesigStrong: { fontFamily: 'Helvetica-Bold', color: C.text },
  itemsDesigMuted: { color: C.muted, fontSize: 8.5 },
  itemsCell: {
    paddingVertical: 9, paddingHorizontal: 10,
    color: C.text, fontSize: 9, textAlign: 'right',
  },
  itemsCellC: { textAlign: 'center' },
  itemsInclus: { color: C.muted, fontStyle: 'italic' },

  /* Totaux */
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

  /* Mode de règlement (vert) */
  reglementBox: {
    backgroundColor: C.greenSoft,
    borderWidth: 1, borderColor: C.greenBorder,
    borderLeftWidth: 4,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 12,
  },
  reglementTitle: {
    color: C.greenDark, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  reglementText: { color: C.text, fontSize: 9.5, lineHeight: 1.5 },

  /* Observations (jaune) */
  obsBox: {
    backgroundColor: C.yellowSoft,
    borderWidth: 1, borderColor: C.yellowBorder,
    borderLeftWidth: 4,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 12,
  },
  obsTitle: {
    color: C.yellowDark, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  obsText: { color: C.text, fontSize: 9.5, lineHeight: 1.55, marginBottom: 6 },
  obsStrong: { fontFamily: 'Helvetica-Bold' },

  /* Signature technicien */
  sigWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  sigCard: { width: 220, borderWidth: 1, borderColor: C.border },
  sigCardHead: {
    backgroundColor: C.rowAlt, paddingVertical: 6, paddingHorizontal: 10,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sigCardBody: { paddingVertical: 8, paddingHorizontal: 10, minHeight: 62 },
  sigCardName: { color: C.text, fontSize: 8.5, marginBottom: 3 },
  sigCardLabel: { color: C.muted, fontSize: 8, marginBottom: 2 },
  sigCardImg: { height: 40, width: 120, objectFit: 'contain', marginTop: 2 },

  /* Coordonnées bancaires (bleu) */
  ribBox: {
    backgroundColor: '#eef4fc',
    borderWidth: 1, borderColor: '#b9cce8',
    borderLeftWidth: 4, borderLeftColor: C.navy,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 12,
  },
  ribTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  ribRow: { flexDirection: 'row', marginBottom: 2 },
  ribLbl: { color: C.muted, fontSize: 9, width: 50 },
  ribVal: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9.5, letterSpacing: 0.5 },
  ribNote: { color: C.muted, fontSize: 8.5, marginTop: 4, fontStyle: 'italic' },

  /* Footer */
  footer: {
    paddingHorizontal: 40, paddingTop: 8, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.white,
  },
  footerBankRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingBottom: 6, marginBottom: 6,
    borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  footerBankCol: { fontSize: 7.5, color: C.text },
  footerBankLbl: { color: C.muted, fontFamily: 'Helvetica' },
  footerBankVal: { fontFamily: 'Helvetica-Bold', letterSpacing: 0.4 },
  footerBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerL: { color: C.muted, fontSize: 7.5, lineHeight: 1.4 },
  footerR: { color: C.muted, fontSize: 7.5, textAlign: 'right' },
})

/* ============ TYPES ============ */
export interface FactureLineData {
  designation: string
  description?: string
  qte: number
  unite?: string
  pu_ht: number
  inclus?: boolean
}

export interface FactureData {
  numero: string                  // "FA-YYYYMMDD-XXXX"
  date_facture: string            // ISO ou "JJ/MM/AAAA"
  echeance: string                // "Réglée" | "À réception" | "30 jours fin de mois" | date FR
  objet: string                   // ligne courte
  reference_dossier?: string
  lignes: FactureLineData[]
  tva_taux?: number               // 10 ou 20 (défaut 10)
  mode_reglement?: string         // ex: "Intervention réglée par carte bancaire le 29/04/2026."
  observations?: string           // constat technicien
  recommandation?: string         // conseil préventif (optionnel)
}

export interface FactureEmetteurData extends EmetteurData {
  agence?: Agence | string
}

export interface FacturePDFProps {
  emetteur: FactureEmetteurData
  client: ClientData
  facture: FactureData
  phone?: string
  /** Nom du technicien (défaut : localStorage `ltdb_technicien`). */
  technicienNom?: string
  /** Signature du technicien (image data URL ; défaut : localStorage device). */
  technicienSignature?: string | null
}

/* ============ HELPERS ============ */
const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[     ]/g, ' ') + ' €'

const fmtDateFR = (raw: string) => {
  if (!raw) return ''
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return raw
}

const Header = ({ emetteur, phone }: { emetteur: FactureEmetteurData; phone?: string }) => (
  <View style={s.headerTop} fixed>
    <View style={s.brandRow}>
      <Text style={s.brandName}>Aprime fluides</Text>
      <Text style={s.brandTag}>Assainissement · Débouchage · Pompage · Inspection caméra</Text>
    </View>
    <Text style={s.headerPhone}>Tél. {phone || emetteur.telephone}</Text>
  </View>
)

const Footer = ({ emetteur }: { emetteur: FactureEmetteurData }) => {
  const line1 = [
    emetteur.raisonSociale,
    ...emetteur.adresseLignes,
  ].filter(Boolean).join(' · ')
  const line2 = [
    emetteur.email || '',
    emetteur.telephone ? `Tél. ${emetteur.telephone}` : '',
  ].filter(Boolean).join(' · ')
  return (
    <View style={s.footer} fixed>
      {/* Coordonnées bancaires (toujours visibles en pied de page) */}
      <View style={s.footerBankRow}>
        <Text style={s.footerBankCol}>
          <Text style={s.footerBankLbl}>IBAN </Text>
          <Text style={s.footerBankVal}>FR76 1695 8000 0152 7256 3725 930</Text>
        </Text>
        <Text style={s.footerBankCol}>
          <Text style={s.footerBankLbl}>BIC </Text>
          <Text style={s.footerBankVal}>QNTOFRP1XXX</Text>
        </Text>
      </View>
      {/* Coordonnées société */}
      <View style={s.footerBottomRow}>
        <View>
          <Text style={s.footerL}>{line1}</Text>
          {line2 ? <Text style={s.footerL}>{line2}</Text> : null}
        </View>
        <Text style={s.footerR} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
      </View>
    </View>
  )
}

/* ============ DOCUMENT ============ */
export function FactureDocument({ emetteur, client, facture, phone, technicienNom, technicienSignature }: FacturePDFProps) {
  const sigImg = technicienSignature ?? getTechnicienSignature()
  const sigName = technicienNom
    ?? (typeof window !== 'undefined' ? (localStorage.getItem('ltdb_technicien') || '') : '')
  const dateFmt = fmtDateFR(facture.date_facture)
  const tvaTaux = facture.tva_taux ?? 10
  const echeanceVal = facture.echeance || 'À réception'
  const isRegle = /^r[ée]gl[ée]e?$/i.test(echeanceVal.trim())

  const totalHT = facture.lignes.reduce((sum, l) => {
    if (l.inclus) return sum
    return sum + (Number(l.pu_ht) || 0) * (Number(l.qte) || 0)
  }, 0)
  const tva = totalHT * tvaTaux / 100
  const totalTTC = totalHT + tva

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header emetteur={emetteur} phone={phone} />

        <View style={s.content}>
          {/* ===== Title ===== */}
          <View style={s.titleBlock} wrap={false}>
            <View style={s.titleRedBar} />
            <View style={s.titleInner}>
              <Text style={s.titleMain}>Facture</Text>
            </View>
          </View>

          {/* ===== Métadonnées (numéro / date / échéance) ===== */}
          <View style={s.metaTable} wrap={false}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>N° {facture.numero}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Date : <Text style={s.metaValue}>{dateFmt}</Text></Text>
            </View>
            <View style={[s.metaCell, s.metaCellLast]}>
              <Text style={s.metaLabel}>
                Échéance : <Text style={isRegle ? s.metaValueRegle : s.metaValue}>{echeanceVal}</Text>
              </Text>
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
                {emetteur.telephone ? <Text style={s.partyLine}>Tél. {emetteur.telephone}</Text> : null}
                {emetteur.email ? <Text style={s.partyLine}>{emetteur.email}</Text> : null}
                {emetteur.agence ? (
                  <>
                    <View style={s.agenceBar} />
                    <Text style={s.agenceText}>{emetteur.agence}</Text>
                  </>
                ) : null}
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
              </View>
            </View>
          </View>

          {/* ===== Objet ===== */}
          {facture.objet ? (
            <Text style={s.objetLine} wrap={false}>
              <Text style={s.objetLabel}>OBJET : </Text>
              {facture.objet}
            </Text>
          ) : null}

          {/* ===== Tableau désignation ===== */}
          <View style={s.itemsTable}>
            <View style={s.itemsHead} fixed>
              <Text style={[s.itemsHeadCell, { width: '52%' }]}>Désignation</Text>
              <Text style={[s.itemsHeadCell, { width: '10%', textAlign: 'center' }]}>Qté</Text>
              <Text style={[s.itemsHeadCell, { width: '12%', textAlign: 'center' }]}>Unité</Text>
              <Text style={[s.itemsHeadCell, { width: '13%', textAlign: 'right' }]}>P.U. H.T.</Text>
              <Text style={[s.itemsHeadCell, { width: '13%', textAlign: 'right' }]}>Total H.T.</Text>
            </View>

            {facture.lignes.map((l, li) => (
              <View key={li} style={s.itemsLine} wrap={false}>
                <View style={{ width: '52%' }}>
                  <Text style={[s.itemsDesig, s.itemsDesigStrong]}>{l.designation}</Text>
                  {l.description ? (
                    <Text style={[s.itemsDesig, s.itemsDesigMuted, { paddingTop: 0 }]}>{l.description}</Text>
                  ) : null}
                </View>
                <Text style={[s.itemsCell, s.itemsCellC, { width: '10%' }]}>{l.qte}</Text>
                <Text style={[s.itemsCell, s.itemsCellC, { width: '12%' }]}>{l.unite || '—'}</Text>
                <Text style={[s.itemsCell, l.inclus ? s.itemsInclus : {}, { width: '13%' }]}>
                  {l.inclus ? 'inclus' : fmtEur(l.pu_ht)}
                </Text>
                <Text style={[s.itemsCell, l.inclus ? s.itemsInclus : {}, { width: '13%' }]}>
                  {l.inclus ? 'inclus' : fmtEur((l.pu_ht || 0) * (l.qte || 0))}
                </Text>
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
              <Text style={s.totauxLbl}>
                TVA {tvaTaux} %{tvaTaux === 10 ? ' (taux réduit — travaux)' : ''}
              </Text>
              <Text style={s.totauxV}>{fmtEur(tva)}</Text>
            </View>
            <View style={[s.totauxRow, s.totauxRowTtc, s.totauxRowLast]}>
              <Text style={s.totauxLblTtc}>MONTANT T.T.C.</Text>
              <Text style={s.totauxVTtc}>{fmtEur(totalTTC)}</Text>
            </View>
          </View>

          {/* ===== Mode de règlement (vert) ===== */}
          {facture.mode_reglement ? (
            <View style={s.reglementBox} wrap={false}>
              <Text style={s.reglementTitle}>Mode de règlement</Text>
              <Text style={s.reglementText}>{facture.mode_reglement}</Text>
            </View>
          ) : null}

          {/* ===== Coordonnées bancaires (bleu) ===== */}
          {!isRegle ? (
            <View style={s.ribBox} wrap={false}>
              <Text style={s.ribTitle}>Coordonnées bancaires — virement</Text>
              <View style={s.ribRow}>
                <Text style={s.ribLbl}>IBAN</Text>
                <Text style={s.ribVal}>FR76 1695 8000 0152 7256 3725 930</Text>
              </View>
              <View style={s.ribRow}>
                <Text style={s.ribLbl}>BIC</Text>
                <Text style={s.ribVal}>QNTOFRP1XXX</Text>
              </View>
              <Text style={s.ribNote}>
                Merci d&apos;indiquer le numéro de facture {facture.numero} en référence du virement.
              </Text>
            </View>
          ) : null}

          {/* ===== Observations technicien (jaune) ===== */}
          {(facture.observations || facture.recommandation) ? (
            <View style={s.obsBox} wrap={false}>
              <Text style={s.obsTitle}>Observations du technicien</Text>
              {facture.observations ? (
                <Text style={s.obsText}>{facture.observations}</Text>
              ) : null}
              {facture.recommandation ? (
                <Text style={s.obsText}>
                  <Text style={s.obsStrong}>Recommandation : </Text>
                  {facture.recommandation}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* ===== Signature technicien ===== */}
          {(sigImg || sigName) ? (
            <View style={s.sigWrap} wrap={false}>
              <View style={s.sigCard}>
                <Text style={s.sigCardHead}>Établi par — {emetteur.raisonSociale}</Text>
                <View style={s.sigCardBody}>
                  {sigName ? <Text style={s.sigCardName}>Technicien : {sigName}</Text> : null}
                  <Text style={s.sigCardLabel}>Signature :</Text>
                  {sigImg ? <Image style={s.sigCardImg} src={sigImg} /> : null}
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <Footer emetteur={emetteur} />
      </Page>
    </Document>
  )
}

interface DownloadButtonProps extends FacturePDFProps {
  filename?: string
}

export default function FactureDownloadButton(props: DownloadButtonProps) {
  const filename = props.filename || `facture-${(props.client.nom || 'client').toLowerCase().replace(/\s+/g, '-')}-${props.facture.numero}.pdf`
  return (
    <PDFDownloadLink document={<FactureDocument {...props} />} fileName={filename}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0e2a52] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a1f3d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          title="Télécharger la facture en PDF"
        >
          <span aria-hidden>{loading ? '⏳' : '⬇'}</span>
          <span>{loading ? 'Génération du PDF...' : 'Télécharger la facture PDF'}</span>
        </button>
      )}
    </PDFDownloadLink>
  )
}
