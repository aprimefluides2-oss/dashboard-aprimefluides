'use client'
import { useEffect, useState } from "react"
import { pdf } from "@react-pdf/renderer"
import { RealisationDocument, type PDFProps } from "./RealisationPDF"

// Minimal typings for Google Identity Services token client
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (resp: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void }
        }
      }
    }
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client"
const SCOPE = "https://www.googleapis.com/auth/drive.file"

function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'))
    if (window.google?.accounts?.oauth2) return resolve()
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('GIS load error')))
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('GIS load error'))
    document.head.appendChild(script)
  })
}

async function generatePdfBlob(pdfProps: PDFProps): Promise<Blob> {
  return await pdf(<RealisationDocument {...pdfProps} />).toBlob()
}

async function uploadToDrive(accessToken: string, filename: string, blob: Blob): Promise<{ id: string; webViewLink?: string }> {
  const metadata = {
    name: filename,
    mimeType: 'application/pdf',
    description: 'Rapport d\'intervention — Aprime fluides',
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob)

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Drive upload ${res.status} — ${txt.slice(0, 200)}`)
  }
  return await res.json()
}

type Props = {
  pdfProps: PDFProps
  filename: string
}

export default function DriveSaveButton({ pdfProps, filename }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'uploading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (clientId) loadGIS().catch(() => {})
  }, [clientId])

  async function handleClick() {
    if (!clientId) {
      setStatus('error')
      setMessage('NEXT_PUBLIC_GOOGLE_CLIENT_ID manquant')
      return
    }
    setStatus('loading'); setMessage(''); setLink('')
    try {
      await loadGIS()
      if (!window.google?.accounts?.oauth2) throw new Error('GIS indisponible')

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: async (resp) => {
          if (resp.error || !resp.access_token) {
            setStatus('error')
            setMessage(resp.error || 'Authentification refusée')
            return
          }
          try {
            setStatus('uploading')
            const blob = await generatePdfBlob(pdfProps)
            const result = await uploadToDrive(resp.access_token, filename, blob)
            setStatus('done')
            setLink(result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`)
          } catch (e: any) {
            setStatus('error')
            setMessage(e.message || 'Upload échoué')
          }
        },
      })
      tokenClient.requestAccessToken({ prompt: '' })
    } catch (e: any) {
      setStatus('error')
      setMessage(e.message || 'Erreur inconnue')
    }
  }

  const label =
    status === 'loading' ? 'Connexion Google…' :
    status === 'uploading' ? 'Upload…' :
    status === 'done' ? '✓ Sur Drive' :
    status === 'error' ? '⚠ Réessayer' :
    '💾 Drive'

  return (
    <div className="flex flex-col">
      <button
        onClick={handleClick}
        disabled={status === 'loading' || status === 'uploading'}
        className="bg-[#1a73e8] text-white px-4 py-3 rounded-xl font-bold hover:bg-[#1558b8] disabled:opacity-50 active:scale-95 transition-all"
      >
        {label}
      </button>
      {status === 'done' && link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1a73e8] underline mt-1 text-center">Ouvrir le fichier →</a>
      )}
      {status === 'error' && message && (
        <div className="text-xs text-red-600 mt-1 text-center">{message}</div>
      )}
    </div>
  )
}
