'use client'
import { useRef, useState } from "react"
import { fileToSignatureDataUrl } from "@/lib/technicien-signature"

type Props = {
  /** Data URL PNG de la signature, ou null. */
  value: string | null
  /** Appelé avec le nouveau data URL (ou null si supprimée). */
  onChange: (v: string | null) => void
}

/**
 * Champ « Ma signature » : le technicien importe une image (PNG/scan) une fois.
 * Elle est mémorisée (via le parent → localStorage) et rendue sur ses PDF.
 */
export default function TechnicienSignatureField({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErr('Choisis une image (PNG, JPG…).')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      onChange(await fileToSignatureDataUrl(file))
    } catch (e: any) {
      setErr(e?.message || 'Import impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-500 mb-1">Ma signature</div>
      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Signature du technicien"
            className="h-12 w-auto max-w-[160px] object-contain rounded-md border border-slate-200 bg-white p-1"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs font-semibold text-[#0e2a52] hover:underline"
            >
              Remplacer
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs font-semibold text-slate-400 hover:text-red-600"
            >
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full text-sm font-semibold text-[#0e2a52] border-2 border-dashed border-slate-300 rounded-xl px-3 py-2.5 hover:border-slate-400 disabled:opacity-50"
        >
          {busy ? 'Import…' : '⬆ Importer une image de signature'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {err ? <div className="text-[11px] text-red-600 mt-1">{err}</div> : null}
      <div className="text-[10px] text-slate-400 mt-1">
        Mémorisée sur cet appareil, ajoutée automatiquement à tes rapports.
      </div>
    </div>
  )
}
