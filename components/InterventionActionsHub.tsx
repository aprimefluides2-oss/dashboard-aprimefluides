'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export type InterventionActionsHubProps = {
  interventionId: string
  hasRapport: boolean
  hasFacture: boolean
  clientEmail: string | null
  publieSlug: string | null
  /** Pré-rempli pour le bouton Aller à la facture si la facture n'existe pas encore. */
  onCreateFacture?: () => void
  /** Slug public configurable, par défaut /etudes-de-cas/. */
  publicBaseUrl?: string
}

export default function InterventionActionsHub({
  interventionId,
  hasRapport,
  hasFacture,
  clientEmail,
  publieSlug,
  onCreateFacture,
  publicBaseUrl = 'https://www.aprime-fluides.fr/etudes-de-cas',
}: InterventionActionsHubProps) {
  const router = useRouter()
  const [sendOpen, setSendOpen] = useState(false)
  const [email, setEmail] = useState(clientEmail || '')
  const [askReview, setAskReview] = useState(true)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [gmbBusy, setGmbBusy] = useState(false)
  const [gmbStatus, setGmbStatus] = useState<string | null>(null)

  async function sendCombined() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setStatus('Email invalide')
      return
    }
    setSending(true); setStatus(null)
    try {
      const res = await fetch('/api/notify-rapport-facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId, clientEmail: email, skipReviews: !askReview }),
      })
      const j = await res.json()
      if (!res.ok || j.error) {
        setStatus(j.error || 'Erreur envoi')
      } else {
        setStatus(askReview
          ? `Envoyé ✓ (relances avis programmées J+2/J+4/J+6)`
          : `Envoyé ✓ (sans demande d'avis)`)
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setSending(false)
    }
  }

  function gotoPublish() {
    // Charge l'intervention dans /nouveau et bascule à l'étape preview
    // pour que le bouton "🌐 Publier sur le site" soit accessible.
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ltdb_load_rapport_id', interventionId)
    }
    router.push('/nouveau')
  }

  async function publishGmb() {
    setGmbBusy(true); setGmbStatus(null)
    try {
      const res = await fetch('/api/publish-gmb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId }),
      })
      const j = await res.json()
      if (!res.ok || j.error) {
        setGmbStatus('⚠️ ' + (j.error || 'Erreur publication'))
      } else {
        setGmbStatus('Publié sur Google Business ✓')
      }
    } catch (e) {
      setGmbStatus('⚠️ ' + (e instanceof Error ? e.message : 'Erreur réseau'))
    } finally {
      setGmbBusy(false)
    }
  }

  const sendDisabled = !hasRapport || !hasFacture
  const sendDisabledReason = !hasRapport
    ? 'Génère et publie d\'abord le rapport'
    : !hasFacture
    ? 'Crée d\'abord la facture'
    : ''

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-bold text-base">🚀 Diffusion &amp; envoi</h3>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <StatusPill ok={hasRapport} label="Rapport" />
          <StatusPill ok={hasFacture} label="Facture" />
          <StatusPill ok={!!publieSlug} label="Site" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ActionTile
          icon="📧"
          title="Envoyer rapport + facture"
          desc={sendDisabled ? sendDisabledReason : 'Email combiné + relances avis Google auto (J+2/J+4/J+6)'}
          accent="emerald"
          disabled={sendDisabled}
          onClick={() => setSendOpen(true)}
        />

        <ActionTile
          icon={hasFacture ? '✓' : '💶'}
          title={hasFacture ? 'Facture créée' : 'Aller à la facture'}
          desc={hasFacture
            ? 'Une facture est déjà liée à cette intervention. Pour la consulter ou la supprimer, va dans Historique.'
            : 'Créer la facture depuis le rapport'}
          accent="amber"
          disabled={!hasRapport || hasFacture}
          onClick={hasFacture ? undefined : (onCreateFacture || (() => router.push('/facture')))}
        />

        <ActionTile
          icon="🌐"
          title={publieSlug ? 'Voir sur le site' : 'Publier sur le site'}
          desc={publieSlug ? `etudes-de-cas/${publieSlug}` : 'Publier publiquement la réalisation'}
          accent="sky"
          disabled={!hasRapport}
          {...(publieSlug
            ? { href: `${publicBaseUrl}/${publieSlug}`, externalHref: true }
            : { onClick: gotoPublish })}
        />

        <ActionTile
          icon="📍"
          title="Publier sur Google Business"
          desc={gmbBusy
            ? 'Publication en cours…'
            : gmbStatus || 'Crée un post sur la fiche Google Business'}
          accent="blue"
          disabled={!hasRapport || gmbBusy}
          onClick={publishGmb}
        />

        <ActionTile
          icon="🎬"
          title="Générer la vidéo"
          desc="Bientôt — Remotion, 3 formats, upload YouTube"
          accent="violet"
          disabled
          badge="Bientôt"
        />
      </div>

      {/* Modale envoi combiné */}
      {sendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Envoyer rapport + facture</h3>
              <button onClick={() => { setSendOpen(false); setStatus(null) }} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Un seul email avec les 2 PDFs en pièces jointes.
            </p>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email destinataire</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setStatus(null) }}
              placeholder="client@exemple.fr"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
              disabled={sending}
            />
            <label className="mt-3 flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={askReview}
                onChange={e => { setAskReview(e.target.checked); setStatus(null) }}
                disabled={sending}
                className="mt-0.5 w-4 h-4 accent-amber-500"
              />
              <span className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">⭐ Demander un avis Google</span>
                <span className="block text-[11px] text-slate-400">
                  {askReview
                    ? 'Bloc avis dans l\'email + relances auto J+2 / J+4 / J+6.'
                    : 'Aucune demande d\'avis ni relance (idéal pour un client habitué).'}
                </span>
              </span>
            </label>
            {status && (
              <div className={`mt-3 text-sm ${status.startsWith('Envoyé') ? 'text-emerald-600' : 'text-red-600'}`}>{status}</div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setSendOpen(false); setStatus(null) }} className="px-3 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50" disabled={sending}>Annuler</button>
              <button
                onClick={sendCombined}
                disabled={sending}
                className="px-3 py-2 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >{sending ? 'Envoi…' : 'Envoyer le tout'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
      {ok ? '✓' : '○'} {label}
    </span>
  )
}

type ActionAccent = 'emerald' | 'amber' | 'sky' | 'violet' | 'blue'
const ACCENT: Record<ActionAccent, { bg: string; text: string; border: string; hover: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hover: 'hover:bg-emerald-100' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   hover: 'hover:bg-amber-100' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     hover: 'hover:bg-sky-100' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  hover: 'hover:bg-violet-100' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    hover: 'hover:bg-blue-100' },
}

type ActionTileProps = {
  icon: string
  title: string
  desc: string
  accent: ActionAccent
  disabled?: boolean
  badge?: string
  onClick?: () => void
  href?: string
  externalHref?: boolean
}

function ActionTile({ icon, title, desc, accent, disabled, badge, onClick, href, externalHref }: ActionTileProps) {
  const a = ACCENT[accent]
  const cls = `relative w-full text-left rounded-xl p-4 border transition-colors ${a.bg} ${a.border} ${disabled ? 'opacity-60 cursor-not-allowed' : a.hover + ' cursor-pointer'}`

  const inner = (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl">{icon}</span>
        <span className={`font-bold text-sm ${a.text}`}>{title}</span>
        {badge && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 font-semibold">{badge}</span>
        )}
      </div>
      <div className="text-xs text-slate-600 mt-1">{desc}</div>
    </>
  )

  if (href && !disabled) {
    if (externalHref) {
      return <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
    }
    return <Link href={href} className={cls}>{inner}</Link>
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}
