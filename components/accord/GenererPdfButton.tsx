'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"
import { pdfElementToBlob } from "@/lib/pdfToBase64"
import { AccordDocument, type AccordPdfProps } from "@/components/accord/AccordPDF"

type Props = AccordPdfProps & { pdfUrl: string | null }

/**
 * Génère le PDF de l'accord côté client (@react-pdf/renderer), puis l'envoie
 * à /api/accords/[id]/pdf qui l'archive sur Supabase Storage.
 */
export default function GenererPdfButton({ accord, lignes, emetteur, telephone, pdfUrl }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(pdfUrl)

  async function generer() {
    setBusy(true)
    setError(null)
    try {
      const blob = await pdfElementToBlob(
        <AccordDocument accord={accord} lignes={lignes} emetteur={emetteur} telephone={telephone} />,
      )
      const filename = `accord-${accord.reference || accord.id}.pdf`
      const fd = new FormData()
      fd.append('pdf', new File([blob], filename, { type: 'application/pdf' }))
      const res = await fetch(`/api/accords/${accord.id}/pdf`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || `HTTP ${res.status}`)
      setUrl(data.url as string)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={generer}
          disabled={busy}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm disabled:opacity-60 transition"
        >
          {busy ? 'Génération…' : url ? '↻ Régénérer le PDF' : '📄 Générer le PDF'}
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-bold text-sm transition"
          >
            ⬇ Voir le PDF archivé
          </a>
        )}
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs">
          {error}
        </div>
      )}
    </div>
  )
}
