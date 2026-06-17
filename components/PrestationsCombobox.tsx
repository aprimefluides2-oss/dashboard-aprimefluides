'use client'
import { useEffect, useRef, useState } from "react"

export type PrestationArticle = {
  id: string
  designation: string
  pu_ht: number
  unite: string
  preset?: boolean
}

const STORAGE_KEY = 'ltdb_prestations_catalog'

const PRESETS: PrestationArticle[] = [
  { id: 'p-debouch-canal',  designation: 'Débouchage canalisation',  pu_ht: 250, unite: 'forfait', preset: true },
  { id: 'p-debouch-wc',     designation: 'Débouchage WC',            pu_ht: 180, unite: 'forfait', preset: true },
  { id: 'p-debouch-evier',  designation: 'Débouchage évier',         pu_ht: 150, unite: 'forfait', preset: true },
  { id: 'p-debouch-douche', designation: 'Débouchage douche',        pu_ht: 150, unite: 'forfait', preset: true },
  { id: 'p-hydrocurage',    designation: 'Hydrocurage',              pu_ht: 350, unite: 'forfait', preset: true },
  { id: 'p-inspect-cam',    designation: 'Inspection caméra',        pu_ht: 200, unite: 'forfait', preset: true },
  { id: 'p-vidange-fosse',  designation: 'Vidange fosse septique',   pu_ht: 280, unite: 'forfait', preset: true },
  { id: 'p-curage',         designation: 'Curage canalisation',      pu_ht: 320, unite: 'forfait', preset: true },
  { id: 'p-deplacement',    designation: 'Déplacement',              pu_ht: 50,  unite: 'forfait', preset: true },
  { id: 'p-main-doeuvre',   designation: 'Main d’œuvre',        pu_ht: 65,  unite: 'heure',   preset: true },
]

function loadCustom(): PrestationArticle[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveCustom(list: PrestationArticle[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch {}
}

type Props = {
  designation: string
  onChange: (patch: { designation: string; pu_ht?: number; unite?: string }) => void
  className?: string
}

export default function PrestationsCombobox({ designation, onChange, className }: Props) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [custom, setCustom] = useState<PrestationArticle[]>([])
  const [creating, setCreating] = useState(false)
  const [newDesig, setNewDesig] = useState('')
  const [newPu, setNewPu] = useState('')
  const [newUnite, setNewUnite] = useState('forfait')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setCustom(loadCustom()) }, [])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setCreating(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const all = [...PRESETS, ...custom]
  const f = filter.trim().toLowerCase()
  const visible = f ? all.filter(a => a.designation.toLowerCase().includes(f)) : all

  function pick(a: PrestationArticle) {
    onChange({ designation: a.designation, pu_ht: a.pu_ht, unite: a.unite })
    setOpen(false); setCreating(false); setFilter('')
  }

  function handleCreate() {
    const d = newDesig.trim()
    if (!d) return
    const article: PrestationArticle = {
      id: `c-${Date.now()}`,
      designation: d,
      pu_ht: Number(newPu) || 0,
      unite: newUnite.trim() || 'forfait',
    }
    const next = [...custom, article]
    setCustom(next); saveCustom(next)
    pick(article)
    setNewDesig(''); setNewPu(''); setNewUnite('forfait')
  }

  function handleDelete(id: string) {
    const next = custom.filter(a => a.id !== id)
    setCustom(next); saveCustom(next)
  }

  return (
    <div ref={wrapRef} className={`relative ${className || ''}`}>
      <div className="flex gap-1">
        <input
          value={designation}
          onChange={e => onChange({ designation: e.target.value })}
          className="flex-1 border border-slate-200 rounded px-2 py-1"
          placeholder="Désignation"
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="px-2 py-1 border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-semibold text-xs whitespace-nowrap shrink-0"
          title="Choisir un article du catalogue ou en créer un"
          aria-label="Ouvrir le catalogue d'articles"
        >
          📋 Articles
        </button>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 sm:right-auto sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {!creating ? (
            <>
              <div className="p-2 border-b border-slate-100">
                <input
                  autoFocus
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="Rechercher une prestation…"
                  className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <ul className="max-h-64 overflow-y-auto py-1">
                {visible.length === 0 && (
                  <li className="px-3 py-2 text-sm text-slate-400 italic">Aucune prestation trouvée.</li>
                )}
                {visible.map(a => (
                  <li key={a.id} className="flex items-center hover:bg-slate-50">
                    <button
                      type="button"
                      onClick={() => pick(a)}
                      className="flex-1 text-left px-3 py-2 text-sm"
                    >
                      <div className="font-semibold text-slate-800">{a.designation}</div>
                      <div className="text-xs text-slate-500">
                        {a.pu_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT / {a.unite}
                        {a.preset ? ' · standard' : ' · personnalisé'}
                      </div>
                    </button>
                    {!a.preset && (
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        className="px-2 text-slate-400 hover:text-red-600 text-lg leading-none"
                        aria-label="Supprimer cet article"
                        title="Supprimer cet article"
                      >×</button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 p-2 bg-slate-50">
                <button
                  type="button"
                  onClick={() => { setCreating(true); setNewDesig(filter) }}
                  className="w-full text-left text-sm font-bold text-blue-700 hover:text-blue-900 px-2 py-1.5"
                >
                  + Créer un nouvel article
                </button>
              </div>
            </>
          ) : (
            <div className="p-3 space-y-2">
              <div className="font-bold text-sm text-[#0e2a52]">Nouvel article</div>
              <input
                autoFocus
                value={newDesig}
                onChange={e => setNewDesig(e.target.value)}
                placeholder="Désignation"
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="number" step="0.01" min="0"
                  value={newPu}
                  onChange={e => setNewPu(e.target.value)}
                  placeholder="P.U. HT €"
                  className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm"
                />
                <input
                  value={newUnite}
                  onChange={e => setNewUnite(e.target.value)}
                  placeholder="unité"
                  className="w-24 border border-slate-200 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setCreating(false); setNewDesig(''); setNewPu(''); setNewUnite('forfait') }}
                  className="flex-1 border border-slate-200 rounded px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newDesig.trim()}
                  className="flex-1 bg-[#0e2a52] text-white rounded px-3 py-1.5 text-sm font-bold hover:bg-[#1a3a6b] disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
              <p className="text-[11px] text-slate-400">L&apos;article sera enregistré dans le catalogue local et sélectionné pour cette ligne.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
