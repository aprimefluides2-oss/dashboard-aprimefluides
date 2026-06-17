'use client'

export const TERRAIN_STEPS = [
  { key: 0, label: 'Photo avant', icon: '📷' },
  { key: 1, label: 'Démarrer', icon: '▶' },
  { key: 2, label: 'Photo après', icon: '📷' },
  { key: 3, label: 'Rapport', icon: '🎤' },
  { key: 4, label: 'Facture', icon: '🧾' },
  { key: 5, label: 'Devis', icon: '📋' },
  { key: 6, label: 'Diffusion', icon: '✉' },
  { key: 7, label: 'Réseaux', icon: '📍' },
] as const

export type TerrainStep = typeof TERRAIN_STEPS[number]['key']

interface TerrainStepperProps {
  current: number
  onStepClick?: (step: number) => void
}

export default function TerrainStepper({ current, onStepClick }: TerrainStepperProps) {
  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
      <div className="max-w-4xl mx-auto px-2 py-3">
        <div className="flex items-center justify-between gap-1 overflow-x-auto">
          {TERRAIN_STEPS.map((s, i) => {
            const done = current > s.key
            const active = current === s.key
            const clickable = done && onStepClick
            return (
              <div key={s.key} className="flex items-center flex-shrink-0">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onStepClick(s.key)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition ${
                    active ? 'bg-blue-50' : ''
                  } ${clickable ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'}`}
                  title={s.label}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold transition ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : active
                        ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-200'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {done ? '✓' : s.icon}
                  </div>
                  <span
                    className={`text-[10px] font-bold whitespace-nowrap ${
                      active ? 'text-blue-700' : done ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < TERRAIN_STEPS.length - 1 && (
                  <div
                    className={`w-3 h-0.5 mx-0.5 flex-shrink-0 ${
                      done ? 'bg-emerald-400' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
