'use client'
import { PDFViewer } from "@react-pdf/renderer"
import { RealisationDocument, type PDFProps } from "./RealisationPDF"

export default function PDFPreviewModal({ open, onClose, pdfProps }: { open: boolean; onClose: () => void; pdfProps: PDFProps }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 py-3 border-b bg-slate-50">
          <h3 className="font-black text-[#0e2a52] text-lg">👁 Aperçu PDF</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center">✕</button>
        </div>
        <div className="flex-1 bg-slate-100">
          <PDFViewer width="100%" height="100%" showToolbar style={{ border: 'none' }}>
            <RealisationDocument {...pdfProps} />
          </PDFViewer>
        </div>
      </div>
    </div>
  )
}
