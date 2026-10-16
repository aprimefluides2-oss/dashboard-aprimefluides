'use client'
import { WATERMARK_SYMBOL } from '@/lib/aprime-watermark-symbol'
import React from "react"
import { inspectionLocation } from "@/lib/inspection-location"
import { privateReport, streetOnly } from "@/lib/report-privacy"
import { Document, Page, Text, View, Image, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer"
import { GRAVITE_LABELS, GLOSSAIRE, findDefaut } from "@/lib/camera-defauts"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

/* ============ CHARTE ============ */
const C = {
  navy: '#083d6a',
  navyDark: '#00284b',
  navyMid: '#004c91',
  gold: '#facc15',
  red: '#c0392b',
  redSoft: '#fdecea',
  greenSoft: '#f3f7fa',
  greenBorder: '#d6e2eb',
  greenDark: '#083d6a',
  yellowSoft: '#fff8dc',
  yellowBorder: '#e8d384',
  yellowDark: '#7c5e00',
  blueSoft: '#eef4fc',
  blueBorder: '#b9cce8',
  rowAlt: '#f3f7fa',
  border: '#d6e2eb',
  text: '#1a1f2e',
  muted: '#5a6270',
  white: '#ffffff',
}

/* ============ TYPES ============ */
export type ObservationItem = {
  videoReference?: string
  timecode?: string
  troncon?: string
  pointDepart?: string
  sensInspection?: string
  distanceM?: number
  distanceSource?: string
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
  diffusion?: 'client-prive' | 'anonymise'
  societe?: string
  sousTraitance?: boolean
  statut?: 'brouillon' | 'valide'
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
  conclusionPrecision?: string
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
    paddingHorizontal: 0, paddingTop: 76, paddingBottom: 52,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.white,
    backgroundColor: C.navyDark,
    lineHeight: 1.45,
  },

  /* Header */
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 64,
    paddingHorizontal: 32, paddingTop: 10, paddingBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    backgroundColor: C.navyDark,
    borderBottomWidth: 1, borderBottomColor: "#285477",
  },
  firmName: { color: C.white, fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, textTransform: 'uppercase' },
  firmTag:  { color: '#bdd0e0', fontSize: 8, marginTop: 2 },
  headerRight: { position:'absolute',right:32,top:10,alignItems: 'flex-end' },
  headerMeta:     { color: '#bdd0e0', fontSize: 7, lineHeight:1.2, marginBottom: 2 },
  headerMetaBold: { color: C.white,  fontFamily: 'Helvetica-Bold', fontSize: 8.5 },

  content: { paddingHorizontal: 32, paddingTop: 14, paddingBottom: 10 },

  /* Title */
  titleBlock: { marginBottom: 18, backgroundColor: C.navy, padding: 24, paddingTop: 25, paddingBottom: 22, borderRadius: 14, overflow: 'hidden' },
  titleRedBar: { height: 4, width: 42, backgroundColor: C.gold, marginBottom: 8 },
  titleMain: { color: C.white, fontSize: 32, fontFamily: 'Helvetica', lineHeight: 1.12, letterSpacing:-0.5 },
  titleSub:  { color: C.white, fontSize: 9, marginTop: 10 },

  /* Méta */
  metaTable: {
    flexDirection: 'row', borderBottomWidth: 1, borderColor: C.border,
    marginBottom: 18, backgroundColor: C.navyDark,
  },
  metaCell: {
    minWidth: 0, flex: 1, paddingVertical: 7, paddingHorizontal: 12,
    borderRightWidth: 0,
  },
  metaCellLast: { borderRightWidth: 0 },
  metaLabel: { color: '#bdd0e0', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  metaValue: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginTop: 2 },

  /* Etat (badge large) */
  etatBox: {
    borderWidth: 0, borderLeftWidth:3, borderLeftColor:C.gold, borderRadius: 6,
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  etatLbl: { color: C.white, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  etatVal: { fontFamily: 'Helvetica-Bold', fontSize: 11.5 },

  /* Section title */
  sectionTitle: {
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 13,
    letterSpacing: 0,
    paddingBottom: 5, marginBottom: 9,
    borderBottomWidth: 2, borderBottomColor: C.gold,
  },

  /* Identité (2 colonnes) */
  partyTable: {
    flexDirection: 'row', borderWidth: 0, backgroundColor: C.navy, borderRadius: 8, overflow:'hidden', marginBottom: 18,
  },
  partyCol: { flex: 1, padding: 10 },
  partyColSep: { borderRightWidth: 1, borderRightColor: "#285477" },
  partyHead: {
    color: C.gold, fontSize: 8, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
  },
  partyName: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  partyLine: { color: C.white, fontSize: 9, marginBottom: 1 },

  /* Tableau tronçon */
  troncTable: { borderWidth: 0, borderColor: C.border, marginBottom: 14 },
  troncRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: "#285477" },
  troncRowLast: { borderBottomWidth: 0 },
  troncRowAlt: { backgroundColor: C.navy },
  troncLabel: {
    width: '30%', paddingVertical: 6, paddingHorizontal: 10,
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 9,
    borderRightWidth: 1, borderRightColor: "#285477",
  },
  troncValue: { flex: 1, paddingVertical: 6, paddingHorizontal: 10, color: C.white, fontSize: 9.5 },

  /* Observations */
  obsItem: {
    borderWidth: 0, borderBottomWidth:1,borderColor: C.navy, borderRadius: 9, overflow: 'hidden', marginBottom: 12,
    backgroundColor: C.navy,
  },
  obsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: C.navy, borderBottomWidth: 1, borderBottomColor:'#326087',
  },
  obsHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  obsNum: {
    backgroundColor: C.gold, color: C.navy,
    paddingVertical: 4, paddingHorizontal: 7, borderRadius:3, marginRight: 10,
    fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 0.5,
  },
  obsPos: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  obsCode: {
    paddingVertical: 2, paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 0.5,
  },
  obsBody: { padding: 10, paddingTop:8, flexDirection: 'row', alignItems: 'center' },
  obsText: { flex: 1, minWidth: 0 },
  obsCodeBlock: { marginBottom: 4 },
  obsCodeLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  obsCodeKey: { color: '#c1d6e7', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.4, width: 80 },
  obsCodeVal: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 9.5, flex: 1, minWidth: 0 },
  obsDesc: { color: C.white, fontSize: 9.5, marginTop: 4, lineHeight: 1.5 },
  obsPhotoWrap: { width: 160, marginRight: 18, borderWidth: 1, borderColor:'#326087', borderRadius: 5, padding: 6, backgroundColor: C.navyDark },
  obsPhotoImg: { width: '100%', maxHeight: 118, objectFit: 'contain' },
  obsPhotoCap: { color: '#d0dfeb', fontSize: 7, textAlign: 'left', marginTop: 5 },

  /* Préco (vert) */
  precoBox: {
    overflow:'hidden',
    backgroundColor: C.navy, borderWidth: 1, borderColor: C.navy,
    borderRadius: 8, borderLeftWidth: 4, borderLeftColor: C.gold, padding: 16, marginBottom: 12,
  },
  precoTitle: {
    color: C.gold, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  precoItem: { marginBottom: 8 },
  precoItemTitle: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  precoItemDetail: { color: C.white, fontSize: 9.5, lineHeight: 1.5 },
  precoItemUrgence: {
    color: '#c1d6e7', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2,
  },

  /* Résumé (jaune) */
  resumeBox: {
    overflow:'hidden',
    backgroundColor: C.navy, borderWidth: 1, borderColor: C.navy,
    borderRadius: 8, borderLeftWidth: 4, borderLeftColor: C.navy, padding: 16, marginBottom: 12,
  },
  resumeTitle: {
    color: C.gold, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  resumeText: { color: C.white, fontSize: 10, lineHeight: 1.6 },

  /* Glossaire */
  glossBox: {
    overflow:'hidden',
    backgroundColor: C.navy, borderTopWidth: 1, borderColor: C.navy,
    padding: 10, marginBottom: 6,
  },
  glossTitle: {
    color: C.gold, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  glossRow: { flexDirection: 'row', marginBottom: 2 },
  glossTerme: { color: C.gold, fontFamily: 'Helvetica-Bold', fontSize: 8, width: 90 },
  glossDef:  { flex: 1, color: C.white, fontSize: 8, lineHeight: 1.45 },

  /* Footer */
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 44,
    paddingHorizontal: 32, paddingTop: 6, paddingBottom: 6,
    borderTopWidth: 1, borderTopColor: "#285477",
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.navyDark,
  },
  footerL: { color: '#bdd0e0', fontSize: 7.5, lineHeight: 1.4 },
  footerR: { color: '#bdd0e0', fontSize: 7.5, textAlign: 'right', position: 'absolute', right: 32, top: 6, width: 75 },
})

/* ============ COMPONENTS ============ */
const Header = ({ company, neutral }: { company: string; neutral: boolean }) => (
  <View style={s.header} fixed>
    <View>
      {neutral ? <Text style={s.firmName}>{company}</Text> : <View style={{flexDirection:'row',alignItems:'center'}}><Image src={WATERMARK_SYMBOL} style={{width:34,height:38,objectFit:'contain',marginRight:8}} /><View><Text style={{color:C.white,fontSize:13,fontFamily:'Helvetica-Bold',letterSpacing:1}}>APRIME FLUIDES</Text><Text style={{color:'#bdd0e0',fontSize:6,letterSpacing:1,marginTop:3}}>DÉBOUCHAGE &amp; ASSAINISSEMENT</Text></View></View>}
      {neutral && <Text style={s.firmTag}>Inspection et entretien des canalisations</Text>}
    </View>
    <View style={s.headerRight}>
      {neutral ? <Text style={s.headerMetaBold}>Compte rendu d&apos;intervention</Text> : <><Text style={s.headerMeta}>1 rue Jean Carasso · 95870 Bezons</Text><Text style={s.headerMeta}>Tél. {TEL_PRINCIPAL_FALLBACK}</Text><Text style={s.headerMeta}>aprime-fluides@orange.fr</Text><Text style={s.headerMeta}>www.aprime-fluides.fr</Text></>}
    </View>
  </View>
)

const Footer = ({ numero, company, neutral }: { numero: string; company: string; neutral: boolean }) => (
  <View style={s.footer} fixed>
    <View style={{flex:1}}>
      <Text style={s.footerL}>{company} · Rapport ITV {numero}</Text>
      {!neutral && <Text style={s.footerL}>contact@aprime-fluides.fr · {TEL_PRINCIPAL_FALLBACK}</Text>}
    </View>
    <Text fixed style={s.footerR} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
  </View>
)

function Watermark({neutral}:{neutral:boolean;hero?:boolean}) { return neutral ? null : <View style={{position:'absolute',right:8,width:230,top:0,bottom:0,alignItems:'center',justifyContent:'center'}}><Image src={WATERMARK_SYMBOL} style={{width:'100%',height:'78%',objectFit:'contain',opacity:0.075}} /></View> }

function SectionHeading({number,title}:{number:string;title:string}) {
 return <View style={{flexDirection:'row',alignItems:'center',marginBottom:12,marginTop:3}}><Text style={{fontSize:8,color:C.navy,fontFamily:'Helvetica-Bold',backgroundColor:C.gold,borderRadius:4,padding:6,marginRight:9}}>{number}</Text><Text style={{fontSize:13,color:C.white,fontFamily:'Helvetica-Bold'}}>{title}</Text><View style={{height:1,backgroundColor:C.border,flex:1,marginLeft:12}} /></View>
}

function TroncRow({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  if (!value) return null
  return (
    <View style={[s.troncRow, alt ? s.troncRowAlt : null] as any}>
      <Text style={s.troncLabel}>{label}</Text>
      <Text style={s.troncValue}>{value}</Text>
    </View>
  )
}

function ObservationSummary({observation:o,index:i}: {observation:ObservationItem;index:number}) {
 return <View wrap={false} style={{borderBottomWidth:1,borderBottomColor:"#285477",paddingVertical:6}}>
   <Text style={{fontFamily:'Helvetica-Bold'}}>OBS {String(i+1).padStart(2,'0')} · {inspectionLocation(o)}</Text>
   {o.videoReference && <Text>{o.videoReference} · {o.timecode || 'repère non relevé'} · {o.distanceM === undefined ? 'distance non mesurée' : `${o.distanceM} m depuis ${o.pointDepart || 'départ non précisé'}`}</Text>}
   <Text>{o.description || 'Description à compléter'}{o.code ? ` · Code ${o.code}` : ''} · {o.photoUrl ? `${o.videoReference ? 'Capture' : 'Photo'} OBS ${String(i+1).padStart(2,'0')}` : 'Sans image'}</Text>
 </View>
}

/* ============ DOCUMENT ============ */
export function InspectionDocument({ data: raw }: InspectionPDFProps) {
  const data = privateReport(raw, raw.client.nom)
  const clientPrive = raw.diffusion === 'client-prive'
  data.client = { nom: 'Client anonymisé', adresse: clientPrive ? raw.client.adresse : streetOnly(raw.client.adresse), codePostal: clientPrive ? raw.client.codePostal : '', ville: data.client.ville }
  const company = raw.societe?.trim() || 'Aprime Fluides'
  const neutral = !!raw.sousTraitance || company.toLowerCase() !== 'aprime fluides'

  const etat = ETAT_LABEL[data.conclusionEtat]
  const t = data.troncon || {}
  const vocabulary = JSON.stringify([data.observations,data.preconisations,data.resume,t]).toLocaleLowerCase('fr')
  const glossary = GLOSSAIRE.filter(g => g.terme === 'DN' ? !!t.diametre : g.terme === 'ITV' ? data.observations.some(o=>!!o.videoReference) : g.terme === 'EN 13508-2' ? data.observations.some(o=>!!findDefaut(o.code || '')) : vocabulary.includes(g.terme.toLocaleLowerCase('fr')))


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
        <View fixed style={{position:"absolute",left:0,top:64,bottom:44,width:5,backgroundColor:C.navy}} />
        <View fixed style={{position:"absolute",left:0,top:64,width:5,height:95,backgroundColor:C.gold}} />
        <Header company={company} neutral={neutral} />
        <Text style={{ paddingHorizontal: 32, paddingTop: 8, color:'#bdd0e0', fontSize:8, letterSpacing:1 }}>{data.statut === "valide" ? "Validé par le responsable" : "BROUILLON — À VÉRIFIER"}</Text>

        <View style={s.content}>
          {/* Titre */}
          <View style={s.titleBlock}>
            <Watermark neutral={neutral} hero />
            <Text style={{fontSize:8,color:C.gold,letterSpacing:2,marginBottom:13}}>RAPPORT TECHNIQUE / INSPECTION CAMÉRA</Text>
            <View style={s.titleRedBar} />
            <Text style={s.titleMain}>Compte rendu{`\n`}<Text style={{fontFamily:'Helvetica-Bold'}}>d&apos;intervention</Text></Text>
            <Text style={s.titleSub}>Inspection caméra et travaux sur canalisation</Text>
            <Text style={[s.titleSub,{fontSize:7,letterSpacing:0.3,opacity:0.75}]}>{clientPrive ? "CONFIDENTIEL — Usage client, ne pas publier" : "Copie anonymisée — vérifier les images avant partage"}</Text>
          </View>

          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:18,paddingHorizontal:2}}>
            <View><Text style={{fontSize:7,letterSpacing:1.5,color:'#bdd0e0',marginBottom:3}}>LIEU D’INTERVENTION</Text><Text style={{fontSize:21,fontFamily:'Helvetica-Bold',color:C.white}}>{data.client.ville || 'À compléter'}</Text></View>
            <View style={{alignItems:'flex-end'}}><Text style={{fontSize:7,letterSpacing:1.5,color:'#bdd0e0',marginBottom:4}}>DATE DU CONTRÔLE</Text><Text style={{fontSize:12,color:C.white,fontFamily:'Helvetica-Bold'}}>{fmtDateFR(data.dateInspection)}</Text></View>
          </View>
          {/* Méta */}
          <View style={{borderWidth:0,backgroundColor:C.navyDark,padding:0,paddingBottom:6,marginBottom:4}} wrap={false}>
            <Text style={s.metaLabel}>Référence du dossier</Text>
            <Text style={s.metaValue}>{data.numero.match(/.{1,65}/g)?.join('\n') || 'À compléter'}</Text>
          </View>
          <View style={s.metaTable} wrap={false}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Technicien</Text>
              <Text style={s.metaValue}>{data.technicienNom || 'À compléter'}</Text>
            </View>
            <View style={[s.metaCell, s.metaCellLast]}>
              <Text style={s.metaLabel}>Agence</Text>
              <Text style={s.metaValue}>{neutral ? company : (data.agence || company)}</Text>
            </View>
          </View>

          {/* État */}
          <View style={[s.etatBox, { backgroundColor: C.navy }]} wrap={false}>
            <Text style={s.etatLbl}>Résultat du contrôle</Text>
            <Text style={[s.etatVal, { color: C.white }]}>{etat.label}</Text>
          </View>

          <Text style={{fontSize:9,color:'#bdd0e0',marginBottom:12}}>{data.conclusionPrecision || 'Conclusion limitée aux portions accessibles et effectivement contrôlées. Le périmètre et les limites du contrôle restent à préciser.'}</Text>

          {/* Identité */}
          <View style={s.partyTable} wrap={false}>
            <View style={[s.partyCol, s.partyColSep]}>
              <Text style={s.partyHead}>ÉMETTEUR</Text>
              <Text style={s.partyName}>{company}</Text>
              {!neutral && <Text style={s.partyLine}>contact@aprime-fluides.fr · {TEL_PRINCIPAL_FALLBACK}</Text>}
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
          <View wrap={false}><SectionHeading number="01" title="Le réseau contrôlé" />
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

          </View>
          {data.observations.length > 0 && <View>
            <View wrap={false}>
              <SectionHeading number="02" title="Les points relevés" />
              <ObservationSummary observation={data.observations[0]} index={0} />
            </View>
            {data.observations.slice(1).map((o,i)=><ObservationSummary key={i+1} observation={o} index={i+1} />)}
          </View>}
          {/* Observations */}
          {data.observations.length > 0 && (
            <>

              {data.observations.map((o, i) => {
                const def = findDefaut(o.code || '')
                const grav = def ? def.gravite : 1
                return (
                  <View key={i} wrap={false}>{i === 0 && <SectionHeading number="03" title="Constats et intervention en images" />}<View style={s.obsItem}>
                    <View style={s.obsHeader}>
                      <View style={s.obsHeaderLeft}>
                        <Text style={s.obsNum}>{`OBS ${String(i + 1).padStart(2, '0')}`}</Text>
                        <Text style={s.obsPos}>{inspectionLocation(o)}</Text>
                      </View>
                      {def ? (
                        <Text style={[s.obsCode, codeStyle(grav)] as any}>
                          {def.code} · {def.libelle}
                        </Text>
                      ) : null}
                    </View>
                    <View style={s.obsBody}>
                      {o.photoUrl ? (
                        <View style={s.obsPhotoWrap}>
                          <Image src={o.photoUrl} style={s.obsPhotoImg} />
                          <Text style={s.obsPhotoCap}>
                            {o.photoLegende || `Photo ${i + 1}${o.position ? ` — ${o.position}` : ''}`}
                          </Text>
                        </View>
                      ) : null}
                      <View style={s.obsText}><Text style={{fontSize:7,color:C.gold,letterSpacing:1.4,marginBottom:5}}>CONSTAT / INTERVENTION</Text>
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
                      {o.videoReference && <Text style={s.obsDesc}>{o.videoReference} · Repère vidéo : {o.timecode || 'non relevé'}</Text>}
                      {o.troncon && <Text style={s.obsDesc}>Tronçon : {o.troncon} · Départ : {o.pointDepart || 'non précisé'} · Sens : {o.sensInspection || 'non précisé'}</Text>}
                      {o.videoReference && <Text style={s.obsDesc}>{typeof o.distanceM === 'number' ? `Distance : ${o.distanceM} m depuis le départ · Source : ${o.distanceSource || 'non précisée'}` : 'Distance non mesurée'}</Text>}
                      {o.description ? <Text style={s.obsDesc}>{o.description}</Text> : null}
                      </View>
                    </View>
                  </View></View>
                )
              })}
            </>
          )}

          {!data.observations.some(o=>o.videoReference && o.photoUrl) && <View style={s.resumeBox} wrap={false}><Text style={s.resumeTitle}>Vidéos et captures</Text><Text style={s.resumeText}>Aucune capture reliée à une vidéo et à un timecode n’est renseignée. Ajouter les vues caméra utiles si elles sont disponibles.</Text></View>}

          {/* Préconisations */}
          {data.preconisations.length > 0 && (
            <View style={s.precoBox} wrap={false}>
              <Text style={s.precoTitle}>Suites à prévoir</Text>
              {data.preconisations.map((p, i) => (
                <View key={i} style={s.precoItem}>
                  <Text style={s.precoItemTitle}>• {p.titre}</Text>
                  <Text style={s.precoItemDetail}>{p.detail}</Text>
                  {p.urgence ? <Text style={s.precoItemUrgence}>Délai conseillé : {{immediate:'Dès que possible', 'court-terme':'À court terme', preventive:'Lors de l’entretien prévu'}[p.urgence] || p.urgence}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {/* Résumé */}
          {data.resume ? (
            <View style={s.resumeBox} wrap={false}>
              <Text style={s.resumeTitle}>Bilan de l’intervention</Text>
              <Text style={s.resumeText}>{data.resume}</Text>
            </View>
          ) : null}

          {/* Glossaire */}
          {glossary.length > 0 && <View style={s.glossBox} wrap={false}>
            <Text style={s.glossTitle}>Quelques termes utiles</Text>
            {glossary.map(g => (
              <View key={g.terme} style={s.glossRow}>
                <Text style={s.glossTerme}>{g.terme}</Text>
                <Text style={s.glossDef}>{g.def}</Text>
              </View>
            ))}
          </View>}
        </View>

        <Footer numero={data.numero} company={company} neutral={neutral} />
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
    || `inspection-camera-${props.data.numero.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`
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
