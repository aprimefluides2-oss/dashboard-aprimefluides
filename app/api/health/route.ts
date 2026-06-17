import { NextResponse } from 'next/server'
import { deepseek } from '@/lib/deepseek'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

type Check = { ok: boolean; latencyMs?: number; detail?: string }

async function checkDeepseek(): Promise<Check> {
  if (!process.env.DEEPSEEK_API_KEY) return { ok: false, detail: 'DEEPSEEK_API_KEY missing' }
  const start = Date.now()
  try {
    await deepseek.messages.create({
      model: 'deepseek-v4-flash',
      max_tokens: 1,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: 'ok' }],
    })
    return { ok: true, latencyMs: Date.now() - start }
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, detail: String(e?.message || e).slice(0, 240) }
  }
}

async function checkBackend(): Promise<Check> {
  const url = process.env.CLIENT_API_URL
  if (!url) return { ok: false, detail: 'CLIENT_API_URL missing' }
  const start = Date.now()
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) })
    if (res.status >= 500) return { ok: false, latencyMs: Date.now() - start, detail: `HTTP ${res.status}` }
    return { ok: true, latencyMs: Date.now() - start, detail: `HTTP ${res.status}` }
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, detail: String(e?.message || e).slice(0, 240) }
  }
}

async function checkResend(): Promise<Check> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, detail: 'RESEND_API_KEY missing' }

  const fromEmail = process.env.RESEND_FROM_EMAIL
    || (process.env.RESEND_TEST_EMAIL ? 'onboarding@resend.dev' : 'contact@www.aprime-fluide.fr')
  const fromDomain = fromEmail.split('@')[1]

  const start = Date.now()
  try {
    const res = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 401 || res.status === 403) {
      return { ok: false, latencyMs: Date.now() - start, detail: `auth rejected (HTTP ${res.status})` }
    }
    if (!res.ok) return { ok: false, latencyMs: Date.now() - start, detail: `HTTP ${res.status}` }

    if (fromDomain === 'resend.dev') {
      return { ok: true, latencyMs: Date.now() - start, detail: 'test mode via resend.dev (RESEND_TEST_EMAIL set)' }
    }

    const body = await res.json().catch(() => null) as { data?: Array<{ name: string; status: string }> } | null
    const verified = body?.data?.find(d => d.name === fromDomain && d.status === 'verified')
    if (!verified) {
      const status = body?.data?.find(d => d.name === fromDomain)?.status || 'absent'
      return { ok: false, latencyMs: Date.now() - start, detail: `domain "${fromDomain}" not verified on Resend (status: ${status})` }
    }
    return { ok: true, latencyMs: Date.now() - start, detail: `domain "${fromDomain}" verified` }
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, detail: String(e?.message || e).slice(0, 240) }
  }
}

export async function GET() {
  const [deepseekCheck, backend, resend] = await Promise.all([checkDeepseek(), checkBackend(), checkResend()])

  // Clés JSON conservées (anthropic_api, env_anthropic_key) pour compat avec monitoring externe (Vercel, Uptime, etc.) — DeepSeek en interne
  const checks = {
    env_anthropic_key: { ok: !!process.env.DEEPSEEK_API_KEY } as Check,
    env_ltdb_api_url: { ok: !!process.env.CLIENT_API_URL } as Check,
    env_nextauth_secret: { ok: !!process.env.NEXTAUTH_SECRET } as Check,
    env_resend_key: { ok: !!process.env.RESEND_API_KEY } as Check,
    anthropic_api: deepseekCheck,
    backend_api: backend,
    resend_api: resend,
  }

  const failures: string[] = []
  for (const [name, r] of Object.entries(checks)) {
    if (!r.ok) failures.push(`${name}: ${r.detail || 'failed'}`)
  }

  const ok = failures.length === 0
  return NextResponse.json(
    {
      ok,
      service: 'app-aprimefluides',
      timestamp: new Date().toISOString(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'unknown',
      region: process.env.VERCEL_REGION || 'unknown',
      checks,
      failures,
    },
    { status: ok ? 200 : 503 },
  )
}
