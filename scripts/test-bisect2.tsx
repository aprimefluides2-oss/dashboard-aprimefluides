import { Document, Page, Text, View, StyleSheet, renderToFile } from '@react-pdf/renderer'
import { createElement } from 'react'

const C = {
  navy: '#1e3a6f', red: '#c0392b', border: '#d9dfe7',
  text: '#1e293b', muted: '#6b7280', white: '#ffffff',
}

const s = StyleSheet.create({
  page: {
    paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0,
    fontFamily: 'Helvetica', fontSize: 9.5, color: C.text,
    backgroundColor: C.white, lineHeight: 1.45,
  },
  // Header WITHOUT position:absolute, but WITH fixed
  header: {
    paddingHorizontal: 40, paddingTop: 18, paddingBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: C.red,
  },
  content: { paddingHorizontal: 40, paddingTop: 10, paddingBottom: 10, flexGrow: 1 },
  titleBlock: { flexDirection: 'row', marginTop: 4, marginBottom: 14 },
  titleRedBar: { width: 6, backgroundColor: C.red },
  titleInner: { flex: 1, backgroundColor: C.navy, paddingVertical: 20, paddingHorizontal: 22 },
  titleMain: { color: C.white, fontSize: 22, fontFamily: 'Helvetica-Bold' },
  para: { marginBottom: 8 },
  footer: {
    paddingHorizontal: 40, paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerL: { color: C.muted, fontSize: 7.5 },
})

function Doc() {
  return createElement(Document, {},
    createElement(Page, { size: 'A4', style: s.page },
      // Fixed header (flow, pas absolute)
      createElement(View, { style: s.header, fixed: true } as any,
        createElement(Text, {}, 'LTDB header'),
        createElement(Text, {}, 'Tél. 01 39 47 17 09'),
      ),
      // Content
      createElement(View, { style: s.content },
        createElement(View, { style: s.titleBlock, wrap: false as any },
          createElement(View, { style: s.titleRedBar }),
          createElement(View, { style: s.titleInner },
            createElement(Text, { style: s.titleMain }, 'Test layout v2')
          ),
        ),
        createElement(Text, { style: s.para }, 'Ligne de test normale sous le titre.'),
        createElement(Text, { style: s.para }, 'Seconde ligne pour bien voir.'),
      ),
      // Fixed footer (flow, pas absolute)
      createElement(View, { style: s.footer, fixed: true } as any,
        createElement(Text, { style: s.footerL }, 'Footer LTDB'),
        createElement(Text, {
          style: s.footerL,
          render: (({ pageNumber, totalPages }: any) => `${pageNumber}/${totalPages}`) as any,
        } as any),
      ),
    )
  )
}

renderToFile(Doc(), '/tmp/test-bisect2.pdf').then(() => {
  console.log('OK → /tmp/test-bisect2.pdf')
}).catch(e => { console.error('FAIL:', e); process.exit(1) })
