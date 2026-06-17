import { Document, Page, Text, View, StyleSheet, renderToFile } from '@react-pdf/renderer'
import { createElement, Fragment } from 'react'

const C = {
  navy: '#1e3a6f', red: '#c0392b', border: '#d9dfe7',
  text: '#1e293b', muted: '#6b7280', white: '#ffffff',
  rowAlt: '#eaf1fa',
}

const s = StyleSheet.create({
  page: {
    paddingTop: 70, paddingBottom: 55, paddingHorizontal: 0,
    fontFamily: 'Helvetica', fontSize: 9.5, color: C.text,
    backgroundColor: C.white, lineHeight: 1.45,
  },
  headerTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 40, paddingTop: 18, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.white,
  },
  headerRule: {
    position: 'absolute', top: 48, left: 0, right: 0,
    height: 2, backgroundColor: C.red,
  },
  content: { paddingHorizontal: 40, paddingTop: 6 },
  titleBlock: { flexDirection: 'row', marginTop: 4, marginBottom: 14 },
  titleRedBar: { width: 6, backgroundColor: C.red },
  titleInner: { flex: 1, backgroundColor: C.navy, paddingVertical: 20, paddingHorizontal: 22 },
  titleMain: { color: C.white, fontSize: 22, fontFamily: 'Helvetica-Bold' },
  para: { marginBottom: 8 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 40, paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.white,
  },
  footerL: { color: C.muted, fontSize: 7.5 },
})

const TEST = process.env.TEST || 'all'

function Doc() {
  const children: any[] = []

  // Title block
  children.push(
    createElement(View, { style: s.content },
      createElement(View, { style: s.titleBlock, wrap: false as any },
        createElement(View, { style: s.titleRedBar }),
        createElement(View, { style: s.titleInner },
          createElement(Text, { style: s.titleMain }, 'Test layout')
        ),
      ),
      createElement(Text, { style: s.para }, 'Ligne de test normale sous le titre.'),
      createElement(Text, { style: s.para }, 'Seconde ligne pour bien voir.'),
    )
  )

  const pageProps: any = { size: 'A4', style: s.page }

  if (TEST === 'all' || TEST === 'fixed') {
    // Fixed header + footer
    return createElement(Document, {},
      createElement(Page, pageProps,
        createElement(View, { style: s.headerTop, fixed: true } as any,
          createElement(Text, {}, 'LTDB header')
        ),
        createElement(View, { style: s.headerRule, fixed: true } as any),
        ...children,
        createElement(View, { style: s.footer, fixed: true } as any,
          createElement(Text, { style: s.footerL }, 'Footer'),
          createElement(Text, { style: s.footerL,
            render: (({ pageNumber, totalPages }: any) => `${pageNumber}/${totalPages}`) as any,
          } as any)
        ),
      )
    )
  }

  return createElement(Document, {},
    createElement(Page, pageProps, ...children)
  )
}

renderToFile(Doc(), `/tmp/test-bisect-${TEST}.pdf`).then(() => {
  console.log(`OK → /tmp/test-bisect-${TEST}.pdf`)
}).catch(e => { console.error('FAIL:', e); process.exit(1) })
