'use client'
import React from "react"
import { Document, Page, Text, View, Image, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer"
import { GRAVITE_LABELS, GLOSSAIRE, findDefaut } from "@/lib/camera-defauts"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

/* ============ CHARTE ============ */
const C = {
  navy: '#0f2e5c',
  navyDark: '#0a2047',
  navyMid: '#25477f',
  red: '#c0392b',
  redSoft: '#fdecea',
  greenSoft: '#e8f3ec',
  greenBorder: '#a3c9b3',
  greenDark: '#0f5132',
  yellowSoft: '#fff8dc',
  yellowBorder: '#e8d384',
  yellowDark: '#7c5e00',
  blueSoft: '#eef4fc',
  blueBorder: '#b9cce8',
  rowAlt: '#eef2f8',
  border: '#c7cfdb',
  text: '#1a1f2e',
  muted: '#5a6270',
  white: '#ffffff',
}

/* ============ TYPES ============ */
export type ObservationItem = {
  position: string         // "12 m", "regard 2", "à mi-tronçon"
  code?: string            // code EN 13508-2 (BAB, BBA…) ou null
  description: string
  photoUrl?: string        // dataUrl ou URL
  photoLegende?: string
}

export type Troncon = {
  reseau?: string                  // EU, EP, unitaire…
  materiau?: string                // PVC, fonte…
  diametre?: string                // DN 100, DN 160…
  longueurM?: number               // longueur inspectée
  regardAmont?: string             // ex "Regard 1 — pied façade"
  regardAval?: string              // ex "Regard 2 — collecteur rue"
  sensInspection?: string          // ex "amont vers aval"
  materielUtilise?: string         // type de caméra
  conditionsMeteo?: string         // ex "sec, accès facilité"
}

export type InspectionData = {
  numero: string                   // ex "ITV-20260505-1"
  dateInspection: string           // ISO YYYY-MM-DD
  technicienNom: string
  agence?: string
  client: {
    nom: string
    adresse: string
    codePostal: string
    ville: string
    email?: string
    telephone?: string
  }
  troncon: Troncon
  observations: ObservationItem[]
  preconisations: { titre: string; detail: string; urgence?: string }[]
  resume: string                   // synthèse globale
  conclusionEtat: 'bon' | 'a-surveiller' | 'desordre' | 'critique'
}

export interface InspectionPDFProps {
  data: InspectionData
}

const ETAT_LABEL: Record<InspectionData['conclusionEtat'], { label: string; bg: string; fg: string }> = {
  bon:           { label: 'État satisfaisant',          bg: C.greenSoft,  fg: C.greenDark },
  'a-surveiller':{ label: 'À surveiller',                bg: C.yellowSoft, fg: C.yellowDark },
  desordre:      { label: 'Désordres significatifs',     bg: C.redSoft,    fg: C.red },
  critique:      { label: 'Désordres critiques — action requise', bg: '#fbe1de', fg: '#7f1d1d' },
}

function fmtDateFR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
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
  header: {
    paddingHorizontal: 40, paddingTop: 18, paddingBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    backgroundColor: C.white,
    borderBottomWidth: 3, borderBottomColor: C.navy,
  },
  firmName: { color: C.navy, fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, textTransform: 'uppercase' },
  firmTag:  { color: C.muted, fontSize: 8, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerMeta:     { color: C.muted, fontSize: 8, marginBottom: 1 },
  headerMetaBold: { color: C.navy,  fontFamily: 'Helvetica-Bold', fontSize: 8.5 },

  content: { paddingHorizontal: 40, paddingTop: 14, paddingBottom: 10 },

  /* Title */
  titleBlock: { marginBottom: 12 },
  titleRedBar: { height: 4, width: 56, backgroundColor: C.red, marginBottom: 6 },
  titleMain: { color: C.navy, fontSize: 18, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  titleSub:  { color: C.muted, fontSize: 9, marginTop: 4, letterSpacing: 0.5 },

  /* Méta */
  metaTable: {
    flexDirection: 'row', borderWidth: 1, borderColor: C.border,
    marginBottom: 14, backgroundColor: C.rowAlt,
  },
  metaCell: {
    flex: 1, paddingVertical: 7, paddingHorizontal: 12,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  metaCellLast: { borderRightWidth: 0 },
  metaLabel: { color: C.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  metaValue: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginTop: 2 },

  /* Etat (badge large) */
  etatBox: {
    borderWidth: 1, borderColor: C.border, borderRadius: 4,
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  etatLbl: { color: C.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  etatVal: { fontFamily: 'Helvetica-Bold', fontSize: 11.5 },

  /* Section title */
  sectionTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingBottom: 4, marginBottom: 8,
    borderBottomWidth: 1, borderBottomColor: C.navy,
  },

  /* Identité (2 colonnes) */
  partyTable: {
    flexDirection: 'row', borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  partyCol: { flex: 1, padding: 10 },
  partyColSep: { borderRightWidth: 1, borderRightColor: C.border },
  partyHead: {
    color: C.navy, fontSize: 8, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
  },
  partyName: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  partyLine: { color: C.text, fontSize: 9, marginBottom: 1 },

  /* Tableau tronçon */
  troncTable: { borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  troncRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  troncRowLast: { borderBottomWidth: 0 },
  troncRowAlt: { backgroundColor: C.rowAlt },
  troncLabel: {
    width: '30%', paddingVertical: 6, paddingHorizontal: 10,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  troncValue: { flex: 1, paddingVertical: 6, paddingHorizontal: 10, color: C.text, fontSize: 9.5 },

  /* Observations */
  obsItem: {
    borderWidth: 1, borderColor: C.border, marginBottom: 8,
    backgroundColor: C.white,
  },
  obsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: C.rowAlt, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  obsHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  obsNum: {
    backgroundColor: C.navy, color: C.white,
    paddingVertical: 2, paddingHorizontal: 6, marginRight: 8,
    fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 0.5,
  },
  obsPos: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  obsCode: {
    paddingVertical: 2, paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 0.5,
  },
  obsBody: { padding: 10 },
  obsCodeBlock: { marginBottom: 4 },
  obsCodeLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  obsCodeKey: { color: C.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.4, width: 80 },
  obsCodeVal: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  obsDesc: { color: C.text, fontSize: 9.5, marginTop: 4, lineHeight: 1.5 },
  obsPhotoWrap: { marginTop: 8, borderWidth: 1, borderColor: C.border, padding: 4 },
  obsPhotoImg: { width: '100%', height: 180, objectFit: 'cover' },
  obsPhotoCap: { color: C.muted, fontSize: 8, textAlign: 'center', marginTop: 4 },

  /* Préco (vert) */
  precoBox: {
    backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.greenBorder,
    borderLeftWidth: 4, padding: 12, marginBottom: 12,
  },
  precoTitle: {
    color: C.greenDark, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  precoItem: { marginBottom: 8 },
  precoItemTitle: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  precoItemDetail: { color: C.text, fontSize: 9.5, lineHeight: 1.5 },
  precoItemUrgence: {
    color: C.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2,
  },

  /* Résumé (jaune) */
  resumeBox: {
    backgroundColor: C.yellowSoft, borderWidth: 1, borderColor: C.yellowBorder,
    borderLeftWidth: 4, padding: 12, marginBottom: 12,
  },
  resumeTitle: {
    color: C.yellowDark, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  resumeText: { color: C.text, fontSize: 10, lineHeight: 1.6 },

  /* Glossaire */
  glossBox: {
    backgroundColor: C.blueSoft, borderWidth: 1, borderColor: C.blueBorder,
    padding: 10, marginBottom: 6,
  },
  glossTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  glossRow: { flexDirection: 'row', marginBottom: 2 },
  glossTerme: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8, width: 90 },
  glossDef:  { flex: 1, color: C.text, fontSize: 8, lineHeight: 1.45 },

  /* Footer */
  footer: {
    paddingHorizontal: 40, paddingTop: 8, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.white,
  },
  footerL: { color: C.muted, fontSize: 7.5, lineHeight: 1.4 },
  footerR: { color: C.muted, fontSize: 7.5, textAlign: 'right' },
})

/* ============ COMPONENTS ============ */
const Header = () => (
  <View style={s.header} fixed>
    <View>
      <Text style={s.firmName}>Aprime fluides</Text>
      <Text style={s.firmTag}>Inspection télévisée des canalisations · ITV · NF EN 13508-2</Text>
    </View>
    <View style={s.headerRight}>
      <Text style={s.headerMetaBold}>Rapport d&apos;inspection caméra</Text>
      <Text style={s.headerMeta}>1, rue Jean Carasso · 95000 Bezons</Text>
      <Text style={s.headerMeta}>Tél. {TEL_PRINCIPAL_FALLBACK}</Text>
    </View>
  </View>
)

const Footer = ({ numero }: { numero: string }) => (
  <View style={s.footer} fixed>
    <View>
      <Text style={s.footerL}>LTDB · Rapport ITV {numero}</Text>
      <Text style={s.footerL}>contact@aprime-fluides.fr · {TEL_PRINCIPAL_FALLBACK}</Text>
    </View>
    <Text style={s.footerR} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
  </View>
)

function TroncRow({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  if (!value) return null
  return (
    <View style={[s.troncRow, alt ? s.troncRowAlt : null] as any}>
      <Text style={s.troncLabel}>{label}</Text>
      <Text style={s.troncValue}>{value}</Text>
    </View>
  )
}

/* ============ DOCUMENT ============ */
export function InspectionDocument({ data }: InspectionPDFProps) {
  const etat = ETAT_LABEL[data.conclusionEtat]
  const t = data.troncon || {}

  // Bouton couleur code défaut
  const codeStyle = (gravite: number) => {
    const g = GRAVITE_LABELS[gravite] || GRAVITE_LABELS[1]
    return {
      backgroundColor: g.color, color: '#fff',
    }
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header />

        <View style={s.content}>
          {/* Titre */}
          <View style={s.titleBlock}>
            <View style={s.titleRedBar} />
            <Text style={s.titleMain}>Rapport d&apos;inspection caméra</Text>
            <Text style={s.titleSub}>Inspection télévisée (ITV) — codification NF EN 13508-2</Text>
          </View>

          {/* Méta */}
          <View style={s.metaTable} wrap={false}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>N° rapport</Text>
              <Text style={s.metaValue}>{data.numero}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Date d&apos;inspection</Text>
              <Text style={s.metaValue}>{fmtDateFR(data.dateInspection)}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Technicien</Text>
              <Text style={s.metaValue}>{data.technicienNom || '—'}</Text>
            </View>
            <View style={[s.metaCell, s.metaCellLast]}>
              <Text style={s.metaLabel}>Agence</Text>
              <Text style={s.metaValue}>{data.agence || 'LTDB'}</Text>
            </View>
          </View>

          {/* État */}
          <View style={[s.etatBox, { backgroundColor: etat.bg }]} wrap={false}>
            <Text style={s.etatLbl}>Conclusion</Text>
            <Text style={[s.etatVal, { color: etat.fg }]}>{etat.label}</Text>
          </View>

          {/* Identité */}
          <View style={s.partyTable} wrap={false}>
            <View style={[s.partyCol, s.partyColSep]}>
              <Text style={s.partyHead}>ÉMETTEUR</Text>
              <Text style={s.partyName}>Aprime fluides</Text>
              <Text style={s.partyLine}>1, rue Jean Carasso</Text>
              <Text style={s.partyLine}>95000 Bezons</Text>
              <Text style={s.partyLine}>Tél. {TEL_PRINCIPAL_FALLBACK}</Text>
              <Text style={s.partyLine}>contact@aprime-fluides.fr</Text>
            </View>
            <View style={s.partyCol}>
              <Text style={s.partyHead}>CLIENT</Text>
              <Text style={s.partyName}>{data.client.nom || '—'}</Text>
              {data.client.adresse ? <Text style={s.partyLine}>{data.client.adresse}</Text> : null}
              {(data.client.codePostal || data.client.ville) ? (
                <Text style={s.partyLine}>{[data.client.codePostal, data.client.ville].filter(Boolean).join(' ')}</Text>
              ) : null}
              {data.client.telephone ? <Text style={s.partyLine}>Tél. {data.client.telephone}</Text> : null}
              {data.client.email ? <Text style={s.partyLine}>{data.client.email}</Text> : null}
            </View>
          </View>

          {/* Tronçon */}
          <Text style={s.sectionTitle}>Caractéristiques du tronçon inspecté</Text>
          <View style={s.troncTable} wrap={false}>
            <TroncRow label="Type de réseau"  value={t.reseau || ''}                       alt />
            <TroncRow label="Matériau"        value={t.materiau || ''} />
            <TroncRow label="Diamètre (DN)"   value={t.diametre || ''}                     alt />
            <TroncRow label="Linéaire inspecté" value={t.longueurM ? `${t.longueurM} m` : ''} />
            <TroncRow label="Regard amont"    value={t.regardAmont || ''}                  alt />
            <TroncRow label="Regard aval"     value={t.regardAval || ''} />
            <TroncRow label="Sens d'inspection" value={t.sensInspection || ''}              alt />
            <TroncRow label="Matériel utilisé"  value={t.materielUtilise || ''} />
            <TroncRow label="Conditions"       value={t.conditionsMeteo || ''}             alt />
          </View>

          {/* Observations */}
          {data.observations.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Observations relevées</Text>
              {data.observations.map((o, i) => {
                const def = findDefaut(o.code || '')
                const grav = def ? def.gravite : 1
                return (
                  <View key={i} style={s.obsItem} wrap={false}>
                    <View style={s.obsHeader}>
                      <View style={s.obsHeaderLeft}>
                        <Text style={s.obsNum}>{`OBS ${String(i + 1).padStart(2, '0')}`}</Text>
                        <Text style={s.obsPos}>{o.position || `Point ${i + 1}`}</Text>
                      </View>
                      {def ? (
                        <Text style={[s.obsCode, codeStyle(grav)] as any}>
                          {def.code} · {def.libelle}
                        </Text>
                      ) : null}
                    </View>
                    <View style={s.obsBody}>
                      {def ? (
                        <View style={s.obsCodeBlock}>
                          <View style={s.obsCodeLine}>
                            <Text style={s.obsCodeKey}>Catégorie</Text>
                            <Text style={s.obsCodeVal}>{def.categorie}</Text>
                          </View>
                          <View style={s.obsCodeLine}>
                            <Text style={s.obsCodeKey}>Gravité</Text>
                            <Text style={[s.obsCodeVal, { color: GRAVITE_LABELS[grav].color }] as any}>
                              {GRAVITE_LABELS[grav].label}
                            </Text>
                          </View>
                          <View style={s.obsCodeLine}>
                            <Text style={s.obsCodeKey}>Définition</Text>
                            <Text style={[s.obsCodeVal, { fontFamily: 'Helvetica' }] as any}>{def.description}</Text>
                          </View>
                        </View>
                      ) : null}
                      {o.description ? <Text style={s.obsDesc}>{o.description}</Text> : null}
                      {o.photoUrl ? (
                        <View style={s.obsPhotoWrap}>
                          <Image src={o.photoUrl} style={s.obsPhotoImg} />
                          <Text style={s.obsPhotoCap}>
                            {o.photoLegende || `Photo ${i + 1}${o.position ? ` — ${o.position}` : ''}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                )
              })}
            </>
          )}

          {/* Préconisations */}
          {data.preconisations.length > 0 && (
            <View style={s.precoBox} wrap={false}>
              <Text style={s.precoTitle}>Préconisations</Text>
              {data.preconisations.map((p, i) => (
                <View key={i} style={s.precoItem}>
                  <Text style={s.precoItemTitle}>• {p.titre}</Text>
                  <Text style={s.precoItemDetail}>{p.detail}</Text>
                  {p.urgence ? <Text style={s.precoItemUrgence}>Urgence : {p.urgence}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {/* Résumé */}
          {data.resume ? (
            <View style={s.resumeBox} wrap={false}>
              <Text style={s.resumeTitle}>Synthèse du technicien</Text>
              <Text style={s.resumeText}>{data.resume}</Text>
            </View>
          ) : null}

          {/* Glossaire */}
          <View style={s.glossBox} wrap={false}>
            <Text style={s.glossTitle}>Glossaire technique</Text>
            {GLOSSAIRE.map(g => (
              <View key={g.terme} style={s.glossRow}>
                <Text style={s.glossTerme}>{g.terme}</Text>
                <Text style={s.glossDef}>{g.def}</Text>
              </View>
            ))}
          </View>
        </View>

        <Footer numero={data.numero} />
      </Page>
    </Document>
  )
}

interface DownloadButtonProps extends InspectionPDFProps {
  filename?: string
  className?: string
  label?: string
}

export default function InspectionDownloadButton(props: DownloadButtonProps) {
  const filename = props.filename
    || `inspection-camera-${(props.data.client.nom || 'client').toLowerCase().replace(/\s+/g, '-')}-${props.data.numero}.pdf`
  return (
    <PDFDownloadLink document={<InspectionDocument data={props.data} />} fileName={filename}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className={props.className || "bg-blue-800 text-white px-4 py-2 rounded-lg hover:bg-blue-900 disabled:opacity-50 font-semibold"}
        >
          {loading ? 'Préparation…' : (props.label || '📄 Télécharger le PDF')}
        </button>
      )}
    </PDFDownloadLink>
  )
}
