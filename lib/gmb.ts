import { google } from "googleapis"
import { OAuth2Client } from "google-auth-library"
import { getSupabase } from "./supabase"
import { getParametre } from "./parametres"

/**
 * OAuth Google Business Profile (GMB).
 * Calqué sur lib/youtube.ts — même table `social_tokens`, plateforme "gmb".
 * Projet Cloud dédié : lestechniciensdudebouchage-gbp (≠ projet vidéo/YouTube).
 */
const SCOPES = ["https://www.googleapis.com/auth/business.manage"]
const PLATFORM = "gmb"

/**
 * Identifiants OAuth GMB — lus en priorité depuis la table `parametres`
 * (source unique de vérité, valable en local et sur Vercel), repli sur l'env.
 */
async function buildOAuthClient(): Promise<OAuth2Client> {
  const clientId = (await getParametre("GMB_CLIENT_ID", "")) || process.env.GMB_CLIENT_ID || ""
  const clientSecret =
    (await getParametre("GMB_CLIENT_SECRET", "")) || process.env.GMB_CLIENT_SECRET || ""
  const redirectUri =
    (await getParametre("GMB_REDIRECT_URI", "")) || process.env.GMB_REDIRECT_URI || ""
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "OAuth GMB non configuré (paramètres GMB_CLIENT_ID / GMB_CLIENT_SECRET / GMB_REDIRECT_URI)",
    )
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/** URL de consentement Google à ouvrir pour connecter le compte Business Profile. */
export async function getAuthUrl(): Promise<string> {
  const oauth = await buildOAuthClient()
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    include_granted_scopes: true,
  })
}

/** Échange le code OAuth contre les jetons et les stocke dans `social_tokens`. */
export async function exchangeCodeAndStore(code: string): Promise<{ email?: string }> {
  const oauth = await buildOAuthClient()
  const { tokens } = await oauth.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error(
      "Refresh token absent — révoque l'accès du compte sur myaccount.google.com/permissions puis relance la connexion.",
    )
  }

  let email: string | undefined
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64url").toString(),
      )
      email = payload?.email
    } catch {
      /* id_token non décodable — sans gravité */
    }
  }

  const sb = getSupabase()
  const { error } = await sb.from("social_tokens").upsert(
    {
      platform: PLATFORM,
      account_email: email || null,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token || null,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scope: tokens.scope || SCOPES.join(" "),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "platform" },
  )
  if (error) throw new Error(`DB upsert social_tokens: ${error.message}`)
  return { email }
}

/** Client OAuth prêt à l'emploi (refresh_token chargé depuis social_tokens). */
export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from("social_tokens")
    .select("refresh_token")
    .eq("platform", PLATFORM)
    .maybeSingle()
  if (error) throw new Error(`DB lecture social_tokens: ${error.message}`)
  if (!data?.refresh_token) {
    throw new Error("Aucun compte Google Business connecté — connecte-le via /api/oauth/gmb")
  }
  const oauth = await buildOAuthClient()
  oauth.setCredentials({ refresh_token: data.refresh_token })
  return oauth
}

/** Access token valide pour appeler les API Business Profile. */
async function getAccessToken(): Promise<string> {
  const { token } = await (await getAuthenticatedClient()).getAccessToken()
  if (!token) throw new Error("Impossible d'obtenir un access token GMB")
  return token
}

export type GmbLocation = {
  account: string // "accounts/123…"
  accountName: string
  location: string // "locations/456…"
  title: string
  address: string | null
}

/**
 * Liste les comptes Google Business et leurs fiches (établissements).
 * Account Management API v1 + Business Information API v1.
 */
export async function listGmbLocations(): Promise<GmbLocation[]> {
  const token = await getAccessToken()
  const headers = { Authorization: `Bearer ${token}` }

  const accRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers },
  )
  if (!accRes.ok) {
    throw new Error(
      `API comptes GMB : HTTP ${accRes.status} — ${(await accRes.text()).slice(0, 300)}`,
    )
  }
  const accJson = (await accRes.json()) as {
    accounts?: Array<{ name: string; accountName?: string }>
  }
  const accounts = accJson.accounts || []

  const readMask = encodeURIComponent("name,title,storefrontAddress")
  const out: GmbLocation[] = []
  for (const acc of accounts) {
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?readMask=${readMask}&pageSize=100`,
      { headers },
    )
    if (!locRes.ok) continue
    const locJson = (await locRes.json()) as {
      locations?: Array<{
        name: string
        title?: string
        storefrontAddress?: { addressLines?: string[]; locality?: string }
      }>
    }
    for (const loc of locJson.locations || []) {
      const a = loc.storefrontAddress
      out.push({
        account: acc.name,
        accountName: acc.accountName || acc.name,
        location: loc.name,
        title: loc.title || "(sans nom)",
        address: a
          ? [...(a.addressLines || []), a.locality].filter(Boolean).join(", ") || null
          : null,
      })
    }
  }
  return out
}

export type GmbPostInput = {
  summary: string
  photoUrl?: string | null
  ctaUrl?: string | null
}

/**
 * Crée un post local sur la fiche Google Business (API v4 `localPosts.create`).
 * Cible la fiche définie dans `parametres.GMB_LOCATION`.
 */
export async function createGmbPost(
  input: GmbPostInput,
): Promise<{ name: string; searchUrl: string | null }> {
  const location = (await getParametre("GMB_LOCATION", "")).trim()
  if (!location) {
    throw new Error(
      "parametres.GMB_LOCATION non défini — récupère la fiche via /api/gmb/locations",
    )
  }
  const summary = input.summary.trim().slice(0, 1490)
  if (!summary) throw new Error("Le texte du post est vide")

  const token = await getAccessToken()
  const body: Record<string, unknown> = {
    languageCode: "fr",
    summary,
    topicType: "STANDARD",
  }
  if (input.ctaUrl) {
    body.callToAction = { actionType: "LEARN_MORE", url: input.ctaUrl }
  }
  if (input.photoUrl) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: input.photoUrl }]
  }

  const res = await fetch(`https://mybusiness.googleapis.com/v4/${location}/localPosts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(
      `Création du post GMB : HTTP ${res.status} — ${(await res.text()).slice(0, 400)}`,
    )
  }
  const json = (await res.json()) as { name?: string; searchUrl?: string }
  return { name: json.name || "", searchUrl: json.searchUrl || null }
}

export type GmbPost = {
  name: string
  summary: string
  state: string
  createTime: string
  searchUrl: string | null
  photoUrl: string | null
}

/** Liste les posts publiés sur la fiche Google Business (API v4 `localPosts.list`). */
export async function listGmbPosts(): Promise<GmbPost[]> {
  const location = (await getParametre("GMB_LOCATION", "")).trim()
  if (!location) {
    throw new Error("parametres.GMB_LOCATION non défini — récupère la fiche via /api/gmb/locations")
  }
  const token = await getAccessToken()
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${location}/localPosts?pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    throw new Error(
      `Liste des posts GMB : HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`,
    )
  }
  const json = (await res.json()) as {
    localPosts?: Array<{
      name?: string
      summary?: string
      state?: string
      createTime?: string
      searchUrl?: string
      media?: Array<{ googleUrl?: string; sourceUrl?: string }>
    }>
  }
  return (json.localPosts || []).map(p => ({
    name: p.name || "",
    summary: p.summary || "",
    state: p.state || "",
    createTime: p.createTime || "",
    searchUrl: p.searchUrl || null,
    photoUrl: p.media?.[0]?.googleUrl || p.media?.[0]?.sourceUrl || null,
  }))
}
