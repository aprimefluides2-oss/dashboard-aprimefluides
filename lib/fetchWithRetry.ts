/**
 * fetch() avec timeout + retry exponentiel.
 *
 * - Retry uniquement sur erreurs réseau ou statuts 5xx / 408 / 429.
 * - Échecs 4xx (sauf 408/429) remontés tout de suite (erreur métier).
 * - Le message d'erreur agrégé indique combien de tentatives ont eu lieu.
 */

export type FetchWithRetryOptions = RequestInit & {
  /** Délai max par tentative en ms. Défaut 60000. */
  timeoutMs?: number
  /** Nombre total de tentatives (1 = sans retry). Défaut 3. */
  retries?: number
  /** Backoff initial en ms (sera doublé à chaque retry). Défaut 800. */
  backoffMs?: number
  /** Statuts HTTP à considérer comme "retryable" en plus des 5xx. Défaut [408, 429]. */
  retryStatuses?: number[]
}

function isRetryableStatus(status: number, extra: number[]): boolean {
  if (status >= 500) return true
  if (extra.includes(status)) return true
  return false
}

export async function fetchWithRetry(input: RequestInfo | URL, options: FetchWithRetryOptions = {}): Promise<Response> {
  const {
    timeoutMs = 60_000,
    retries = 3,
    backoffMs = 800,
    retryStatuses = [408, 429],
    signal: externalSignal,
    ...init
  } = options

  let lastError: unknown = null
  let lastStatus = 0
  let lastStatusText = ''

  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(new Error(`Timeout après ${timeoutMs}ms`)), timeoutMs)

    // Bridge entre le signal externe et le controller local de cette tentative.
    // Ref-counté pour pouvoir retirer le listener à la fin (évite fuite mémoire).
    let onExternalAbort: (() => void) | null = null
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId)
        throw externalSignal.reason ?? new Error('Aborted')
      }
      onExternalAbort = () => ctrl.abort(externalSignal.reason)
      externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }

    const cleanup = () => {
      clearTimeout(timeoutId)
      if (externalSignal && onExternalAbort) {
        externalSignal.removeEventListener('abort', onExternalAbort)
        onExternalAbort = null
      }
    }

    try {
      const res = await fetch(input, { ...init, signal: ctrl.signal })
      cleanup()
      if (res.ok) return res

      lastStatus = res.status
      lastStatusText = res.statusText
      if (!isRetryableStatus(res.status, retryStatuses) || attempt === retries) {
        return res
      }
    } catch (err) {
      cleanup()
      lastError = err
      if (attempt === retries) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`Échec réseau après ${retries} tentative(s) : ${msg}`)
      }
    }

    const delay = backoffMs * Math.pow(2, attempt - 1)
    await new Promise(r => setTimeout(r, delay))
  }

  if (lastError) {
    const msg = lastError instanceof Error ? lastError.message : String(lastError)
    throw new Error(`Échec réseau après ${retries} tentative(s) : ${msg}`)
  }
  throw new Error(`Échec HTTP ${lastStatus} ${lastStatusText} après ${retries} tentative(s)`)
}

/** Variante "JSON" qui parse la réponse et lève si !ok ou si payload contient `error`. */
export async function fetchJsonWithRetry<T = unknown>(input: RequestInfo | URL, options: FetchWithRetryOptions = {}): Promise<T> {
  const res = await fetchWithRetry(input, options)
  let data: any = null
  try {
    data = await res.json()
  } catch {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} (réponse non-JSON)`)
    throw new Error('Réponse non-JSON')
  }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'error' in data && data.error) ? String(data.error) : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data as T
}
