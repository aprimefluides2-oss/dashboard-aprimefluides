'use client'
import { useEffect, useRef, useState } from "react"

const OCEAN_STEPS = [
  '🌊 On largue les amarres…',
  '🐟 Les poissons analysent la dictée…',
  '🦀 Les crabes structurent le diagnostic…',
  '🐙 La pieuvre rédige les travaux…',
  '🐠 Optimisation des recommandations…',
  '🌴 Vérification des prestations…',
  '⛵ On approche du soleil…',
  '🌞 Dernières touches…',
]

/** Progression max tant que l’API n’a pas répondu (évite le blocage visuel à 95 %). */
const PROGRESS_CAP = 92

/** Durée typique d’un appel /api/generate (30–90 s annoncés → cible ~75 s). */
const DEFAULT_EXPECTED_MS = 75_000

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function stepIndexForProgress(p: number): number {
  const idx = Math.floor((p / PROGRESS_CAP) * OCEAN_STEPS.length)
  return Math.min(OCEAN_STEPS.length - 1, Math.max(0, idx))
}

interface Props {
  /** true quand /api/generate a répondu — barre → 100 % puis disparition côté parent */
  done?: boolean
  /** Durée estimée pour atteindre ~92 % (ms) */
  expectedMs?: number
}

/**
 * Loader ludique : la mer monte en fonction du temps écoulé (pas une fausse course à 95 %).
 * 100 % uniquement quand done=true (rapport prêt).
 */
export default function TerrainOceanLoader({ done = false, expectedMs = DEFAULT_EXPECTED_MS }: Props) {
  const [progress, setProgress] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    setProgress(0)
    setStepIdx(0)
  }, [])

  useEffect(() => {
    if (done) {
      setProgress(100)
      setStepIdx(OCEAN_STEPS.length - 1)
      return
    }

    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const t = Math.min(1, elapsed / expectedMs)
      const p = easeOutCubic(t) * PROGRESS_CAP
      setProgress(p)
      setStepIdx(stepIndexForProgress(p))
    }

    tick()
    const id = window.setInterval(tick, 120)
    return () => clearInterval(id)
  }, [done, expectedMs])

  const boatLeft = Math.max(2, Math.min(progress - 4, 86))
  const displayPct = Math.round(progress)

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes ltdb-wave1 { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes ltdb-wave2 { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes ltdb-sun-pulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.08); filter: brightness(1.15); }
        }
        @keyframes ltdb-boat-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-4px) rotate(2deg); }
        }
        .ltdb-wave-1 { animation: ltdb-wave1 4s linear infinite; }
        .ltdb-wave-2 { animation: ltdb-wave2 6s linear infinite; }
        .ltdb-sun { animation: ltdb-sun-pulse 3s ease-in-out infinite; }
        .ltdb-boat { animation: ltdb-boat-bob 2s ease-in-out infinite; }
      `}</style>

      <div
        className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border-2 border-blue-200 shadow-lg"
        style={{
          background: 'linear-gradient(to bottom, #fef3c7 0%, #fde68a 20%, #fdba74 38%, #fca5a5 48%, #93c5fd 55%, #60a5fa 65%, #1e40af 100%)',
        }}
      >
        <div
          className="ltdb-sun absolute w-16 h-16 sm:w-20 sm:h-20 rounded-full"
          style={{
            top: '8px',
            right: '12px',
            background: 'radial-gradient(circle at 35% 35%, #fef08a 0%, #facc15 35%, #f59e0b 75%, #ea580c 100%)',
            boxShadow: '0 0 40px 12px rgba(251, 191, 36, 0.65), 0 0 80px 24px rgba(249, 115, 22, 0.35)',
          }}
        />

        <div
          className="absolute right-[3%] bottom-[6%] w-8 h-2 rounded-full"
          style={{
            background: 'radial-gradient(ellipse, rgba(250,204,21,0.8), transparent)',
            opacity: Math.max(0, 0.6 - progress / 200),
          }}
        />

        <div
          className="absolute bottom-0 left-0 ease-out overflow-hidden"
          style={{
            width: `${progress}%`,
            height: '52%',
            background: 'linear-gradient(to bottom, #2563eb 0%, #1e40af 60%, #1e3a8a 100%)',
            transition: done ? 'width 0.45s ease-out' : 'width 0.15s linear',
          }}
        >
          <svg
            className="ltdb-wave-1 absolute top-0 left-0 h-6"
            style={{ width: '200%' }}
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
          >
            <path
              d="M0,20 Q150,2 300,20 T600,20 T900,20 T1200,20 L1200,40 L0,40 Z"
              fill="white"
              fillOpacity="0.35"
            />
          </svg>
          <svg
            className="ltdb-wave-2 absolute top-2 left-0 h-5"
            style={{ width: '200%' }}
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
          >
            <path
              d="M0,20 Q200,6 400,20 T800,20 T1200,20 L1200,40 L0,40 Z"
              fill="#60a5fa"
              fillOpacity="0.4"
            />
          </svg>
        </div>

        <div
          className="absolute text-3xl sm:text-4xl pointer-events-none ease-out"
          style={{
            left: `${boatLeft}%`,
            bottom: '46%',
            transition: done ? 'left 0.45s ease-out' : 'left 0.15s linear',
          }}
        >
          <span className="ltdb-boat inline-block">⛵</span>
        </div>

        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-sm">
            <div className="text-5xl animate-bounce">🎉</div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center gap-3">
          <span className="text-sm font-bold text-blue-800 truncate">
            {done ? '🌞 Rapport prêt !' : OCEAN_STEPS[stepIdx]}
          </span>
          <span className="text-sm font-black text-slate-700 tabular-nums flex-shrink-0">
            {displayPct}%
          </span>
        </div>
        <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-400 ease-out"
            style={{
              width: `${progress}%`,
              transition: done ? 'width 0.45s ease-out' : 'width 0.15s linear',
            }}
          />
        </div>
      </div>
    </div>
  )
}
