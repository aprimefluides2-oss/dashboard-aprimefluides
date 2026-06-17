// Bump ce numéro pour invalider tous les caches existants chez les utilisateurs
// installés. Tout déploiement change déjà le hash des fichiers /_next/static/
// (cache-first sûr), mais cette constante sert de filet de sécurité pour les
// changements de stratégie SW elle-même.
const CACHE = 'ltdb-v2'

// Pré-charge minimaliste : la coquille HTML + le manifest, le reste est mis
// en cache à la volée par la stratégie fetch.
const PRECACHE = ['/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  )
  // Active le nouveau SW immédiatement sans attendre la fermeture des onglets.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function isApiOrExternal(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.host.endsWith('supabase.co') ||
    url.host.endsWith('deepseek.com')
  )
}

// Network-first : tente le réseau, fallback cache si offline. Indispensable pour
// les pages HTML — sans ça, l'utilisateur garde l'ancienne version après deploy
// jusqu'à désinstaller le PWA.
async function networkFirst(request) {
  try {
    const fresh = await fetch(request)
    if (fresh && fresh.ok && request.method === 'GET') {
      const clone = fresh.clone()
      caches.open(CACHE).then((cache) => cache.put(request, clone)).catch(() => {})
    }
    return fresh
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}

// Cache-first : pour les assets immuables (hash dans le nom de fichier).
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const fresh = await fetch(request)
    if (fresh && fresh.ok && request.method === 'GET') {
      const clone = fresh.clone()
      caches.open(CACHE).then((cache) => cache.put(request, clone)).catch(() => {})
    }
    return fresh
  } catch {
    return new Response('Hors ligne', { status: 503 })
  }
}

// Stale-while-revalidate : pour les images et autres assets non hashés —
// rendu instantané depuis cache, mise à jour en arrière-plan.
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok && request.method === 'GET') {
        const clone = res.clone()
        caches.open(CACHE).then((cache) => cache.put(request, clone)).catch(() => {})
      }
      return res
    })
    .catch(() => null)
  return cached || (await networkPromise) || new Response('Hors ligne', { status: 503 })
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }

  // API + externes : bypass complet (toujours réseau).
  if (isApiOrExternal(url)) return

  // Navigation HTML : network-first → l'utilisateur voit toujours la dernière
  // version déployée si online.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirst(req))
    return
  }

  // Assets Next.js avec hash dans le nom (chunks JS, CSS, fonts) : cache-first
  // long terme — le hash change à chaque build, donc impossible de servir du stale.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req))
    return
  }

  // Reste (images, icônes, manifest) : stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(req))
})
