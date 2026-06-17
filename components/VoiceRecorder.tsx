'use client'
import { useState, useRef } from "react"

interface VoiceRecorderProps {
  onTranscription: (text: string) => void
}

export default function VoiceRecorder({ onTranscription }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Détecte le mime type supporté (iOS Safari = mp4, autres = webm/opus)
  function pickMimeType(): { mime: string; ext: string } {
    if (typeof MediaRecorder === 'undefined') return { mime: '', ext: 'webm' }
    const candidates = [
      { mime: 'audio/webm;codecs=opus', ext: 'webm' },
      { mime: 'audio/webm', ext: 'webm' },
      { mime: 'audio/mp4', ext: 'mp4' },     // iOS Safari
      { mime: 'audio/mp4;codecs=mp4a.40.2', ext: 'mp4' },
      { mime: 'audio/aac', ext: 'aac' },
      { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
    ]
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c
    }
    return { mime: '', ext: 'webm' }
  }

  async function startRecording() {
    setError('')
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone non accessible. Sur iOS, l'app doit être servie en HTTPS et autorisée.")
      }
      if (typeof MediaRecorder === 'undefined') {
        throw new Error("Enregistrement vocal non supporté sur ce navigateur. Saisissez le rapport au clavier.")
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const { mime, ext } = pickMimeType()
      const mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setProcessing(true)
        try {
          const blobType = mediaRecorder.mimeType || mime || `audio/${ext}`
          const blob = new Blob(chunksRef.current, { type: blobType })
          const formData = new FormData()
          formData.append('audio', blob, `dictee.${ext}`)
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Transcription échouée')
          onTranscription(data.text)
        } catch (e: any) {
          setError(`Erreur transcription : ${e.message}`)
        } finally {
          setProcessing(false)
        }
      }

      mediaRecorder.start()
      setRecording(true)
    } catch (e: any) {
      setError(e.message || "Impossible de démarrer l'enregistrement.")
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={processing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white ${
            recording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-blue-700 hover:bg-blue-800'
          } disabled:opacity-50`}
        >
          {recording ? '⏹ Arrêter la dictée' : '🎤 Dicter le rapport'}
        </button>
        {processing && <span className="text-gray-500 text-sm">Transcription en cours...</span>}
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  )
}
