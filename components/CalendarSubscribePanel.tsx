'use client'
import { useEffect, useState } from "react"

type CalendarInfo = {
  configured: boolean
  icsUrl?: string
  webcalUrl?: string
  gcalDeeplink?: string
  error?: string
}

export default function CalendarSubscribePanel() {
  const [open, setOpen] = useState(true)
  const [info, setInfo] = useState<CalendarInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<'ics' | 'webcal' | null>(null)

  useEffect(() => {
    if (!open || info) return
    setLoading(true)
    fetch('/api/calendar/info', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setInfo(d))
      .catch(e => setInfo({ configured: false, error: String(e) }))
      .finally(() => setLoading(false))
  }, [open, info])

  async function copy(value: string, key: 'ics' | 'webcal') {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      // fallback : sélection
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      ta.remove()
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <div className="text-left">
            <div className="font-bold text-[#0e2a52] text-sm">Synchroniser avec Google Agenda</div>
            <div className="text-xs text-slate-500">Abonnement iCalendar — toutes les interventions sur ton calendrier perso</div>
          </div>
        </div>
        <span className={`text-slate-400 text-lg transition-transform ${open ? 'rotate-180' : ''}`}>⌃</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 sm:p-5 space-y-4 bg-slate-50">
          {loading && (
            <p className="text-sm text-slate-500 italic">Chargement…</p>
          )}

          {info && !info.configured && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
              <div className="font-bold mb-1">⚠ Configuration serveur requise</div>
              <p className="text-xs">{info.error || "Il faut définir NEXTAUTH_SECRET (ou LTDB_CALENDAR_TOKEN) dans les variables d'environnement Vercel."}</p>
            </div>
          )}

          {info?.configured && info.icsUrl && (
            <>
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">URL d&apos;abonnement</div>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={info.icsUrl}
                    onFocus={e => e.currentTarget.select()}
                    className="flex-1 border-2 border-slate-200 rounded-lg px-3 py-2 text-xs font-mono bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => copy(info.icsUrl!, 'ics')}
                    className="bg-[#0e2a52] hover:bg-[#1a3a6b] text-white text-sm font-bold px-4 rounded-lg whitespace-nowrap"
                  >
                    {copied === 'ics' ? '✓ Copié' : '📋 Copier'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Cette URL contient un jeton secret — ne la partage qu&apos;avec les personnes autorisées à voir le planning.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <a
                  href={info.gcalDeeplink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-center text-sm transition"
                >
                  📅 Ouvrir dans Google Agenda
                </a>
                <a
                  href={info.webcalUrl}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-center text-sm transition"
                  title="Apple Calendar / Outlook"
                >
                  🍎 Ouvrir dans Apple/Outlook
                </a>
              </div>

              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-bold text-slate-700 mb-2">📖 Comment ça marche ?</summary>
                <div className="space-y-2 mt-2 pl-2 border-l-2 border-slate-200">
                  <p>
                    <strong>Google Agenda (web)</strong> : clique « Ouvrir dans Google Agenda » → confirme l&apos;ajout. Le calendrier apparaît dans « Autres calendriers » et se synchronise toutes les 6-12 h côté Google.
                  </p>
                  <p>
                    <strong>iPhone / Mac</strong> : clique « Ouvrir dans Apple/Outlook » sur l&apos;appareil. Le système détecte le flux <code className="bg-slate-200 px-1 rounded">webcal://</code> et propose de s&apos;y abonner.
                  </p>
                  <p>
                    <strong>Outlook</strong> : Paramètres → Calendrier → « Calendriers depuis Internet » → colle l&apos;URL.
                  </p>
                  <p className="text-slate-500 italic">
                    Les modifications faites dans le CRM se propagent sous 15 min à 12 h selon le client de calendrier — Google ne ré-interroge pas instantanément.
                  </p>
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  )
}
