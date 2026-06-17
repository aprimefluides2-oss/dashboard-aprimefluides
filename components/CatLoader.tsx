'use client'

export default function CatLoader() {
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-xl bg-gradient-to-b from-sky-200 via-sky-100 to-indigo-50 border border-sky-200">
      <div className="ltdb-cloud absolute" style={{ top: 8, width: 28, height: 8 }}>
        <div className="w-full h-full rounded-full bg-white/80" />
      </div>
      <div className="ltdb-cloud-2 absolute" style={{ top: 22, width: 36, height: 9 }}>
        <div className="w-full h-full rounded-full bg-white/70" />
      </div>
      <div className="ltdb-cloud-3 absolute" style={{ top: 50, width: 22, height: 6 }}>
        <div className="w-full h-full rounded-full bg-white/60" />
      </div>

      <div className="ltdb-cat absolute" style={{ width: 78, top: '30%' }}>
        <svg viewBox="0 0 78 40" className="w-[78px] h-10 overflow-visible">
          <g className="ltdb-cape">
            <path
              d="M 12 20 Q -2 14 -10 22 Q -4 22 -2 26 Q -8 26 -12 32 Q 0 28 12 26 Z"
              fill="#dc2626"
            />
            <path d="M 4 22 Q -4 20 -8 24" stroke="#fbbf24" strokeWidth="0.8" fill="none" />
          </g>

          <ellipse cx="38" cy="22" rx="20" ry="9" fill="#334155" />
          <ellipse cx="38" cy="24" rx="16" ry="6" fill="#cbd5e1" />

          <path
            className="ltdb-tail"
            d="M 56 20 Q 68 14 64 4 Q 62 8 60 6"
            stroke="#334155"
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />

          <ellipse cx="62" cy="18" rx="9.5" ry="9" fill="#334155" />

          <polygon points="55,11 58,4 60,12" fill="#334155" />
          <polygon points="64,12 66,4 69,11" fill="#334155" />
          <polygon points="56.5,10.5 58,7 59,11" fill="#fda4af" />
          <polygon points="65,11 66,7.5 67.5,10.5" fill="#fda4af" />

          <ellipse cx="58" cy="17.5" rx="1.6" ry="2" fill="#0f172a" />
          <ellipse cx="65" cy="17.5" rx="1.6" ry="2" fill="#0f172a" />
          <circle cx="58.5" cy="17" r="0.5" fill="white" />
          <circle cx="65.5" cy="17" r="0.5" fill="white" />

          <ellipse cx="61.5" cy="20" rx="1" ry="0.6" fill="#fda4af" />
          <path d="M 61.5 20.5 Q 60.5 22 60 21.5 M 61.5 20.5 Q 62.5 22 63 21.5" stroke="#0f172a" strokeWidth="0.5" fill="none" />

          <line x1="54" y1="19" x2="49" y2="18" stroke="#0f172a" strokeWidth="0.4" />
          <line x1="54" y1="20" x2="49" y2="20" stroke="#0f172a" strokeWidth="0.4" />
          <line x1="69" y1="19" x2="74" y2="18" stroke="#0f172a" strokeWidth="0.4" />
          <line x1="69" y1="20" x2="74" y2="20" stroke="#0f172a" strokeWidth="0.4" />

          <ellipse cx="42" cy="29" rx="3" ry="2.2" fill="#334155" />
          <ellipse cx="50" cy="29" rx="3" ry="2.2" fill="#334155" />

          <g className="ltdb-sparkle ltdb-sparkle-1">
            <path d="M -16 12 L -15 14 L -13 13 L -15 12 L -14 10 L -16 11 L -18 10 L -16 12 Z" fill="#fbbf24" />
          </g>
          <g className="ltdb-sparkle ltdb-sparkle-2">
            <path d="M -22 26 L -21 28 L -19 27 L -21 26 L -20 24 L -22 25 L -24 24 L -22 26 Z" fill="#fbbf24" />
          </g>
          <g className="ltdb-sparkle ltdb-sparkle-3">
            <circle cx="-10" cy="20" r="0.8" fill="white" />
          </g>
        </svg>
      </div>

      <style>{`
        @keyframes ltdbCatFly {
          0%   { left: 5%;  transform: translateY(0) scaleX(1); }
          22%  { left: 28%; transform: translateY(-6px) scaleX(1); }
          45%  { left: calc(100% - 88px); transform: translateY(0) scaleX(1); }
          50%  { left: calc(100% - 88px); transform: translateY(0) scaleX(-1); }
          72%  { left: 28%; transform: translateY(-6px) scaleX(-1); }
          95%  { left: 5%;  transform: translateY(0) scaleX(-1); }
          100% { left: 5%;  transform: translateY(0) scaleX(1); }
        }
        .ltdb-cat { animation: ltdbCatFly 6s ease-in-out infinite; transform-origin: center; }

        @keyframes ltdbBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        .ltdb-cat svg { animation: ltdbBob 0.7s ease-in-out infinite; }

        @keyframes ltdbCapeWave {
          0%, 100% { transform: rotate(0deg) translateX(0); }
          50%      { transform: rotate(-6deg) translateX(-1.5px); }
        }
        .ltdb-cape { animation: ltdbCapeWave 0.4s ease-in-out infinite; transform-origin: 12px 22px; transform-box: fill-box; }

        @keyframes ltdbTailWiggle {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(8deg); }
        }
        .ltdb-tail { animation: ltdbTailWiggle 0.45s ease-in-out infinite; transform-origin: 56px 20px; transform-box: fill-box; }

        @keyframes ltdbSparkle {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          50%      { opacity: 1; transform: scale(1); }
        }
        .ltdb-sparkle { animation: ltdbSparkle 1s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .ltdb-sparkle-2 { animation-delay: 0.3s; }
        .ltdb-sparkle-3 { animation-delay: 0.6s; }

        @keyframes ltdbCloudDrift {
          from { left: 110%; }
          to   { left: -20%; }
        }
        .ltdb-cloud   { animation: ltdbCloudDrift 9s  linear infinite; }
        .ltdb-cloud-2 { animation: ltdbCloudDrift 13s linear infinite; animation-delay: -3s; }
        .ltdb-cloud-3 { animation: ltdbCloudDrift 7s  linear infinite; animation-delay: -1.5s; }
      `}</style>
    </div>
  )
}
