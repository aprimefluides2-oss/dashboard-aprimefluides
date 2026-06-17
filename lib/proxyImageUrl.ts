/**
 * Transforme une URL d'image externe en URL passant par notre proxy
 * `/api/proxy-image`. Indispensable pour @react-pdf/renderer côté browser
 * qui requiert des images servies avec `Access-Control-Allow-Origin: *`.
 *
 * - URLs internes (relatives ou même origin) → retournées telles quelles
 * - URLs externes → préfixées par le proxy
 */
export function proxyImageUrl(url: string): string {
  if (!url) return url
  // Relative path → inchangé
  if (!/^https?:\/\//i.test(url)) return url

  // Même origin (en navigateur) → inchangé
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(url)
      if (u.origin === window.location.origin) return url
    } catch {
      return url
    }
  }

  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}
