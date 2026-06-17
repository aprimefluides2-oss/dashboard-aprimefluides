'use client'
import React, { useState } from "react"

type SaveButtonProps = {
  endpoint: string
  body: () => any
  className?: string
  label?: string
  disabled?: boolean
  onSaved?: (id: string) => void
}

export default function SaveDocumentButton({
  endpoint, body, className, label, disabled, onSaved,
}: SaveButtonProps) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState('')

  async function handleClick() {
    if (state === 'saving') return
    setState('saving'); setError('')
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setSavedId(data.id || '')
      setState('saved')
      onSaved?.(data.id || '')
    } catch (e: any) {
      setError(e?.message || 'Erreur de sauvegarde')
      setState('error')
    }
  }

  const baseClass = className
    || 'bg-amber-500 text-white px-4 py-3.5 rounded-xl font-bold hover:bg-amber-600 disabled:opacity-50 active:scale-95 transition-all'

  let text = label || '💾 Enregistrer dans l\'historique'
  if (state === 'saving') text = 'Enregistrement…'
  else if (state === 'saved') text = '✓ Enregistré dans l\'historique'

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || state === 'saving' || state === 'saved'}
        className={baseClass}
        title="Sauvegarde le document dans la base sans envoyer d'email"
      >
        {text}
      </button>
      {state === 'saved' && savedId && (
        <a
          href="/historique"
          className="text-xs text-emerald-700 hover:underline self-end"
        >
          → voir dans l&apos;historique
        </a>
      )}
      {state === 'error' && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  )
}
