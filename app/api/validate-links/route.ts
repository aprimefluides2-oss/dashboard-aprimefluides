import { NextRequest, NextResponse } from "next/server"

const SITE = "https://www.aprime-fluides.fr"

function extractHrefs(html: string): string[] {
  const out: string[] = []
  const re = /<a\s+[^>]*href=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) out.push(m[1])
  return out
}

function toAbsoluteInternalUrl(href: string): string | null {
  try {
    const base = new URL(SITE)
    const url = href.startsWith("http") ? new URL(href) : new URL(href, base)
    if (url.hostname !== base.hostname) return null
    return url.toString()
  } catch {
    return null
  }
}

async function checkUrl(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(7000) })
    if (head.ok) return { ok: true, status: head.status }
    const get = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(7000) })
    return { ok: get.ok, status: get.status }
  } catch (e: any) {
    return { ok: false, error: e?.message || "network_error" }
  }
}

export async function POST(req: NextRequest) {
  const { content_html, related_services } = await req.json()
  const hrefsFromContent = extractHrefs(String(content_html || ""))
  const hrefsFromRelated = Array.isArray(related_services)
    ? related_services.map((s: any) => String(s?.url || "")).filter(Boolean)
    : []

  const all = [...hrefsFromContent, ...hrefsFromRelated]
  const internal = Array.from(new Set(all.map(toAbsoluteInternalUrl).filter(Boolean) as string[]))

  const checks = await Promise.all(internal.map(async (url) => ({ url, ...(await checkUrl(url)) })))
  const broken = checks.filter((c) => !c.ok)

  return NextResponse.json({
    ok: broken.length === 0,
    checked_count: checks.length,
    broken,
  })
}
