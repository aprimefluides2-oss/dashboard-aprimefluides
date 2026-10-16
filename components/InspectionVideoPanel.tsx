'use client'
import { useEffect, useRef, useState } from 'react'
import type { ObservationItem } from './InspectionCameraPDF'
type Clip = { id: string; file: File; url: string }
export default function InspectionVideoPanel({ onCapture }: { onCapture: (observation: ObservationItem) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const urls = useRef<string[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [selected, setSelected] = useState('')
  const [caption, setCaption] = useState('')
  const [troncon, setTroncon] = useState('')
  const [depart, setDepart] = useState('')
  const [sens, setSens] = useState('')
  const [distance, setDistance] = useState('')
  const [origine, setOrigine] = useState('Compteur visible dans la vidéo')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const clip = clips.find(c => c.id === selected)
  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)) }, [])
  function capture() {
    const v = video.current
    if (!v || !v.videoWidth || !clip) { setMessage('Chargez une vidéo et attendez son ouverture.'); return }
    if (!troncon.trim() || !depart.trim() || !sens.trim() || !description.trim()) { setMessage('Précisez le tronçon, le point de départ, le sens et le défaut observé.'); return }
    const meters = distance === '' ? undefined : Number(distance)
    if (meters !== undefined && (!Number.isFinite(meters) || meters < 0)) { setMessage('La distance doit être un nombre positif ou zéro.'); return }
    try {
      v.pause()
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1600 / v.videoWidth)
      canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Capture indisponible sur cet appareil.')
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      const time = Math.floor(v.currentTime)
      const timecode = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`
      onCapture({ position: `${troncon.trim()} — ${meters === undefined ? 'distance non mesurée' : `${meters} m`}`, videoReference: clip.id, timecode, troncon: troncon.trim(), pointDepart: depart.trim(), sensInspection: sens.trim(), distanceM: meters, distanceSource: meters === undefined ? undefined : origine, description: description.trim(), photoUrl: canvas.toDataURL('image/jpeg', 0.85), photoLegende: caption.trim() })
      setMessage(`Capture ajoutée : ${clip.id}, ${timecode}. Vérifiez le relevé dans les observations.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Capture impossible.') }
  }
  const input = 'block w-full border rounded-lg p-2 mt-1'
  return <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
    <h2 className="text-lg font-bold text-[#0e2a52]">Lecture des vidéos de la clé USB</h2>
    <label className="block">Ajouter plusieurs vidéos depuis la clé ou cet appareil
      <input className="block mt-2" type="file" multiple accept=".mp4,.webm,.mov,.m4v,.avi,video/*" onChange={e => {
        const files = Array.from(e.target.files || [])
        const accepted = files.filter(file => /\.(mp4|webm|mov|m4v|avi)$/i.test(file.name))
        const added = accepted.map((file, i) => { const url = URL.createObjectURL(file); urls.current.push(url); return { file, url, id: `Vidéo ${clips.length+i+1}` } })
        setClips(prev => [...prev, ...added]); if (!selected && added.length) setSelected(added[0].id)
        setMessage(`${added.length} vidéo(s) ajoutée(s) localement. ${files.length-accepted.length} fichier(s) non pris en charge. Certains codecs AVI/MOV peuvent nécessiter une conversion MP4.`)
        e.target.value = ''
      }} />
    </label>
    {!!clips.length && <label className="block">Vidéo à examiner<select className={input} value={selected} onChange={e => { video.current?.pause(); setSelected(e.target.value); setDistance(''); setDescription(''); setCaption(''); setTroncon(''); setDepart(''); setSens('') }}>{clips.map(c => <option key={c.id} value={c.id}>{c.id} — {c.file.name}</option>)}</select></label>}
    {clip && <video key={clip.id} ref={video} src={clip.url} controls playsInline preload="metadata" className="w-full max-h-96 bg-black" onError={() => setMessage('Vidéo non lisible sur cet appareil. Convertissez une copie en MP4 compatible sans modifier l’original.')} />}
    <div className="grid sm:grid-cols-2 gap-3">
      <label>Tronçon / point filmé<input className={input} value={troncon} onChange={e => setTroncon(e.target.value)} placeholder="T1 — regard vers maison" maxLength={160} /></label>
      <label>Point de départ du compteur<input className={input} value={depart} onChange={e => setDepart(e.target.value)} placeholder="Regard R1, compteur remis à zéro" maxLength={160} /></label>
      <label>Sens de progression<input className={input} value={sens} onChange={e => setSens(e.target.value)} placeholder="R1 vers habitation" maxLength={160} /></label>
      <label>Distance du défaut depuis ce départ (m)<input type="number" min="0" step="0.01" className={input} value={distance} onChange={e => setDistance(e.target.value)} placeholder="Laisser vide si non mesurée" /></label>
      <label>Origine de la mesure<select className={input} value={origine} onChange={e => setOrigine(e.target.value)}><option>Compteur visible dans la vidéo</option><option>Relevé communiqué par le technicien</option></select></label>
      <label>Défaut observé<input className={input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex. cassure visible — à valider" maxLength={1200} /></label>
    </div>
    <p className="text-sm text-slate-600">La distance est relevée manuellement : le temps de la vidéo ne permet pas de calculer les mètres. Les références Vidéo 1, Vidéo 2… apparaissent dans le rapport ; les noms de fichiers restent visibles uniquement ici.</p>
    <label className="block">Légende de la prochaine capture<input maxLength={400} className={input} value={caption} onChange={e => setCaption(e.target.value)} /></label>
    <button type="button" disabled={!clip} onClick={capture} className="bg-[#0e2a52] text-white px-4 py-2 rounded-lg disabled:opacity-50">Relever l’incident et capturer l’image</button>
    <p role="status" className="text-sm">{message}</p>
    <p className="text-sm text-slate-600">Aucun transfert ni publication de la vidéo. Les données restent dans cet onglet : téléchargez le PDF avant de quitter. Conservez les vidéos originales de la clé avec les mêmes références. Vérifiez les données visibles dans les captures avant tout partage.</p>
  </section>
}
