'use client'
import { useState, useRef, useEffect } from "react"
import { readRecovery, saveRecovery, removeRecovery } from "@/lib/recovery-store"

interface VoiceRecorderProps {
  onTranscription: (text: string) => void
}

export default function VoiceRecorder({ onTranscription }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ blob: Blob; ext: string } | null>(null)
  const [ready, setReady] = useState(false)
  const audioKey = typeof window !== 'undefined' ? `audio:${window.location.pathname}` : 'audio'
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    let active = true
    void readRecovery<{ blob: Blob; ext: string }>(audioKey).then(saved => {
      if (active && saved) { setPending(saved); setError('Une dictée enregistrée attend sa transcription. Vous pouvez réessayer.') }
    }).catch(() => { if (active) setError('Sauvegarde locale de la dictée indisponible. Gardez cette page ouverte.') })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [audioKey])

  async function transcribe(audio: { blob: Blob; ext: string }) {
    setProcessing(true); setError('')
    try {
      const formData = new FormData(); formData.append('audio', audio.blob, `dictee.${audio.ext}`)
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const data: { text?: string; error?: string } = await res.json()
      if (!res.ok || typeof data.text !== 'string' || !data.text.trim()) throw new Error(data.error || 'Transcription non confirmée')
      onTranscription(data.text)
      await removeRecovery(audioKey)
      setPending(null)
    } catch (e: unknown) {
      setError(`${e instanceof Error ? e.message : String(e)} La dictée est conservée ; réessayez sans la réenregistrer.`)
    } finally { setProcessing(false) }
  }

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
    if (!ready || pending || processing) return
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
        const audio = { blob: new Blob(chunksRef.current, { type: mediaRecorder.mimeType || mime || `audio/${ext}` }), ext }
        setPending(audio)
        try {
          await saveRecovery(audioKey, audio)
          await transcribe(audio)
        } catch (e: unknown) {
          setError(`Sauvegarde de la dictée impossible : ${e instanceof Error ? e.message : String(e)}. Ne fermez pas cette page.`)
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
          disabled={processing || !ready || Boolean(pending)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white ${
            recording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-blue-700 hover:bg-blue-800'
          } disabled:opacity-50`}
        >
          {recording ? '⏹ Arrêter la dictée' : '🎤 Dicter le rapport'}
        </button>
        {processing && <span className="text-gray-500 text-sm">Transcription en cours...</span>}
      </div>
      {pending && !processing && <button type="button" className="rounded-lg bg-blue-700 px-4 py-2 text-white" onClick={() => void transcribe(pending)}>Réessayer la transcription de la dictée conservée</button>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  )
}
