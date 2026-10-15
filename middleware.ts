import { NextRequest, NextResponse } from 'next/server'

// Access applies to every page and API. No secret configured means no access.
async function equalSecret(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [x, y] = await Promise.all([a, b].map(v => crypto.subtle.digest('SHA-256', encoder.encode(v))))
  const left = new Uint8Array(x), right = new Uint8Array(y)
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

function protect(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  // This read-only feed performs its own secret-token verification in its handler.
  if (path === '/api/calendar.ics' && req.method === 'GET') return protect(NextResponse.next())
  // These exact GET routes validate signed, expiring links in their handlers.
  if (req.method === 'GET' && [
    '/api/notify-client/stop-review',
    '/api/facture/stop-reminders',
    '/api/quote-complementaire/stop-reminders',
  ].includes(path)) return protect(NextResponse.next())
  // Allow the service-worker update so old private HTML caches can be removed.
  if (path === '/sw.js' && req.method === 'GET') return protect(NextResponse.next())

  const user = process.env.APRIME_ACCESS_USER || ''
  const password = process.env.APRIME_ACCESS_PASSWORD || ''
  if (!user || password.length < 24) {
    return protect(NextResponse.json({ error: 'Accès temporairement indisponible' }, { status: 503 }))
  }
  let suppliedUser = '', suppliedPassword = ''
  const header = req.headers.get('authorization') || ''
  if (/^Basic /i.test(header)) {
    try {
      const raw = atob(header.slice(6))
      const split = raw.indexOf(':')
      if (split >= 0) { suppliedUser = raw.slice(0, split); suppliedPassword = raw.slice(split + 1) }
    } catch { /* Malformed credentials are refused. */ }
  }
  const [userOK, passwordOK] = await Promise.all([
    equalSecret(suppliedUser, user), equalSecret(suppliedPassword, password),
  ])
  if (!userOK || !passwordOK) {
    const response = NextResponse.json({ error: 'Connexion requise' }, { status: 401 })
    response.headers.set('WWW-Authenticate', 'Basic realm="Aprime Fluides - espace prive", charset="UTF-8"')
    return protect(response)
  }
  // Browsers must initiate writes from this application, never another website.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin')
    const site = req.headers.get('sec-fetch-site')
    if ((origin && origin !== req.nextUrl.origin) || site === 'cross-site') {
      return protect(NextResponse.json({ error: 'Origine refusée' }, { status: 403 }))
    }
  }
  return protect(NextResponse.next())
}

export const config = { matcher: ['/:path*'] }
