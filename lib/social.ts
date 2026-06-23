/**
 * Plateformes sociales — OAuth + publication vidéo.
 * Pattern unifié pour Facebook, Instagram, TikTok (YouTube déjà couvert par lib/youtube.ts).
 */
import { getSupabase } from "./supabase"
import { getTelPrincipal } from "./parametres"

// ============================================================================
// Types communs
// ============================================================================

export type SocialPlatform = "facebook" | "instagram" | "tiktok"

type StoredToken = {
  platform: string
  refresh_token: string
  access_token: string | null
  expires_at: string | null
}

export type PublishResult = {
  platform: SocialPlatform
  url: string
  postId?: string
}

// ============================================================================
// Helpers DB
// ============================================================================

async function getToken(platform: string): Promise<StoredToken> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from("social_tokens")
    .select("platform, refresh_token, access_token, expires_at")
    .eq("platform", platform)
    .maybeSingle()
  if (error) throw new Error(`DB social_tokens (${platform}): ${error.message}`)
  if (!data?.refresh_token) throw new Error(`Aucun token ${platform} — connecte le compte via /api/oauth/${platform}`)
  return data as StoredToken
}

async function storeToken(platform: string, tokens: {
  refresh_token?: string
  access_token?: string
  expires_at?: string
  scope?: string
  account_email?: string
}) {
  const sb = getSupabase()
  const { error } = await sb.from("social_tokens").upsert(
    {
      platform,
      account_email: tokens.account_email || undefined,
      refresh_token: tokens.refresh_token || undefined,
      access_token: tokens.access_token || undefined,
      expires_at: tokens.expires_at || undefined,
      scope: tokens.scope || undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "platform" },
  )
  if (error) throw new Error(`DB upsert social_tokens (${platform}): ${error.message}`)
}

// ============================================================================
// Facebook OAuth
// ============================================================================

function facebookClient() {
  const clientId = process.env.FACEBOOK_CLIENT_ID
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("OAuth Facebook non configuré (FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET / FACEBOOK_REDIRECT_URI)")
  }
  return { clientId, clientSecret, redirectUri }
}

export function getFacebookAuthUrl(): string {
  const { clientId, redirectUri } = facebookClient()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "pages_manage_posts,pages_read_engagement,instagram_content_publish,instagram_basic,pages_show_list",
    response_type: "code",
    state: "facebook",
  })
  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
}

export async function exchangeFacebookCode(code: string): Promise<{ email?: string }> {
  const { clientId, clientSecret, redirectUri } = facebookClient()

  // Échange code → access_token
  const tokenRes = await fetch("https://graph.facebook.com/v18.0/oauth/access_token", {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  }.toString().includes("GET") ? undefined : undefined)
  // Note: Facebook OAuth token exchange uses GET with query params
  const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  }).toString()}`
  const tokenRes2 = await fetch(tokenUrl, { signal: AbortSignal.timeout(10000) })
  const tokenData = await tokenRes2.json()
  if (tokenData.error) throw new Error(`Facebook token exchange: ${tokenData.error.message || JSON.stringify(tokenData.error)}`)

  const shortLivedToken = tokenData.access_token
  if (!shortLivedToken) throw new Error("Facebook: access_token absent de la réponse")

  // Échange short-lived → long-lived token (60 jours)
  const llRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: shortLivedToken,
    }).toString()}`,
    { signal: AbortSignal.timeout(10000) },
  )
  const llData = await llRes.json()
  const longLivedToken = llData.access_token || shortLivedToken
  const expiresIn = llData.expires_in ? Math.floor(Date.now() / 1000) + llData.expires_in : undefined

  // Récupère les pages de l'utilisateur
  const pagesRes = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedToken}`,
    { signal: AbortSignal.timeout(10000) },
  )
  const pagesData = await pagesRes.json()
  const pages: Array<{ id: string; name: string; access_token: string }> = pagesData.data || []
  if (pages.length === 0) console.warn("[facebook] Aucune page trouvée — l'utilisateur doit être admin d'une page Facebook")

  // Stocke le long-lived token + la première page trouvée
  const pageToken = pages[0]?.access_token || null
  await storeToken("facebook", {
    access_token: longLivedToken,
    expires_at: expiresIn ? new Date(expiresIn * 1000).toISOString() : undefined,
    scope: "pages_manage_posts,instagram_content_publish",
    account_email: pages[0]?.name || undefined,
  })

  // Stocke aussi un token Instagram si disponible
  if (pages.length > 0 && pageToken) {
    const igRes = await fetch(
      `https://graph.facebook.com/v18.0/${pages[0].id}?fields=instagram_business_account{id,username}&access_token=${longLivedToken}`,
      { signal: AbortSignal.timeout(10000) },
    )
    const igData = await igRes.json()
    const igAccount = igData.instagram_business_account
    if (igAccount) {
      await storeToken("instagram", {
        access_token: longLivedToken,
        refresh_token: pages[0].id, // on stocke le page_id comme refresh_token pour référence
        scope: "instagram_content_publish",
        account_email: igAccount.username || igAccount.id,
      })
    }
  }

  return { email: pages[0]?.name }
}

// ============================================================================
// TikTok OAuth
// ============================================================================

function tiktokClient() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  const redirectUri = process.env.TIKTOK_REDIRECT_URI
  if (!clientKey || !clientSecret || !redirectUri) {
    throw new Error("OAuth TikTok non configuré (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI)")
  }
  return { clientKey, clientSecret, redirectUri }
}

export function getTikTokAuthUrl(): string {
  const { clientKey, redirectUri } = tiktokClient()
  const params = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: redirectUri,
    scope: "video.publish,video.upload,user.info.basic",
    response_type: "code",
    state: "tiktok",
  })
  return `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`
}

export async function exchangeTikTokCode(code: string): Promise<{ email?: string }> {
  const { clientKey, clientSecret, redirectUri } = tiktokClient()

  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
    signal: AbortSignal.timeout(10000),
  })
  const tokenData = await tokenRes.json()
  if (tokenData.error) throw new Error(`TikTok token exchange: ${tokenData.error_description || tokenData.error}`)

  const accessToken = tokenData.access_token
  const refreshToken = tokenData.refresh_token
  if (!accessToken) throw new Error("TikTok: access_token absent")

  // Récupère les infos utilisateur
  let username: string | undefined
  try {
    const userRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,username", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    })
    const userData = await userRes.json()
    username = userData.data?.user?.username || userData.data?.user?.display_name
  } catch { /* non critique */ }

  await storeToken("tiktok", {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : undefined,
    scope: "video.publish,video.upload",
    account_email: username || undefined,
  })

  return { email: username }
}

// ============================================================================
// Refresh tokens (TikTok short-lived, Facebook long-lived)
// ============================================================================

async function refreshTikTokToken(): Promise<string> {
  const { clientKey, clientSecret } = tiktokClient()
  const stored = await getToken("tiktok")
  if (!stored.refresh_token) throw new Error("TikTok: refresh_token manquant")

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
    }).toString(),
    signal: AbortSignal.timeout(10000),
  })
  const data = await res.json()
  if (data.error) throw new Error(`TikTok refresh: ${data.error_description || data.error}`)

  await storeToken("tiktok", {
    access_token: data.access_token,
    refresh_token: data.refresh_token || stored.refresh_token,
    expires_at: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
  })
  return data.access_token
}

// ============================================================================
// Metadata builder (shared by all publish routes)
// ============================================================================

export async function buildSocialMetadata(opts: {
  typeIntervention?: string | null
  ville?: string | null
  rapport?: any
}): Promise<{ title: string; description: string }> {
  const type = opts.typeIntervention || "Intervention plomberie"
  const ville = opts.ville || "Var"
  const title = `${type} à ${ville} — LTDB Plombier 24h/24`

  const summary =
    opts.rapport?.resume_court ||
    opts.rapport?.resume ||
    `Intervention de ${type.toLowerCase()} réalisée à ${ville} par Aprime fluides.`

  const tel = await getTelPrincipal()

  const description = [
    summary,
    "",
    "🔧 Aprime fluides — Var (83)",
    `📞 ${tel} · www.aprime-fluides.fr`,
    "📍 Toulon, Hyères, Fréjus, Draguignan et tout le Var",
    "",
    "#debouchage #plomberie #var #ltdb #urgence",
  ].join("\n")

  return { title, description }
}

// ============================================================================
// Publication Facebook (Page)
// ============================================================================

export async function publishToFacebook(opts: {
  videoUrl: string
  title: string
  description: string
}): Promise<PublishResult> {
  const stored = await getToken("facebook")
  const accessToken = stored.access_token
  if (!accessToken) throw new Error("Facebook: access_token manquant")

  // Récupère la première page
  const pagesRes = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`,
    { signal: AbortSignal.timeout(10000) },
  )
  const pagesData = await pagesRes.json()
  const page = pagesData.data?.[0]
  if (!page) throw new Error("Aucune page Facebook trouvée — l'utilisateur doit être admin d'une page")

  // Upload vidéo à la page
  const form = new FormData()
  form.append("access_token", page.access_token)
  form.append("title", opts.title.slice(0, 255))
  form.append("description", opts.description.slice(0, 5000))

  // Facebook Graph API: on envoie l'URL de la vidéo pour un upload par URL
  const params = new URLSearchParams({
    access_token: page.access_token,
    file_url: opts.videoUrl,
    title: opts.title.slice(0, 255),
    description: opts.description.slice(0, 5000),
  })
  const uploadRes = await fetch(
    `https://graph.facebook.com/v18.0/${page.id}/videos?${params.toString()}`,
    { method: "POST", signal: AbortSignal.timeout(60000) },
  )
  const uploadData = await uploadRes.json()
  if (uploadData.error) throw new Error(`Facebook upload: ${uploadData.error.message || JSON.stringify(uploadData.error)}`)

  return {
    platform: "facebook",
    url: `https://www.facebook.com/${page.id}/videos/${uploadData.id}`,
    postId: uploadData.id,
  }
}

// ============================================================================
// Publication Instagram (via Facebook Graph API)
// ============================================================================

export async function publishToInstagram(opts: {
  videoUrl: string
  caption: string
}): Promise<PublishResult> {
  const storedIg = await getToken("instagram")
  const storedFb = await getToken("facebook")
  const accessToken = storedFb.access_token
  if (!accessToken) throw new Error("Facebook token requis pour publier sur Instagram")

  const pageId = storedIg.refresh_token // on a stocké le page_id dans refresh_token
  if (!pageId) throw new Error("Instagram: page_id manquant dans le token")

  // Récupère l'Instagram Business Account
  const igRes = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account{id}&access_token=${accessToken}`,
    { signal: AbortSignal.timeout(10000) },
  )
  const igData = await igRes.json()
  const igAccountId = igData.instagram_business_account?.id
  if (!igAccountId) throw new Error("Aucun compte Instagram Business lié à cette page Facebook")

  // 1. Créer le média container
  const createParams = new URLSearchParams({
    video_url: opts.videoUrl,
    caption: opts.caption.slice(0, 2200),
    media_type: "REELS",
    access_token: accessToken,
  })
  const createRes = await fetch(
    `https://graph.facebook.com/v18.0/${igAccountId}/media?${createParams.toString()}`,
    { method: "POST", signal: AbortSignal.timeout(30000) },
  )
  const createData = await createRes.json()
  if (createData.error) throw new Error(`Instagram media: ${createData.error.message || JSON.stringify(createData.error)}`)

  // 2. Publier le média (peut prendre quelques secondes)
  const publishParams = new URLSearchParams({ access_token: accessToken })
  let publishRes
  for (let attempt = 0; attempt < 8; attempt++) {
    publishRes = await fetch(
      `https://graph.facebook.com/v18.0/${igAccountId}/media_publish?${publishParams.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: createData.id }),
        signal: AbortSignal.timeout(30000),
      },
    )
    const publishData = await publishRes.json()
    if (publishData.id) {
      return {
        platform: "instagram",
        url: `https://www.instagram.com/p/${publishData.id}/`,
        postId: publishData.id,
      }
    }
    // Instagram peut renvoyer "Media not ready" — on retry
    if (publishData.error?.code === 9007 || publishData.error?.error_subcode === 2207027) {
      await new Promise(r => setTimeout(r, 4000))
      continue
    }
    throw new Error(`Instagram publish: ${publishData.error?.message || JSON.stringify(publishData.error)}`)
  }
  throw new Error("Instagram: délai dépassé — le média n'est pas prêt après 8 tentatives")
}

// ============================================================================
// Publication TikTok
// ============================================================================

export async function publishToTikTok(opts: {
  videoUrl: string
  title: string
}): Promise<PublishResult> {
  let accessToken: string

  try {
    const stored = await getToken("tiktok")
    if (stored.expires_at && new Date(stored.expires_at) <= new Date()) {
      // Token expiré → refresh
      accessToken = await refreshTikTokToken()
    } else if (stored.access_token) {
      accessToken = stored.access_token
    } else {
      throw new Error("TikTok: access_token manquant")
    }
  } catch {
    accessToken = await refreshTikTokToken()
  }

  // 1. Init upload
  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: {
        title: opts.title.slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: opts.videoUrl,
      },
    }),
    signal: AbortSignal.timeout(30000),
  })
  const initData = await initRes.json()
  if (initData.error) throw new Error(`TikTok init: ${initData.error.message || initData.error_description || JSON.stringify(initData.error)}`)

  const publishId = initData.data?.publish_id
  if (!publishId) throw new Error("TikTok: publish_id manquant dans la réponse")

  // 2. Poll le statut
  for (let attempt = 0; attempt < 15; attempt++) {
    const statusRes = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publish_id: publishId }),
      signal: AbortSignal.timeout(15000),
    })
    const statusData = await statusRes.json()
    const status = statusData.data?.status
    if (status === "PUBLISH_COMPLETE") {
      // TikTok ne retourne pas toujours l'URL directement — on la construit
      return {
        platform: "tiktok",
        url: `https://www.tiktok.com/@user/video/${publishId}`,
        postId: publishId,
      }
    }
    if (status === "FAILED") {
      throw new Error(`TikTok publish failed: ${statusData.data?.fail_reason || "raison inconnue"}`)
    }
    await new Promise(r => setTimeout(r, 4000))
  }

  return {
    platform: "tiktok",
    url: `https://www.tiktok.com/@user/video/${publishId}`,
    postId: publishId,
  }
}
