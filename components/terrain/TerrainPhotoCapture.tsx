'use client'
import { readRecovery, saveRecovery, removeRecovery } from "@/lib/recovery-store"
import { useEffect, useRef, useState } from "react"

interface TerrainPhotoCaptureProps {
  interventionId: string
  legendeDefaut: string
  /** Appelé après upload réussi (URL publique de la photo) */
  onUploaded: (url: string, terrain_step: number) => void
  /** Texte du gros bouton principal */
  titre?: string
}

/**
 * Composant de capture photo unique avec 3 sources : caméra, galerie, fichier.
 * Compresse côté client puis upload vers /api/interventions/[id]/photo.
 */
export default function TerrainPhotoCapture({
  interventionId,
  legendeDefaut,
  onUploaded,
  titre = 'Prendre une photo',
}: TerrainPhotoCaptureProps) {
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [pendingReady, setPendingReady] = useState(false)
  const pendingId = useRef('')
  const pendingKey = `terrain-photo:${interventionId}:${legendeDefaut}`
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    setPendingReady(false)
    void readRecovery<{ file: Blob; name: string; id: string }>(pendingKey).then(saved => {
      if (cancelled) return
      pendingId.current = saved?.id || ''
      setPendingPhoto(saved ? new File([saved.file], saved.name, { type: saved.file.type }) : null)
      if (saved) setError('Une photo attend son envoi. Réessayez lorsque la connexion revient.')
    }).catch(() => { if (!cancelled) setError('Reprise locale indisponible : ne fermez pas cette page avant l’envoi.') })
      .finally(() => { if (!cancelled) setPendingReady(true) })
    return () => { cancelled = true }
  }, [pendingKey])

  async function sendPhoto(file: File) {
    setUploading(true); setError('')
    try {
      const fd = new FormData(); fd.append('photo', file); fd.append('legende', legendeDefaut); fd.append('photo_id', pendingId.current)
      const res = await fetch(`/api/interventions/${interventionId}/photo`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Envoi non confirmé')
      await removeRecovery(pendingKey)
      setPendingPhoto(null)
      onUploaded(data.url, data.terrain_step)
    } catch (e: unknown) {
      setError(`${e instanceof Error ? e.message : String(e)} La photo reste en attente sur cet appareil.`)
    } finally { setUploading(false) }
  }

  async function compress(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const maxDim = 1920
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim }
          else { width = Math.round(width * maxDim / height); height = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas non supporté'))
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          blob => {
            if (!blob) return reject(new Error('Compression échouée'))
            resolve(new File([blob], file.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg'), { type: 'image/jpeg' }))
          },
          'image/jpeg',
          0.82,
        )
      }
      img.onerror = () => reject(new Error('Lecture image impossible'))
      img.src = dataUrl
    })
  }

  async function handleFile(file: File | null) {
    if (!file || !pendingReady || uploading || pendingPhoto) return
    setError(''); setUploading(true)
    try {
      const compressed = await compress(file)
      setPreview(URL.createObjectURL(compressed))
      pendingId.current = crypto.randomUUID()
      await saveRecovery(pendingKey, { file: compressed, name: compressed.name, id: pendingId.current })
      setPendingPhoto(compressed)
      await sendPhoto(compressed)
    } catch (e: unknown) {
      setError(`Photo non sauvegardée : ${e instanceof Error ? e.message : String(e)}. Gardez l’original et réessayez.`)
    } finally { setUploading(false) }
  }

  return (
    <div className="space-y-4">
      {/* Inputs cachés — un par source */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0] || null)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0] || null)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0] || null)}
      />

      {preview && (
        <div className="rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50">
          <img src={preview} alt="Aperçu" className="w-full h-auto max-h-80 object-contain" />
        </div>
      )}

      {pendingPhoto && !uploading && <button type="button" className="w-full rounded-xl bg-blue-700 p-4 text-white" onClick={() => void sendPhoto(pendingPhoto)}>Réessayer l’envoi de la photo conservée</button>}
      {!uploading && !pendingPhoto && pendingReady && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-5 px-6 font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition disabled:opacity-50"
          >
            <span className="text-3xl">📷</span>
            {titre}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading}
              className="bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl py-4 font-bold text-sm flex flex-col items-center gap-1 transition disabled:opacity-50"
            >
              <span className="text-2xl">🖼</span>
              Galerie
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl py-4 font-bold text-sm flex flex-col items-center gap-1 transition disabled:opacity-50"
            >
              <span className="text-2xl">📁</span>
              Fichier
            </button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 text-center">
          <div className="animate-spin h-8 w-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm font-bold text-blue-700">Envoi en cours…</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-700 p-3 rounded-xl text-sm font-semibold">
          ⚠ {error}
        </div>
      )}
    </div>
  )
}
