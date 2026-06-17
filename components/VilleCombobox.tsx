'use client'
import { useEffect, useRef, useState } from "react"
import { VILLES_VAR, searchVilles, findVilleByName, type VilleVar } from "@/lib/villes-var"

type Props = {
  value: string
  onChange: (nom: string) => void
  onSelect: (v: VilleVar) => void
  placeholder?: string
  className?: string
  showCheck?: boolean
}

export default function VilleCombobox({
  value, onChange, onSelect, placeholder, className, showCheck = true,
}: Props) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const suggestions = value.trim().length >= 1 ? searchVilles(value, 8) : VILLES_VAR.slice(0, 8)
  const isExactMatch = !!findVilleByName(value)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(v: VilleVar) {
    onSelect(v)
    setOpen(false)
  }

  const baseInput = `w-full border-2 ${isExactMatch ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'} focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors`

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!open) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
          else if (e.key === 'Enter' && suggestions[highlight]) { e.preventDefault(); pick(suggestions[highlight]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
        placeholder={placeholder ?? "Toulon, Hyères, Bandol…"}
        autoComplete="off"
        className={className ?? baseInput}
      />
      {showCheck && isExactMatch && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 text-lg pointer-events-none">✓</span>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
          {suggestions.map((v, i) => (
            <button
              key={v.nom}
              type="button"
              onClick={() => pick(v)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-4 py-3 flex justify-between items-center border-b border-slate-100 last:border-b-0 transition ${
                i === highlight ? 'bg-blue-50 text-blue-700' : 'text-[#0e2a52] hover:bg-slate-50'
              }`}
            >
              <span className="font-semibold text-sm">{v.nom}</span>
              <span className="text-xs text-slate-500 font-mono">{v.cp}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
