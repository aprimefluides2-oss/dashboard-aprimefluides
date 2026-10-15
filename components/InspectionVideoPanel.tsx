'use client'
import { useEffect, useRef, useState } from 'react'
import type { ObservationItem } from './InspectionCameraPDF'

export default function InspectionVideoPanel({ onCapture }: { onCapture: (observation: ObservationItem) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [source, setSource] = useState('')
  const [caption, setCaption] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => () => { if (source) URL.revokeObjectURL(source) }, [source])
  function capture() {
    const v = video.current
    if (!v || !v.videoWidth) { setMessage('Chargez une vidéo et attendez son ouverture.'); return }
    try {
      v.pause()
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1600 / v.videoWidth)
      canvas.width = Math.round(v.videoWidth * scale)
      canvas.height = Math.round(v.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Capture indisponible sur cet appareil.')
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      const time = Math.floor(v.currentTime)
      const position = `Vidéo ${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`
      onCapture({ position, description: '', photoUrl: canvas.toDataURL('image/jpeg', 0.85), photoLegende: caption.trim() })
      setMessage(`Capture ajoutée aux observations : ${position}. Complétez la description et vérifiez la confidentialité de l’image.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Capture impossible.') }
  }
  return <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
    <h2 className="text-lg font-bold text-[#0e2a52]">Vidéo d’inspection et captures</h2>
    <label className="block">Choisir une vidéo sur cet appareil
      <input className="block mt-2" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!['video/mp4','video/webm','video/quicktime'].includes(file.type)) { setMessage('Choisissez une vidéo MP4, WebM ou MOV.'); return }
        setSource(URL.createObjectURL(file)); setMessage('Vidéo ouverte sur cet appareil uniquement. Elle n’est pas envoyée au serveur.')
      }} />
    </label>
    {source && <video ref={video} src={source} controls playsInline preload="metadata" className="w-full max-h-96 bg-black" onError={() => setMessage('Format non lisible sur cet appareil. Essayez une version MP4 compatible.')} />}
    <label className="block">Légende de la prochaine capture
      <input maxLength={400} className="block w-full border rounded-lg p-2 mt-1" value={caption} onChange={e => setCaption(e.target.value)} />
    </label>
    <button type="button" disabled={!source} onClick={capture} className="bg-[#0e2a52] text-white px-4 py-2 rounded-lg disabled:opacity-50">Capturer l’image à cet instant</button>
    <p role="status" className="text-sm">{message}</p>
    <p className="text-sm text-slate-600">Les captures sont ajoutées au rapport PDF avec leur repère vidéo. Les fichiers restent dans cet onglet : téléchargez le rapport avant de quitter. Aucun transfert ou publication de la vidéo. N’utilisez que des médias autorisés ; vérifiez les noms et adresses visibles dans les images.</p>
  </section>
}
