'use client'
import { useEffect, useRef, useState } from "react"

export type ClientRecord = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

type Props = {
  value: string
  onChange: (nom: string) => void
  onSelect: (c: ClientRecord) => void
  placeholder?: string
  className?: string
}

export default function ClientAutocomplete({ value, onChange, onSelect, placeholder, className }: Props) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const lastQueryRef = useRef('')

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    const q = value.trim()
    lastQueryRef.current = q
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}&limit=8`, { signal: ctrl.signal })
        const data = await res.json()
        if (lastQueryRef.current !== q) return
        setResults(Array.isArray(data?.clients) ? data.clients : [])
        setHighlight(0)
      } catch {
        if (lastQueryRef.current === q) setResults([])
      } finally {
        if (lastQueryRef.current === q) setLoading(false)
      }
    }, 220)
    return () => { ctrl.abort(); clearTimeout(timer) }
  }, [value])

  function pick(c: ClientRecord) {
    onSelect(c)
    setOpen(false)
  }

  const baseInput = `w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors`

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!open || results.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
          else if (e.key === 'Enter' && results[highlight]) { e.preventDefault(); pick(results[highlight]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
        placeholder={placeholder ?? "M. Dupont, Mairie de…"}
        autoComplete="off"
        className={className ?? baseInput}
      />
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">Recherche…</div>
          ) : (
            results.map((c, i) => {
              const subtitle = [c.adresse, [c.code_postal, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full text-left px-4 py-2.5 border-b border-slate-100 last:border-b-0 transition ${
                    i === highlight ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-sm text-[#0e2a52]">{c.nom}</div>
                  {subtitle && <div className="text-xs text-slate-500 truncate">{subtitle}</div>}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
