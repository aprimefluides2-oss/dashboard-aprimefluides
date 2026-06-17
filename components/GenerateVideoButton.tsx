'use client'
import { useState } from 'react'

type VideoUrls = Partial<Record<'vertical' | 'horizontal' | 'square', string>>
type VideoStatus = 'idle' | 'rendering' | 'ready' | 'failed' | 'uploading' | 'published'

type SocialPlatform = 'youtube' | 'facebook' | 'instagram' | 'tiktok'

type PublishState = {
  platform: SocialPlatform
  status: 'idle' | 'posting' | 'ok' | 'error'
  url?: string
  error?: string
}

type Props = {
  interventionId: string
  hasPhotos: boolean
  initialVideoUrls?: VideoUrls | null
  initialVideoStatus?: VideoStatus | null
  initialVideoError?: string | null
  initialYoutubeUrl?: string | null
}

const FORMAT_LABEL: Record<keyof VideoUrls, { label: string; ratio: string; usage: string }> = {
  vertical: { label: 'Vertical 9:16', ratio: 'aspect-[9/16]', usage: 'TikTok · Reels · Shorts' },
  horizontal: { label: 'Horizontal 16:9', ratio: 'aspect-video', usage: 'YouTube' },
  square: { label: 'Carré 1:1', ratio: 'aspect-square', usage: 'Feed Instagram' },
}

const SOCIAL_CFG: Record<SocialPlatform, { label: string; color: string; endpoint: string; icon: string; help: string }> = {
  youtube: {
    label: 'YouTube',
    color: 'bg-red-600 hover:bg-red-700',
    endpoint: '/api/publish-youtube',
    icon: '▶',
    help: 'Nécessite un compte Google connecté',
  },
  facebook: {
    label: 'Facebook',
    color: 'bg-blue-600 hover:bg-blue-700',
    endpoint: '/api/publish-facebook',
    icon: '📘',
    help: 'Nécessite une Page Facebook connectée',
  },
  instagram: {
    label: 'Instagram',
    color: 'bg-pink-600 hover:bg-pink-700',
    endpoint: '/api/publish-instagram',
    icon: '📸',
    help: 'Nécessite un compte Instagram Business lié à une Page Facebook',
  },
  tiktok: {
    label: 'TikTok',
    color: 'bg-slate-900 hover:bg-slate-800',
    endpoint: '/api/publish-tiktok',
    icon: '🎵',
    help: 'Nécessite un compte TikTok Business connecté',
  },
}

export default function GenerateVideoButton({
  interventionId,
  hasPhotos,
  initialVideoUrls,
  initialVideoStatus,
  initialVideoError,
  initialYoutubeUrl,
}: Props) {
  const [status, setStatus] = useState<VideoStatus>(initialVideoStatus || 'idle')
  const [videoUrls, setVideoUrls] = useState<VideoUrls>(initialVideoUrls || {})
  const [error, setError] = useState<string | null>(initialVideoError || null)
  const [publishState, setPublishState] = useState<Record<string, PublishState>>(
    initialYoutubeUrl
      ? { youtube: { platform: 'youtube', status: 'ok', url: initialYoutubeUrl } }
      : {}
  )

  const isRendering = status === 'rendering'
  const hasVideos = Object.keys(videoUrls).length > 0
  const cta = hasVideos ? 'Régénérer la vidéo' : 'Générer la vidéo'

  const generate = async () => {
    setStatus('rendering')
    setError(null)
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setVideoUrls(data.video_urls || {})
      setStatus('ready')
      setPublishState({})
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue')
      setStatus('failed')
    }
  }

  const publishTo = async (platform: SocialPlatform) => {
    const cfg = SOCIAL_CFG[platform]
    setPublishState(prev => ({
      ...prev,
      [platform]: { platform, status: 'posting' },
    }))
    try {
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setPublishState(prev => ({
        ...prev,
        [platform]: { platform, status: 'ok', url: data.url || data.videoUrl },
      }))
      if (platform === 'youtube') setStatus('published')
    } catch (e: any) {
      setPublishState(prev => ({
        ...prev,
        [platform]: { platform, status: 'error', error: e?.message || 'Échec' },
      }))
    }
  }

  const needsOAuth = (platform: SocialPlatform) => {
    const ps = publishState[platform]
    const err = ps?.error || ''
    return (
      err.includes('Aucun token') ||
      err.includes('non configuré') ||
      err.includes('invalid_grant') ||
      err.includes('Connexion YouTube expirée') ||
      err.includes('Connecter')
    )
  }

  const oauthUrl = (platform: SocialPlatform) => {
    switch (platform) {
      case 'youtube': return '/api/oauth/google'
      case 'facebook': return '/api/oauth/facebook'
      case 'instagram': return '/api/oauth/facebook' // Instagram uses Facebook OAuth
      case 'tiktok': return '/api/oauth/tiktok'
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Vidéo réseaux sociaux</h2>
          <p className="text-sm text-slate-500">3 formats prêts à publier sur TikTok, YouTube et Instagram</p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={isRendering || !hasPhotos}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-slate-700 transition"
        >
          {isRendering ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Génération… (~3 min)
            </>
          ) : (
            <>🎬 {cta}</>
          )}
        </button>
      </div>

      {!hasPhotos ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Aucune photo sur cette intervention. Ajoutez des photos avant de générer la vidéo.
        </div>
      ) : null}

      {isRendering ? (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          Le rendu est en cours côté serveur. Ne ferme pas l&apos;onglet — ça prend environ 3 minutes
          pour les 3 formats.
        </div>
      ) : null}

      {status === 'failed' && error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <strong>Échec :</strong> {error}
        </div>
      ) : null}

      {hasVideos ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(Object.keys(FORMAT_LABEL) as Array<keyof VideoUrls>).map((fmt) => {
              const url = videoUrls[fmt]
              if (!url) return null
              const meta = FORMAT_LABEL[fmt]
              return (
                <div key={fmt} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                  <div className={`bg-black ${meta.ratio}`}>
                    <video src={url} controls preload="metadata" className="w-full h-full object-contain" />
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="font-bold text-sm text-slate-800">{meta.label}</div>
                    <div className="text-xs text-slate-500">{meta.usage}</div>
                    <a
                      href={url}
                      download={`ltdb-${fmt}.mp4`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 mt-1"
                    >
                      ⬇ Télécharger
                    </a>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Publication sociale */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <h3 className="text-sm font-bold text-slate-700">Publier sur les réseaux</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(SOCIAL_CFG) as SocialPlatform[]).map(platform => {
                const cfg = SOCIAL_CFG[platform]
                const ps = publishState[platform]
                const isPosting = ps?.status === 'posting'
                const isOk = ps?.status === 'ok'
                const hasError = ps?.status === 'error'
                // Désactiver si pas de vidéo appropriée pour la plateforme
                const vidKey = platform === 'tiktok' || platform === 'instagram' ? 'vertical' : platform === 'youtube' ? 'horizontal' : 'square'
                const hasRightVideo = !!videoUrls[vidKey] || !!videoUrls.horizontal || !!videoUrls.vertical

                return (
                  <div key={platform} className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => publishTo(platform)}
                      disabled={isPosting || !hasRightVideo}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed ${cfg.color}`}
                    >
                      {isPosting ? (
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span>{cfg.icon}</span>
                      )}
                      {isPosting ? 'Envoi…' : cfg.label}
                    </button>
                    {isOk && ps?.url ? (
                      <a
                        href={ps.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[10px] text-emerald-600 hover:text-emerald-800 truncate text-center"
                      >
                        ✅ Publié
                      </a>
                    ) : null}
                    {hasError ? (
                      <div className="text-[10px] text-red-600 text-center space-y-0.5">
                        <span className="truncate block">{ps?.error}</span>
                        {needsOAuth(platform) ? (
                          <a
                            href={oauthUrl(platform)}
                            className="inline-block text-blue-600 underline hover:text-blue-800"
                          >
                            → Connecter
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Chaque plateforme nécessite une connexion OAuth préalable. Facebook + Instagram partagent la même connexion.
            </p>
          </div>
        </>
      ) : null}
    </section>
  )
}
