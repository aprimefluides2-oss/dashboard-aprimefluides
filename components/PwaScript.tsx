'use client'

import { useEffect } from 'react'

export function PwaScript() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let refreshing = false
    // Quand le nouveau SW prend le contrôle (après skipWaiting + clients.claim),
    // on recharge une seule fois pour que la page utilise la nouvelle version
    // sans avoir à fermer/rouvrir le PWA.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Force la vérif d'une nouvelle version à l'ouverture — important sur iOS
      // où la check automatique peut être espacée de plusieurs heures.
      reg.update().catch(() => {})
    }).catch(() => {
      // Silencieux — le site fonctionne sans service worker
    })
  }, [])

  return null
}
