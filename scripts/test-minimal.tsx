import { Document, Page, Text, View, StyleSheet, renderToFile } from '@react-pdf/renderer'
import { createElement } from 'react'

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  para: { marginBottom: 6 },
})

const Doc = () =>
  createElement(Document, {},
    createElement(Page, { size: 'A4', style: s.page },
      createElement(Text, { style: s.title }, 'HELLO LTDB'),
      createElement(Text, { style: s.para }, 'Ceci est un test minimal de rendu PDF avec @react-pdf/renderer.'),
      createElement(View, { style: { marginTop: 20, padding: 12, backgroundColor: '#1e3a6f' } },
        createElement(Text, { style: { color: 'white', fontSize: 14, fontFamily: 'Helvetica-Bold' } }, 'Bloc bleu marine avec texte blanc')
      ),
    )
  )

renderToFile(Doc(), '/tmp/test-minimal.pdf').then(() => {
  console.log('OK → /tmp/test-minimal.pdf')
}).catch(e => {
  console.error('FAIL:', e)
  process.exit(1)
})
