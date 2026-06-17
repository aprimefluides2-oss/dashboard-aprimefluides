'use client'
import { pdf } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

export async function pdfElementToBlob(doc: ReactElement): Promise<Blob> {
  // pdf() de @react-pdf/renderer attend strictement un ReactElement<DocumentProps>,
  // mais on lui passe ici un élément créé à partir de nos composants (FactureDocument,
  // DevisDocument, etc.) qui retournent eux-mêmes un <Document>. Le typage relâché
  // ReactElement contourne l'incompatibilité.
  return pdf(doc).toBlob()
}

export async function pdfDocumentToBase64(doc: ReactElement): Promise<string> {
  const blob = await pdfElementToBlob(doc)
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}
