'use client'
import dynamic from "next/dynamic"
import type { AccordPdfProps } from "@/components/accord/AccordPDF"

/**
 * Wrapper client : charge GenererPdfButton (et @react-pdf/renderer) dans un
 * chunk séparé, à la demande. Garde la page /accord/[id] légère — même approche
 * que les pages devis / facture / attestation.
 */
const GenererPdfButton = dynamic(() => import("@/components/accord/GenererPdfButton"), {
  ssr: false,
  loading: () => <div className="text-sm text-slate-400">Chargement du module PDF…</div>,
})

type Props = AccordPdfProps & { pdfUrl: string | null }

export default function GenererPdfButtonLazy(props: Props) {
  return <GenererPdfButton {...props} />
}
