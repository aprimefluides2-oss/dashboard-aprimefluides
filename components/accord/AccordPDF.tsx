'use client'
import React from "react"
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import type { AccordIntervention, LigneDevis } from "@/lib/supabase"
import type { EmetteurInfo } from "@/components/accord/ApercuAccord"
import { proxyImageUrl } from "@/lib/proxyImageUrl"
import {
  ACCORD_TITRE,
  MENTION_TVA_FRANCHISE,
  adresseClientComplete,
  blocADemandeExpresse,
  formatDateHeureFR,
  BLOC_C_INFORMATION,
  BLOC_C_TRAVAUX_NON_URGENTS,
} from "@/lib/accord/blocs-legaux"

export type AccordPdfProps = {
  accord: AccordIntervention
  lignes: LigneDevis[]
  emetteur: EmetteurInfo
  telephone: string
}

/* ============ CHARTE ============ */
const C = {
  navy: '#1e3a6f',
  red: '#c0392b',
  border: '#d9dfe7',
  text: '#1e293b',
  muted: '#6b7280',
  soft: '#f2f6fb',
  white: '#ffffff',
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.white,
    lineHeight: 1.5,
    paddingTop: 0,
    paddingBottom: 56,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 40, paddingTop: 18, paddingBottom: 10,
    borderBottomWidth: 2, borderBottomColor: C.red,
  },
  brand: { color: C.navy, fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3 },
  brandTag: { color: C.muted, fontSize: 7.5, marginTop: 2 },
  headerPhone: { color: C.text, fontSize: 8.5, fontFamily: 'Helvetica-Oblique' },

  content: { paddingHorizontal: 40, paddingTop: 14 },

  titleBar: { flexDirection: 'row', marginBottom: 14 },
  titleRed: { width: 5, backgroundColor: C.red },
  titleInner: { flex: 1, backgroundColor: C.navy, paddingVertical: 12, paddingHorizontal: 16 },
  titleMain: {
    color: C.white, fontSize: 16, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  titleSub: { color: '#c8d4e8', fontSize: 8.5, marginTop: 4 },

  partyTable: { flexDirection: 'row', borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  partyCol: { flex: 1, padding: 10 },
  partyColSep: { borderRightWidth: 1, borderRightColor: C.border },
  partyHead: {
    color: C.muted, fontSize: 7.5, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  partyName: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginBottom: 2 },
  partyLine: { fontSize: 8.5, marginBottom: 1 },

  band: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.navy, paddingVertical: 6, paddingHorizontal: 12, marginTop: 6,
  },
  bandLetter: {
    color: C.navy, backgroundColor: C.white, fontSize: 9,
    fontFamily: 'Helvetica-Bold', paddingHorizontal: 4, paddingVertical: 1,
  },
  bandTxt: { color: C.white, fontSize: 9.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3 },

  box: {
    borderWidth: 1, borderColor: C.border, borderTopWidth: 0,
    padding: 12, marginBottom: 8,
  },
  para: { fontSize: 9, lineHeight: 1.55, textAlign: 'justify' },
  paraAlt: {
    fontSize: 8.5, lineHeight: 1.5, marginTop: 8, padding: 8,
    backgroundColor: C.soft, borderWidth: 1, borderColor: C.border,
  },
  lieu: { fontSize: 8, color: C.muted, marginBottom: 6 },

  table: { borderWidth: 1, borderColor: C.border, marginTop: 2 },
  tHead: { flexDirection: 'row', backgroundColor: C.navy },
  tHeadCell: {
    color: C.white, fontSize: 7.5, fontFamily: 'Helvetica-Bold',
    padding: 6, textTransform: 'uppercase',
  },
  tRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  tCell: { fontSize: 8.5, padding: 6 },
  cDesig: { width: '40%' },
  cCar: { width: '17%', textAlign: 'center' },
  cQte: { width: '13%', textAlign: 'center' },
  cPu: { width: '15%', textAlign: 'right' },
  cTot: { width: '15%', textAlign: 'right' },
  urgent: { color: C.red, fontFamily: 'Helvetica-Bold' },
  nonUrgent: { color: C.muted },

  totaux: { alignSelf: 'flex-end', width: '55%', marginTop: 8 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totLbl: { fontSize: 8.5 },
  totVal: { fontSize: 8.5 },
  totTtc: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.navy, paddingVertical: 6, paddingHorizontal: 8, marginTop: 3,
  },
  totTtcLbl: { color: C.white, fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  totTtcVal: { color: C.white, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  tvaNote: {
    fontSize: 7.5, color: C.muted, fontFamily: 'Helvetica-Oblique',
    textAlign: 'right', marginTop: 3,
  },
  devisNote: { fontSize: 7.5, color: C.muted, marginTop: 6 },

  sigTable: { flexDirection: 'row', borderWidth: 1, borderColor: C.border, marginTop: 10 },
  sigCol: { flex: 1, padding: 10 },
  sigColSep: { borderRightWidth: 1, borderRightColor: C.border },
  sigHead: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  sigLine: { fontSize: 8, marginBottom: 6 },
  sigImg: { height: 56, marginVertical: 4, objectFit: 'contain' },
  sigPlaceholder: {
    fontSize: 8, color: C.muted, fontFamily: 'Helvetica-Oblique', marginTop: 18,
  },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 40, paddingTop: 8, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerTxt: { color: C.muted, fontSize: 7 },
})

// toLocaleString('fr-FR') insère des espaces fines insécables que Helvetica ne
// rend pas dans react-pdf : on normalise toute espace en espace ordinaire.
const fmtEur = (n: number | null | undefined) =>
  (Number(n) || 0)
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/\s/g, ' ') + ' €'

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw
}

/** Document PDF de l'accord d'intervention (blocs A / B / C + signature). */
export function AccordDocument({ accord, lignes, emetteur, telephone }: AccordPdfProps) {
  const dateAccord = accord.valide_at || accord.created_at
  const dateHeure = formatDateHeureFR(dateAccord)
  const adresseClient = adresseClientComplete(accord)
  const sousTotal = lignes.reduce((sum, l) => sum + (l.total_ligne || 0), 0)
  const sansTVA = !accord.taux_tva || accord.taux_tva <= 0

  return (
    <Document title={`${ACCORD_TITRE} ${accord.reference || ''}`.trim()}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header} fixed>
          <View>
            <Text style={s.brand}>{emetteur.raisonSociale}</Text>
            <Text style={s.brandTag}>Débouchage · Assainissement · Plomberie d&apos;urgence</Text>
          </View>
          <Text style={s.headerPhone}>Tél. {telephone}</Text>
        </View>

        <View style={s.content}>
          {/* Titre */}
          <View style={s.titleBar}>
            <View style={s.titleRed} />
            <View style={s.titleInner}>
              <Text style={s.titleMain}>{ACCORD_TITRE}</Text>
              <Text style={s.titleSub}>
                {(accord.reference || accord.id.slice(0, 8)) + ' · établi le ' + fmtDate(dateAccord)}
              </Text>
            </View>
          </View>

          {/* Émetteur / Client */}
          <View style={s.partyTable}>
            <View style={[s.partyCol, s.partyColSep]}>
              <Text style={s.partyHead}>Entreprise</Text>
              <Text style={s.partyName}>{emetteur.raisonSociale}</Text>
              {emetteur.adresseLignes.map((l, i) => (
                <Text key={i} style={s.partyLine}>{l}</Text>
              ))}
              <Text style={s.partyLine}>Tél. {telephone}</Text>
              <Text style={s.partyLine}>{emetteur.email}</Text>
            </View>
            <View style={s.partyCol}>
              <Text style={s.partyHead}>Client</Text>
              <Text style={s.partyName}>{accord.client_nom || '—'}</Text>
              <Text style={s.partyLine}>{adresseClient || '—'}</Text>
              {accord.client_telephone ? (
                <Text style={s.partyLine}>Tél. {accord.client_telephone}</Text>
              ) : null}
              {accord.client_email ? <Text style={s.partyLine}>{accord.client_email}</Text> : null}
            </View>
          </View>

          {/* Bloc A */}
          <View wrap={false}>
            <View style={s.band}>
              <Text style={s.bandLetter}>A</Text>
              <Text style={s.bandTxt}>Demande expresse d&apos;intervention en urgence</Text>
            </View>
            <View style={s.box}>
              <Text style={s.para}>{blocADemandeExpresse(accord, dateHeure)}</Text>
            </View>
          </View>

          {/* Bloc B — devis */}
          <View style={s.band}>
            <Text style={s.bandLetter}>B</Text>
            <Text style={s.bandTxt}>Devis détaillé</Text>
          </View>
          <View style={s.box}>
            <Text style={s.lieu}>Lieu d&apos;exécution : {adresseClient || '—'}</Text>
            <View style={s.table}>
              <View style={s.tHead} fixed>
                <Text style={[s.tHeadCell, s.cDesig]}>Prestation</Text>
                <Text style={[s.tHeadCell, s.cCar]}>Caractère</Text>
                <Text style={[s.tHeadCell, s.cQte]}>Qté</Text>
                <Text style={[s.tHeadCell, s.cPu]}>P.U.</Text>
                <Text style={[s.tHeadCell, s.cTot]}>Total</Text>
              </View>
              {lignes.map(l => (
                <View key={l.id} style={s.tRow} wrap={false}>
                  <Text style={[s.tCell, s.cDesig]}>{l.label}</Text>
                  <Text style={[s.tCell, s.cCar, l.urgent ? s.urgent : s.nonUrgent]}>
                    {l.urgent ? 'Urgent' : 'Non urgent'}
                  </Text>
                  <Text style={[s.tCell, s.cQte]}>{`${l.quantite} ${l.unite}`}</Text>
                  <Text style={[s.tCell, s.cPu]}>{fmtEur(l.prix_unitaire)}</Text>
                  <Text style={[s.tCell, s.cTot]}>{fmtEur(l.total_ligne)}</Text>
                </View>
              ))}
            </View>

            <View style={s.totaux} wrap={false}>
              <View style={s.totRow}>
                <Text style={s.totLbl}>Sous-total prestations</Text>
                <Text style={s.totVal}>{fmtEur(sousTotal)}</Text>
              </View>
              <View style={s.totRow}>
                <Text style={s.totLbl}>Frais de déplacement</Text>
                <Text style={s.totVal}>{fmtEur(accord.frais_deplacement)}</Text>
              </View>
              <View style={s.totRow}>
                <Text style={s.totLbl}>Total HT</Text>
                <Text style={s.totVal}>{fmtEur(accord.total_ht)}</Text>
              </View>
              {!sansTVA ? (
                <View style={s.totRow}>
                  <Text style={s.totLbl}>{`TVA (${accord.taux_tva} %)`}</Text>
                  <Text style={s.totVal}>{fmtEur(accord.total_tva)}</Text>
                </View>
              ) : null}
              <View style={s.totTtc}>
                <Text style={s.totTtcLbl}>Total à payer</Text>
                <Text style={s.totTtcVal}>{fmtEur(accord.total_ttc)}</Text>
              </View>
              {sansTVA ? <Text style={s.tvaNote}>{MENTION_TVA_FRANCHISE}</Text> : null}
            </View>

            <Text style={s.devisNote}>
              {`Devis ${accord.devis_gratuit ? 'gratuit' : 'payant'} · valable ${accord.validite_jours} jours à compter de sa date d'établissement.`}
            </Text>
          </View>

          {/* Bloc C — rétractation */}
          <View style={s.band}>
            <Text style={s.bandLetter}>C</Text>
            <Text style={s.bandTxt}>Information sur le droit de rétractation</Text>
          </View>
          <View style={s.box}>
            <Text style={s.para}>{BLOC_C_INFORMATION}</Text>
            {accord.a_travaux_non_urgents ? (
              <Text style={s.paraAlt}>{BLOC_C_TRAVAUX_NON_URGENTS}</Text>
            ) : null}
          </View>

          {/* Signatures */}
          <View style={s.sigTable} wrap={false}>
            <View style={[s.sigCol, s.sigColSep]}>
              <Text style={s.sigHead}>{emetteur.raisonSociale}</Text>
              <Text style={s.sigLine}>Date : {fmtDate(dateAccord)}</Text>
              <Text style={s.sigLine}>Cachet &amp; signature</Text>
            </View>
            <View style={s.sigCol}>
              <Text style={s.sigHead}>
                Client — bon pour accord, demande expresse &amp; renonciation
              </Text>
              {accord.signature_image ? (
                <>
                  <Image style={s.sigImg} src={proxyImageUrl(accord.signature_image)} />
                  <Text style={s.sigLine}>{`Validé le ${formatDateHeureFR(accord.valide_at)}`}</Text>
                </>
              ) : (
                <Text style={s.sigPlaceholder}>Signature à recueillir</Text>
              )}
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>
            {[emetteur.raisonSociale, ...emetteur.adresseLignes].join(' · ')}
          </Text>
          <Text
            style={s.footerTxt}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
