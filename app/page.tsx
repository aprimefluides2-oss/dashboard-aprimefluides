'use client'
import { useEffect, useState } from "react"
import Link from "next/link"

type Tool = {
  href: string
  emoji: string
  label: string
  desc: string
  bg: string
  text: 'white' | 'black'
  external?: boolean
}

const TOOLS: Tool[] = [
  { href: '/accord',            emoji: '🤝', label: 'Accord',          desc: 'Accords signés avant travaux',     bg: 'bg-gradient-to-br from-red-500 to-red-700',         text: 'white' },
  { href: '/accord/nouveau',    emoji: '✍️', label: 'Nouvel accord',   desc: 'Créer un accord client',           bg: 'bg-gradient-to-br from-red-400 to-rose-600',        text: 'white' },
  { href: '/planning',          emoji: '📅', label: 'Planning',        desc: 'RDV, dispatch, tournées',          bg: 'bg-gradient-to-br from-blue-500 to-blue-700',       text: 'white' },
  { href: '/nouveau',           emoji: '📝', label: 'Rapport',         desc: 'Rédiger sur le terrain',           bg: 'bg-gradient-to-br from-slate-700 to-slate-900',     text: 'white' },
  { href: '/rapports',          emoji: '📄', label: 'Rapports',        desc: 'Liste et publication',             bg: 'bg-gradient-to-br from-slate-500 to-slate-700',     text: 'white' },
  { href: '/inspection',        emoji: '📹', label: 'Caméra',          desc: 'Inspection NF EN 13508-2',       bg: 'bg-gradient-to-br from-sky-400 to-sky-600',         text: 'white' },
  { href: '/devis',             emoji: '📋', label: 'Devis',           desc: 'Établir un devis',                 bg: 'bg-gradient-to-br from-amber-400 to-amber-600',     text: 'white' },
  { href: '/devis/tous',        emoji: '📑', label: 'Tous les devis',  desc: 'Historique et suivi devis',        bg: 'bg-gradient-to-br from-yellow-500 to-orange-600',   text: 'white' },
  { href: '/facture',           emoji: '🧾', label: 'Facturation',     desc: 'Suivi, paiements, relances',       bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700', text: 'white' },
  { href: '/facture/nouvelle',  emoji: '➕', label: 'Nouvelle facture', desc: 'Créer une facture',                bg: 'bg-gradient-to-br from-lime-500 to-green-700',     text: 'white' },
  { href: '/attestation',       emoji: '✅', label: 'Attestation',     desc: 'Raccordement / SPANC',             bg: 'bg-gradient-to-br from-[#a18249] to-[#6e5530]',     text: 'white' },
  { href: '/historique',        emoji: '📚', label: 'Historique',      desc: 'Interventions passées',            bg: 'bg-gradient-to-br from-slate-400 to-slate-600',     text: 'white' },
  { href: '/clients',           emoji: '👥', label: 'Clients',         desc: 'Annuaire, dossier, envoi',         bg: 'bg-gradient-to-br from-teal-500 to-teal-700',       text: 'white' },
  { href: '/statistiques',      emoji: '📊', label: 'Statistiques',    desc: 'Canaux d’acquisition',             bg: 'bg-gradient-to-br from-rose-500 to-rose-700',       text: 'white' },
  { href: '/comptabilite',      emoji: '💼', label: 'Comptabilité',    desc: 'Bilan, FEC, exports',              bg: 'bg-gradient-to-br from-violet-500 to-violet-700',   text: 'white' },
  { href: '/mail',              emoji: '📧', label: 'Mail',            desc: 'Emails envoyés',                   bg: 'bg-gradient-to-br from-cyan-500 to-cyan-700',       text: 'white' },
  { href: '/post-gmb',          emoji: '📍', label: 'Post GMB',        desc: 'Posts Google Business',            bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700',   text: 'white' },
  { href: 'https://adsconstructor.vercel.app/', emoji: '📢', label: 'ADS MY SELF', desc: 'Constructeur de pubs', bg: 'bg-gradient-to-br from-orange-500 to-pink-600', text: 'white', external: true },
]

const PRIMARY_HREFS = new Set(['/accord', '/planning'])
const PRIMARY_TOOLS = TOOLS.filter((t) => PRIMARY_HREFS.has(t.href))
const MORE_TOOLS = TOOLS.filter((t) => !PRIMARY_HREFS.has(t.href))

type Scatter = { tx: number; ty: number; rot: number; order: number }

function genScatter(n: number): Scatter[] {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const rnd = (min: number, max: number) => Math.round(min + Math.random() * (max - min))
  return order.map((rank) => ({
    tx: rnd(-200, 200),
    ty: rnd(-80, 80),
    rot: rnd(-20, 20),
    order: rank,
  }))
}

function ToolTile({
  t,
  featured,
  introClass,
  tileStyle,
}: {
  t: Tool
  /** Tuiles principales (Accord, Planning) — pleine hauteur, texte large */
  featured?: boolean
  introClass: string
  tileStyle?: React.CSSProperties
}) {
  const textColor = t.text === 'white' ? 'text-white' : 'text-black'
  const tileClass = featured
    ? `group relative h-full min-h-0 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col justify-end p-3 sm:p-5 lg:p-6 shadow-md transition-all duration-200 ease-out hover:shadow-2xl hover:scale-[1.02] hover:z-10 ${introClass} ${t.bg}`
    : `group relative h-full min-h-[96px] rounded-xl sm:rounded-2xl overflow-hidden flex flex-col justify-end p-3.5 sm:p-4 shadow-sm transition-all duration-200 ease-out hover:shadow-xl hover:scale-[1.03] hover:z-10 ${introClass} ${t.bg}`

  const inner = (
    <>
      <span
        aria-hidden
        className={
          featured
            ? 'pointer-events-none select-none absolute -top-1 -right-1 text-[3.25rem] sm:text-[5.5rem] lg:text-[7.5rem] leading-none opacity-20 transition-transform duration-200 group-hover:scale-105'
            : 'pointer-events-none select-none absolute top-0 right-0 text-[3.5rem] sm:text-[4.5rem] leading-none opacity-20 transition-transform duration-200 group-hover:scale-105'
        }
      >
        {t.emoji}
      </span>
      <div className={`relative z-10 ${textColor}`}>
        <div
          className={
            featured
              ? 'text-base sm:text-2xl lg:text-3xl font-extrabold leading-tight tracking-tight drop-shadow-sm'
              : 'text-sm sm:text-base font-extrabold leading-tight tracking-tight drop-shadow-sm'
          }
        >
          {t.label}
        </div>
        <p
          className={
            featured
              ? 'mt-1 sm:mt-2 text-[11px] sm:text-base leading-snug opacity-90 line-clamp-2 font-medium'
              : 'mt-1 text-[10px] sm:text-xs leading-snug opacity-85 line-clamp-2 font-medium'
          }
        >
          {t.desc}
        </p>
      </div>
    </>
  )

  if (t.external) {
    return (
      <a
        href={t.href}
        target="_blank"
        rel="noopener noreferrer"
        title={t.desc}
        className={tileClass}
        style={tileStyle}
      >
        {inner}
      </a>
    )
  }

  return (
    <Link href={t.href} title={t.desc} className={tileClass} style={tileStyle}>
      {inner}
    </Link>
  )
}

export default function Home() {
  const [skipAnimation, setSkipAnimation] = useState(false)
  const [tilesIntro, setTilesIntro] = useState<'pending' | 'play' | 'skip'>('pending')
  const [scatter, setScatter] = useState<Scatter[] | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('ltdb_seen_intro') === '1') {
      setSkipAnimation(true)
      setTilesIntro('skip')
    } else {
      sessionStorage.setItem('ltdb_seen_intro', '1')
      setScatter(genScatter(PRIMARY_TOOLS.length))
      setTilesIntro('play')
    }
  }, [])

  const tileIntro = (i: number) =>
    tilesIntro === 'pending'
      ? 'opacity-0'
      : scatter?.[i] && tilesIntro === 'play'
        ? 'tile-in'
        : ''

  const tileStyle = (i: number): React.CSSProperties | undefined => {
    const sc = scatter?.[i]
    if (!sc || tilesIntro !== 'play') return undefined
    return {
      '--tx': `${sc.tx}px`,
      '--ty': `${sc.ty}px`,
      '--rot': `${sc.rot}deg`,
      animationDelay: `${(sc.order * 0.07).toFixed(3)}s`,
    } as React.CSSProperties
  }

  return (
    <main className="relative flex flex-col h-dvh max-h-dvh overflow-hidden bg-[#0a1f3d] text-slate-100">
      <header className="shrink-0 bg-[#0e2a52] text-white border-b border-white/10">
        <div className="px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-4">
          <div className={`flex items-baseline gap-3 ${skipAnimation ? '' : 'ltdb-drop'}`}>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">Aprime fluides</h1>
            <div className="hidden sm:block text-[10px] uppercase tracking-[0.25em] text-white/60 font-semibold">
              1, rue Jean Carasso · 95000 Bezons
            </div>
          </div>
          <div className="text-[11px] text-white/70">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-col flex-1 min-h-0 px-2 sm:px-3 pt-2 pb-2 sm:pb-3 gap-2">
        <div className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold px-0.5">
          Accès rapide
        </div>

        {/* Accord + Planning — grandes tuiles */}
        <div className="shrink-0 grid grid-cols-2 gap-1.5 sm:gap-3 flex-[1.1] sm:flex-[2] min-h-[96px] max-h-[112px] sm:min-h-[180px] sm:max-h-none">
          {PRIMARY_TOOLS.map((t, i) => (
            <ToolTile
              key={`${t.href}-${t.label}`}
              t={t}
              featured
              introClass={tileIntro(i)}
              tileStyle={tileStyle(i)}
            />
          ))}
        </div>

        {/* Autres modules — panneau déroulant */}
        <div className="flex flex-col flex-1 min-h-0 rounded-xl sm:rounded-2xl border border-white/10 bg-[#0e2a52]/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className="shrink-0 w-full flex items-center justify-between gap-3 px-4 py-3 sm:py-3.5 text-left hover:bg-white/5 transition-colors"
            aria-expanded={moreOpen}
          >
            <span className="text-sm sm:text-base font-bold text-white">
              Autres modules
              <span className="ml-2 text-white/50 font-semibold tabular-nums">{MORE_TOOLS.length}</span>
            </span>
            <span
              className={`text-white/70 text-lg leading-none transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}
              aria-hidden
            >
              ▼
            </span>
          </button>

          {moreOpen && (
            <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-2.5 border-t border-white/10">
              <div
                className="grid gap-1.5 sm:gap-2"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))' }}
              >
                {MORE_TOOLS.map((t) => (
                  <ToolTile
                    key={`${t.href}-${t.label}`}
                    t={t}
                    introClass={tilesIntro === 'pending' ? 'opacity-0' : ''}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes softFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ltdb-drop { opacity: 0; animation: softFadeUp 0.4s ease-out 0.05s forwards; }

        @keyframes tileIn {
          0% {
            opacity: 0;
            transform: translate(var(--tx, 0), var(--ty, 0)) rotate(var(--rot, 0deg)) scale(0.5);
          }
          100% {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
        }
        .tile-in { animation: tileIn 0.6s cubic-bezier(0.34, 1.25, 0.45, 1) backwards; }

        @media (prefers-reduced-motion: reduce) {
          .ltdb-drop { animation: none !important; opacity: 1 !important; transform: none !important; }
          .tile-in { animation: none !important; }
        }
      `}</style>
    </main>
  )
}
