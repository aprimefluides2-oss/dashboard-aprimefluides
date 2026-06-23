'use client'
import React from "react"
import { Document, Page, Text, View, Image, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

/* ============ CHARTE FRANCE-ADPT-LIKE ============ */
const C = {
  navy: '#1e3a6f',
  navyDark: '#142a52',
  navyMid: '#2d4f8f',
  red: '#c0392b',
  redSoft: '#fdecea',
  orange: '#e67e22',
  orangeSoft: '#fdf0e3',
  teal: '#3fb8a8',
  tealSoft: '#e7f6f4',
  rowAlt: '#eaf1fa',
  border: '#d9dfe7',
  text: '#1e293b',
  muted: '#6b7280',
  mutedLight: '#9ca3af',
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
  headerPhone: { color: C.text, fontSize: 8.5 },

  /* Content container */
  content: { paddingHorizontal: 40, paddingTop: 10, paddingBottom: 10, flexGrow: 1 },

  /* Cover title block (navy filled, red left bar) */
  titleBlock: {
    flexDirection: 'row', marginTop: 4, marginBottom: 14,
  },
  titleRedBar: { width: 6, backgroundColor: C.red },
  titleInner: {
    flex: 1, backgroundColor: C.navy,
    paddingVertical: 20, paddingHorizontal: 22,
  },
  titleMain: {
    color: C.white, fontSize: 22, fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1.15,
  },
  titleSub: { color: '#c8d4e8', fontSize: 10.5, marginTop: 10, lineHeight: 1.35 },

  /* Identity table */
  idTable: {
    borderWidth: 1, borderColor: C.border,
    marginBottom: 14,
  },
  idRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  idRowLast: { borderBottomWidth: 0 },
  idRowAlt: { backgroundColor: C.rowAlt },
  idLabel: {
    width: '35%', paddingVertical: 8, paddingHorizontal: 10,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  idValue: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 10,
    color: C.text, fontSize: 9.5,
  },

  /* Section band */
  sectionBand: {
    flexDirection: 'row', alignItems: 'stretch',
    marginTop: 22, marginBottom: 10,
  },
  sectionNumBox: {
    width: 34, backgroundColor: C.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionNumTxt: {
    color: C.white, fontSize: 14, fontFamily: 'Helvetica-Bold',
  },
  sectionTitleBox: {
    flex: 1, backgroundColor: C.navyMid,
    paddingVertical: 9, paddingHorizontal: 14, justifyContent: 'center',
  },
  sectionTitleTxt: {
    color: C.white, fontSize: 11, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  /* Section band variants */
  bandRed: { backgroundColor: C.red },
  bandOrange: { backgroundColor: C.orange },
  bandTeal: { backgroundColor: C.teal },
  numBoxNavyDark: { backgroundColor: C.navyDark },

  /* Paragraph */
  para: { marginBottom: 8, color: C.text, fontSize: 9.5, lineHeight: 1.5 },

  /* Declarative red-bordered callout (ÉLÉMENT ESSENTIEL) */
  callout: {
    borderWidth: 1, borderColor: C.red, borderRadius: 2,
    marginTop: 4, marginBottom: 8,
  },
  calloutHead: {
    backgroundColor: C.red, paddingVertical: 6, paddingHorizontal: 12,
  },
  calloutHeadTxt: {
    color: C.white, fontSize: 9, fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  calloutBody: {
    backgroundColor: C.redSoft, paddingVertical: 12, paddingHorizontal: 14,
  },
  calloutText: {
    color: C.text, fontSize: 9.5, lineHeight: 1.5, marginBottom: 6,
  },

  /* Methodology numbered list */
  methStep: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 6,
  },
  methNum: {
    width: 22, height: 22, backgroundColor: C.navyMid,
    color: C.white, textAlign: 'center', paddingTop: 5,
    fontSize: 10, fontFamily: 'Helvetica-Bold', marginRight: 10,
  },
  methText: { flex: 1, paddingTop: 4, color: C.text, fontSize: 9.5 },

  /* Anomaly card */
  anomaly: {
    flexDirection: 'row', marginBottom: 10,
  },
  anomalyBar: { width: 4 },
  anomalyBody: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderLeftWidth: 0,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  anomalyHead: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 6,
  },
  anomalyTag: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 10,
    marginRight: 8,
  },
  anomalyTitle: {
    flex: 1, color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 10,
  },
  anomalyBadge: {
    paddingVertical: 2, paddingHorizontal: 8,
    fontSize: 7.5, fontFamily: 'Helvetica-Bold',
    color: C.white, letterSpacing: 0.5,
  },
  anomalyDesc: { color: C.text, fontSize: 9, lineHeight: 1.45 },

  /* Photos */
  photosWrap: { marginTop: 6 },
  photosIntro: { color: C.text, fontSize: 9.5, marginBottom: 10 },
  photosGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6,
  },
  photoCell: {
    width: '50%', paddingHorizontal: 6, marginBottom: 12,
  },
  photoCard: {
    borderWidth: 1, borderColor: C.border,
    padding: 6, backgroundColor: C.white,
  },
  photoImg: { width: '100%', height: 150, objectFit: 'cover' },
  photoCap: {
    marginTop: 6, color: C.text, fontSize: 8,
    textAlign: 'center', paddingHorizontal: 2,
  },

  /* Prescriptions sub-band */
  subBand: {
    paddingVertical: 6, paddingHorizontal: 12,
    marginTop: 12, marginBottom: 6,
  },
  subBandRed: { backgroundColor: C.red },
  subBandBlue: { backgroundColor: C.navyMid },
  subBandTeal: { backgroundColor: C.teal },
  subBandTxt: {
    color: C.white, fontSize: 9.5, fontFamily: 'Helvetica-Bold',
  },
  precoItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 5, paddingLeft: 2,
  },
  precoSquare: {
    width: 8, height: 8, marginTop: 4, marginRight: 9,
  },
  sqRed: { backgroundColor: C.red },
  sqBlue: { backgroundColor: C.navyMid },
  sqTeal: { backgroundColor: C.teal },
  precoTxt: { flex: 1, color: C.text, fontSize: 9.5, lineHeight: 1.45 },

  /* Conclusion filled navy block */
  conclusionBlock: {
    backgroundColor: C.navy,
    paddingVertical: 16, paddingHorizontal: 18,
    marginTop: 4, marginBottom: 14,
  },
  conclusionP: {
    color: C.white, fontSize: 9.5, lineHeight: 1.55, marginBottom: 8,
  },

  /* Signature 2-col table */
  sigTable: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: C.border,
    marginTop: 10,
  },
  sigCol: {
    flex: 1, padding: 0,
  },
  sigColSep: { borderRightWidth: 1, borderRightColor: C.border },
  sigHead: {
    backgroundColor: C.rowAlt,
    paddingVertical: 7, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
  },
  sigBody: {
    paddingVertical: 14, paddingHorizontal: 10, minHeight: 80,
  },
  sigLine: {
    color: C.muted, fontSize: 8.5, marginBottom: 10,
  },

  /* Footer (flow-placed + fixed) */
  footer: {
    paddingHorizontal: 40, paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.white,
  },
  footerL: { color: C.muted, fontSize: 7.5, lineHeight: 1.4 },
  footerR: { color: C.muted, fontSize: 7.5, textAlign: 'right' },

  /* Devis */
  devisHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.navy, padding: 16, marginTop: 2, marginBottom: 14,
  },
  devisHeaderTitle: { color: C.white, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  devisHeaderSub: { color: '#c8d4e8', fontSize: 9, marginTop: 3 },
  devisHeaderRight: { alignItems: 'flex-end' },
  devisHeaderLbl: { color: '#c8d4e8', fontSize: 7, letterSpacing: 0.5 },
  devisHeaderV: { color: C.white, fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  devisMetaRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  devisMetaCell: {
    width: '50%', padding: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  devisMetaK: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 0.3 },
  devisMetaV: { color: C.text, fontSize: 9.5, marginTop: 3 },
  devisTable: {
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  devisHead: { flexDirection: 'row', backgroundColor: C.navy },
  devisHeadCell: {
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 8,
    padding: 8, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  devisSectionRow: {
    backgroundColor: C.rowAlt, paddingVertical: 5, paddingHorizontal: 10,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  devisSectionTxt: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  devisLine: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border,
    padding: 8,
  },
  devisDesignation: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  devisDescription: { color: C.muted, fontSize: 8, marginTop: 2 },
  devisCell: { padding: 8, fontSize: 9 },

  totaux: { marginLeft: 'auto', width: '55%', marginBottom: 14 },
  totauxRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  totauxRowTtc: { backgroundColor: C.navy, borderBottomWidth: 0 },
  totauxLbl: { color: C.muted, fontSize: 9 },
  totauxV: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  totauxLblTtc: { color: '#c8d4e8', fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totauxVTtc: { color: C.white, fontSize: 11, fontFamily: 'Helvetica-Bold' },

  conditions: {
    borderLeftWidth: 4, borderLeftColor: C.orange,
    backgroundColor: C.orangeSoft,
    paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 10,
  },
  conditionsTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
  },
  conditionsItem: { color: C.text, fontSize: 9, marginBottom: 3 },
})

/* ============ TYPES ============ */
type Statut = 'critical' | 'warn' | 'info' | 'ok' | 'neutral'

interface Phase { titre: string; statut?: Statut; contexte: string; action: string; resultat: string }
interface AnalyseRow { probleme: string; localisation: string; description: string; statut: Statut; label: string }
interface PrecoItem { k: string; v: string }
interface Preco { tag: string; titre: string; items: PrecoItem[] }
interface DevisLine { section?: string; designation: string; description?: string; qte: number; pu_ht: number }
interface Devis {
  numero?: string
  validite_jours?: number
  lignes: DevisLine[]
  tva_taux?: number
  conditions?: string[]
}

export interface RapportData {
  diagnostic: string
  travaux_realises: string
  recommandations: string
  commentaire_technicien: string
  objet?: string
  contexte?: string
  localisation?: { zone: string; configuration: string }
  materiel_utilise?: string[]
  duree_intervention?: string
  conditions_intervention?: string
  phases?: Phase[]
  avis_technique?: {
    titre: string; niveau?: Statut; intro: string;
    points_majeurs: string[]; diagnostic_final: string; recommandation_urgente: string
  } | null
  analyse_table?: AnalyseRow[]
  preconisations?: Preco[]
  devis?: Devis | null
  reference?: string
}

export interface PDFProps {
  clientNom: string
  adresse: string
  ville: string
  codePostal: string
  dateIntervention: string
  typeIntervention: string
  technicienNom: string
  rapport: RapportData
  phone?: string
  reference?: string
  photos?: { url: string; legende?: string }[]
}

/* ============ HELPERS ============ */
const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[\u00A0\u202F\u2007\u2009\u200A]/g, ' ') + ' €'

const fmtDateFR = (iso: string) => {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]} / ${m[2]} / ${m[1]}`
  return iso
}

const statutLabel = (statut: Statut): { text: string; bg: string; barColor: string } => {
  switch (statut) {
    case 'critical': return { text: 'CRITIQUE', bg: C.red, barColor: C.red }
    case 'warn':     return { text: 'ÉLEVÉE', bg: C.orange, barColor: C.orange }
    case 'info':     return { text: 'À PRÉVOIR', bg: C.navyMid, barColor: C.navyMid }
    case 'ok':       return { text: 'CONFORME', bg: C.teal, barColor: C.teal }
    default:         return { text: 'N/A', bg: C.mutedLight, barColor: C.mutedLight }
  }
}

const Header = ({ phone }: { phone?: string }) => (
  <View style={s.headerTop} fixed>
    <View style={s.brandRow}>
      <Text style={s.brandName}>LTDB</Text>
      <Text style={s.brandTag}>Débouchage · Curage · Inspection caméra · Assainissement</Text>
    </View>
    <Text style={s.headerPhone}>Tél. {phone || TEL_PRINCIPAL_FALLBACK}</Text>
  </View>
)

const Footer = () => (
  <View style={s.footer} fixed>
    <View>
      <Text style={s.footerL}>
        Aprime fluides · Intervention et assainissement dans le Var
      </Text>
      <Text style={s.footerL}>
        Tél. {TEL_PRINCIPAL_FALLBACK} · contact@aprime-fluides.fr · www.aprime-fluides.fr
      </Text>
    </View>
    <Text style={s.footerR} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
  </View>
)

const SectionBand = ({
  num, title, variant,
}: { num: number | string; title: string; variant?: 'default' | 'red' | 'orange' | 'teal' }) => {
  const bandStyle =
    variant === 'red' ? s.bandRed :
    variant === 'orange' ? s.bandOrange :
    variant === 'teal' ? s.bandTeal : {}
  const numStyle = variant ? s.numBoxNavyDark : {}
  return (
    <View style={s.sectionBand} wrap={false}>
      <View style={[s.sectionNumBox, numStyle]}>
        <Text style={s.sectionNumTxt}>{num}</Text>
      </View>
      <View style={[s.sectionTitleBox, bandStyle]}>
        <Text style={s.sectionTitleTxt}>{title}</Text>
      </View>
    </View>
  )
}

/* ============ DOCUMENT ============ */
export function RealisationDocument({
  clientNom, adresse, ville, codePostal, dateIntervention, typeIntervention,
  technicienNom, rapport, reference, photos, phone,
}: PDFProps) {
  const ref = reference || rapport.reference || `LTDB-${dateIntervention.replace(/-/g, '')}`
  const hasPhotos = (photos?.length ?? 0) > 0

  /* Section numbering (stable: skip empty sections) */
  const hasContexte     = !!(rapport.contexte && rapport.contexte.trim())
  const hasMethodo      = (rapport.phases?.length ?? 0) > 0 || !!(rapport.travaux_realises && rapport.travaux_realises.trim())
  const hasAnomalies    = (rapport.analyse_table?.length ?? 0) > 0
  const hasPrecos       = (rapport.preconisations?.length ?? 0) > 0 || !!(rapport.recommandations && rapport.recommandations.trim())
  const hasConclusion   =
    !!(rapport.avis_technique?.diagnostic_final || rapport.avis_technique?.recommandation_urgente) ||
    !!(rapport.diagnostic && rapport.diagnostic.trim()) ||
    !!(rapport.commentaire_technicien && rapport.commentaire_technicien.trim())

  const sections: string[] = []
  if (hasContexte) sections.push('contexte')
  if (hasMethodo) sections.push('methodo')
  if (hasAnomalies) sections.push('anomalies')
  if (hasPhotos) sections.push('photos')
  if (hasPrecos) sections.push('precos')
  if (hasConclusion) sections.push('conclusion')

  const numOf = (key: string) => String(sections.indexOf(key) + 1)

  /* Critical callout (ÉLÉMENT ESSENTIEL) — shown only when avis_technique is critical */
  const showCritical =
    rapport.avis_technique &&
    (rapport.avis_technique.niveau === 'critical' || !rapport.avis_technique.niveau) &&
    !!(rapport.avis_technique.intro || rapport.avis_technique.titre)

  /* Methodology steps: use phases titres, fallback to travaux_realises split */
  const methoSteps: string[] =
    (rapport.phases && rapport.phases.length > 0)
      ? rapport.phases.map(p => p.titre || '').filter(Boolean)
      : (rapport.travaux_realises ? [rapport.travaux_realises] : [])

  /* Devis calc */
  const lignes = rapport.devis?.lignes || []
  const totalHT = lignes.reduce((sum, l) => sum + l.pu_ht * l.qte, 0)
  const tvaTaux = rapport.devis?.tva_taux ?? 10
  const tva = totalHT * tvaTaux / 100
  const totalTTC = totalHT + tva
  const devisSectionsMap = new Map<string, DevisLine[]>()
  lignes.forEach(l => {
    const k = l.section || 'Prestations'
    if (!devisSectionsMap.has(k)) devisSectionsMap.set(k, [])
    devisSectionsMap.get(k)!.push(l)
  })

  return (
    <Document>
      {/* ============ RAPPORT (flow sur plusieurs pages) ============ */}
      <Page size="A4" style={s.page}>
        <Header phone={phone} />

        <View style={s.content}>
          {/* Title block */}
          <View style={s.titleBlock} wrap={false}>
            <View style={s.titleRedBar} />
            <View style={s.titleInner}>
              <Text style={s.titleMain}>Rapport d&apos;intervention</Text>
              <Text style={s.titleSub}>
                {rapport.objet || `${typeIntervention} — ${ville}`}
              </Text>
            </View>
          </View>

          {/* Identity table */}
          <View style={s.idTable} wrap={false}>
            <View style={s.idRow}>
              <Text style={s.idLabel}>Société</Text>
              <Text style={s.idValue}>Aprime fluides</Text>
            </View>
            <View style={[s.idRow, s.idRowAlt]}>
              <Text style={s.idLabel}>Date d&apos;intervention</Text>
              <Text style={s.idValue}>{fmtDateFR(dateIntervention)}</Text>
            </View>
            <View style={s.idRow}>
              <Text style={s.idLabel}>Client</Text>
              <Text style={s.idValue}>{clientNom || '—'}</Text>
            </View>
            <View style={[s.idRow, s.idRowAlt]}>
              <Text style={s.idLabel}>Adresse du chantier</Text>
              <Text style={s.idValue}>
                {[adresse, [codePostal, ville].filter(Boolean).join(' ')].filter(Boolean).join(' — ')}
              </Text>
            </View>
            <View style={s.idRow}>
              <Text style={s.idLabel}>Nature de l&apos;intervention</Text>
              <Text style={s.idValue}>{typeIntervention}</Text>
            </View>
            <View style={[s.idRow, s.idRowAlt]}>
              <Text style={s.idLabel}>Technicien intervenant</Text>
              <Text style={s.idValue}>{technicienNom || '—'}</Text>
            </View>
            <View style={[s.idRow, s.idRowLast]}>
              <Text style={s.idLabel}>Référence dossier</Text>
              <Text style={s.idValue}>{ref}</Text>
            </View>
          </View>

          {/* Section 1 — CONTEXTE */}
          {hasContexte && (
            <View>
              <SectionBand num={numOf('contexte')} title="Contexte de l'intervention" />
              <Text style={s.para}>{rapport.contexte}</Text>

              {showCritical && (
                <View style={s.callout} wrap={false}>
                  <View style={s.calloutHead}>
                    <Text style={s.calloutHeadTxt}>
                      !  Élément essentiel — {rapport.avis_technique?.titre || 'Point de vigilance'}
                    </Text>
                  </View>
                  <View style={s.calloutBody}>
                    {rapport.avis_technique?.intro && (
                      <Text style={s.calloutText}>{rapport.avis_technique.intro}</Text>
                    )}
                    {(rapport.avis_technique?.points_majeurs || []).map((pt, i) => (
                      <Text key={i} style={s.calloutText}>• {pt}</Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Section 2 — MÉTHODOLOGIE */}
          {hasMethodo && (
            <View>
              <SectionBand num={numOf('methodo')} title="Méthodologie d'investigation" />
              {methoSteps.map((step, i) => (
                <View key={i} style={s.methStep} wrap={false}>
                  <Text style={s.methNum}>{i + 1}</Text>
                  <Text style={s.methText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Section 3 — ANOMALIES */}
          {hasAnomalies && (
            <View>
              <SectionBand num={numOf('anomalies')} title="Anomalies constatées" variant="orange" />
              {rapport.analyse_table!.map((row, i) => {
                const st = statutLabel(row.statut)
                return (
                  <View key={i} style={s.anomaly} wrap={false}>
                    <View style={[s.anomalyBar, { backgroundColor: st.barColor }]} />
                    <View style={s.anomalyBody}>
                      <View style={s.anomalyHead}>
                        <Text style={s.anomalyTag}>#{i + 1}</Text>
                        <Text style={s.anomalyTitle}>{row.probleme}</Text>
                        <Text style={[s.anomalyBadge, { backgroundColor: st.bg }]}>{st.text}</Text>
                      </View>
                      <Text style={s.anomalyDesc}>
                        {row.localisation ? <Text>{row.localisation} — </Text> : null}
                        {row.description}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {/* Section 4 — PHOTOS */}
          {hasPhotos && (
            <View>
              <SectionBand num={numOf('photos')} title="Documents photographiques" />
              <Text style={s.photosIntro}>
                Clichés pris lors de l&apos;intervention, annexés au présent rapport à titre de constat :
              </Text>
              <View style={s.photosGrid}>
                {photos!.map((p, i) => (
                  <View key={i} style={s.photoCell} wrap={false}>
                    <View style={s.photoCard}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image src={p.url} style={s.photoImg} />
                      <Text style={s.photoCap}>
                        Photo nº {i + 1}{p.legende ? ` — ${p.legende}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Section 5 — PRESCRIPTIONS */}
          {hasPrecos && (
            <View>
              <SectionBand num={numOf('precos')} title="Prescriptions & travaux à engager" variant="teal" />

              {(rapport.preconisations?.length ?? 0) > 0 ? (
                rapport.preconisations!.map((p, idx) => {
                  const kind = idx % 3 === 0 ? 'red' : idx % 3 === 1 ? 'blue' : 'teal'
                  const bandStyle = kind === 'red' ? s.subBandRed : kind === 'blue' ? s.subBandBlue : s.subBandTeal
                  const sqStyle = kind === 'red' ? s.sqRed : kind === 'blue' ? s.sqBlue : s.sqTeal
                  return (
                    <View key={idx}>
                      <View style={[s.subBand, bandStyle]} wrap={false}>
                        <Text style={s.subBandTxt}>
                          {`5.${idx + 1}`}  {p.titre || p.tag}
                        </Text>
                      </View>
                      {(Array.isArray(p.items) ? p.items : []).map((it, j) => (
                        <View key={j} style={s.precoItem} wrap={false}>
                          <View style={[s.precoSquare, sqStyle]} />
                          <Text style={s.precoTxt}>
                            {it?.k ? <Text style={{ fontFamily: 'Helvetica-Bold' }}>{it.k} : </Text> : null}
                            {it?.v}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )
                })
              ) : (
                <>
                  <View style={[s.subBand, s.subBandBlue]} wrap={false}>
                    <Text style={s.subBandTxt}>5.1  Recommandations</Text>
                  </View>
                  <Text style={s.para}>{rapport.recommandations}</Text>
                </>
              )}
            </View>
          )}

          {/* Section 6 — CONCLUSION */}
          {hasConclusion && (
            <View>
              <SectionBand num={numOf('conclusion')} title="Conclusion" />
              <View style={s.conclusionBlock}>
                {rapport.avis_technique?.diagnostic_final && (
                  <Text style={s.conclusionP}>{rapport.avis_technique.diagnostic_final}</Text>
                )}
                {rapport.avis_technique?.recommandation_urgente && (
                  <Text style={s.conclusionP}>{rapport.avis_technique.recommandation_urgente}</Text>
                )}
                {!rapport.avis_technique?.diagnostic_final && rapport.diagnostic && (
                  <Text style={s.conclusionP}>{rapport.diagnostic}</Text>
                )}
                {rapport.commentaire_technicien && (
                  <Text style={s.conclusionP}>{rapport.commentaire_technicien}</Text>
                )}
              </View>

              {/* Signatures */}
              <View style={s.sigTable} wrap={false}>
                <View style={[s.sigCol, s.sigColSep]}>
                  <Text style={s.sigHead}>LTDB — Technicien intervenant</Text>
                  <View style={s.sigBody}>
                    <Text style={s.sigLine}>Date : {fmtDateFR(dateIntervention)}</Text>
                    <Text style={s.sigLine}>Nom : {technicienNom || '—'}</Text>
                    <Text style={s.sigLine}>Signature :</Text>
                  </View>
                </View>
                <View style={s.sigCol}>
                  <Text style={s.sigHead}>Client — Lu et approuvé</Text>
                  <View style={s.sigBody}>
                    <Text style={s.sigLine}>{clientNom || '—'}</Text>
                    <Text style={s.sigLine}>Date : {fmtDateFR(dateIntervention)}</Text>
                    <Text style={s.sigLine}>Signature :</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        <Footer />
      </Page>

      {/* ============ DEVIS (page dédiée si présent) ============ */}
      {rapport.devis && (
        <Page size="A4" style={s.page}>
          <Header phone={phone} />

          <View style={s.content}>
            <View style={s.devisHeader} wrap={false}>
              <View>
                <Text style={s.devisHeaderTitle}>
                  DEVIS Nº {rapport.devis.numero || `DV-${ref}`}
                </Text>
                <Text style={s.devisHeaderSub}>
                  Travaux complémentaires — intervention du {fmtDateFR(dateIntervention)}
                </Text>
              </View>
              <View style={s.devisHeaderRight}>
                <Text style={s.devisHeaderLbl}>VALIDITÉ</Text>
                <Text style={s.devisHeaderV}>{rapport.devis.validite_jours || 30} jours</Text>
                <Text style={s.devisHeaderLbl}>ÉMIS LE</Text>
                <Text style={s.devisHeaderV}>{fmtDateFR(dateIntervention)}</Text>
              </View>
            </View>

            <View style={s.devisMetaRow} wrap={false}>
              <View style={[s.devisMetaCell, { borderRightWidth: 1, borderRightColor: C.border }]}>
                <Text style={s.devisMetaK}>CLIENT</Text>
                <Text style={s.devisMetaV}>{clientNom || '—'}</Text>
              </View>
              <View style={s.devisMetaCell}>
                <Text style={s.devisMetaK}>CHANTIER</Text>
                <Text style={s.devisMetaV}>{adresse}, {codePostal} {ville}</Text>
              </View>
              <View style={[s.devisMetaCell, { borderRightWidth: 1, borderRightColor: C.border, borderBottomWidth: 0 }]}>
                <Text style={s.devisMetaK}>RÉFÉRENCE INTERVENTION</Text>
                <Text style={s.devisMetaV}>{ref}</Text>
              </View>
              <View style={[s.devisMetaCell, { borderBottomWidth: 0 }]}>
                <Text style={s.devisMetaK}>DÉLAI D&apos;EXÉCUTION</Text>
                <Text style={s.devisMetaV}>Sous 15 jours après acceptation</Text>
              </View>
            </View>

            <View style={s.devisTable}>
              <View style={s.devisHead} fixed>
                <Text style={[s.devisHeadCell, { width: '52%' }]}>Désignation</Text>
                <Text style={[s.devisHeadCell, { width: '12%', textAlign: 'right' }]}>Qté</Text>
                <Text style={[s.devisHeadCell, { width: '18%', textAlign: 'right' }]}>PU HT</Text>
                <Text style={[s.devisHeadCell, { width: '18%', textAlign: 'right' }]}>Total HT</Text>
              </View>
              {Array.from(devisSectionsMap.entries()).map(([sec, items], si) => (
                <View key={si}>
                  <View style={s.devisSectionRow}><Text style={s.devisSectionTxt}>{sec}</Text></View>
                  {items.map((l, li) => (
                    <View key={li} style={s.devisLine} wrap={false}>
                      <View style={{ width: '52%' }}>
                        <Text style={s.devisDesignation}>{l.designation}</Text>
                        {l.description ? <Text style={s.devisDescription}>{l.description}</Text> : null}
                      </View>
                      <Text style={[s.devisCell, { width: '12%', textAlign: 'right' }]}>{l.qte}</Text>
                      <Text style={[s.devisCell, { width: '18%', textAlign: 'right' }]}>{fmtEur(l.pu_ht)}</Text>
                      <Text style={[s.devisCell, { width: '18%', textAlign: 'right' }]}>{fmtEur(l.pu_ht * l.qte)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            <View style={s.totaux} wrap={false}>
              <View style={s.totauxRow}>
                <Text style={s.totauxLbl}>Total HT</Text>
                <Text style={s.totauxV}>{fmtEur(totalHT)}</Text>
              </View>
              <View style={s.totauxRow}>
                <Text style={s.totauxLbl}>TVA {tvaTaux} %</Text>
                <Text style={s.totauxV}>{fmtEur(tva)}</Text>
              </View>
              <View style={[s.totauxRow, s.totauxRowTtc]}>
                <Text style={s.totauxLblTtc}>TOTAL TTC</Text>
                <Text style={s.totauxVTtc}>{fmtEur(totalTTC)}</Text>
              </View>
            </View>

            {rapport.devis.conditions && rapport.devis.conditions.length > 0 && (
              <View style={s.conditions} wrap={false}>
                <Text style={s.conditionsTitle}>Conditions</Text>
                {rapport.devis.conditions.map((c, i) => (
                  <Text key={i} style={s.conditionsItem}>• {c}</Text>
                ))}
              </View>
            )}

            <View style={s.sigTable} wrap={false}>
              <View style={[s.sigCol, s.sigColSep]}>
                <Text style={s.sigHead}>Établi par — LTDB</Text>
                <View style={s.sigBody}>
                  <Text style={s.sigLine}>Nom : {technicienNom || '—'}</Text>
                  <Text style={s.sigLine}>Date : {fmtDateFR(dateIntervention)}</Text>
                  <Text style={s.sigLine}>Signature :</Text>
                </View>
              </View>
              <View style={s.sigCol}>
                <Text style={s.sigHead}>Bon pour accord — Client</Text>
                <View style={s.sigBody}>
                  <Text style={s.sigLine}>Nom : {clientNom || '—'}</Text>
                  <Text style={s.sigLine}>Date :</Text>
                  <Text style={s.sigLine}>Mention « Bon pour accord » + signature :</Text>
                </View>
              </View>
            </View>
          </View>

          <Footer />
        </Page>
      )}
    </Document>
  )
}

interface DownloadButtonProps extends PDFProps {
  filename?: string
}

export default function PDFDownloadButton(props: DownloadButtonProps) {
  const filename = props.filename || `rapport-${(props.ville || 'intervention').toLowerCase()}-${props.dateIntervention}.pdf`
  return (
    <PDFDownloadLink document={<RealisationDocument {...props} />} fileName={filename}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0e2a52] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a1f3d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          title="Télécharger le rapport en PDF"
        >
          <span aria-hidden>{loading ? '⏳' : '⬇'}</span>
          <span>{loading ? 'Génération du PDF...' : 'Télécharger le rapport PDF'}</span>
        </button>
      )}
    </PDFDownloadLink>
  )
}
