import fs from "node:fs"
import os from "node:os"
import path from "node:path"

/**
 * Racine du projet (stable même si process.chdir() est appelé pour le cache Chrome).
 * Sur Vercel le bundle précompilé vit dans /var/task/build.
 */
export const REMOTION_PROJECT_ROOT = path.resolve(
  process.env.REMOTION_PROJECT_ROOT
    ?? (process.env.VERCEL === "1" ? "/var/task" : process.cwd()),
)

/** Vercel / AWS Lambda : pas de Chrome système avec libnspr4. */
export function isVercelServerless(): boolean {
  if (process.env.REMOTION_FORCE_LOCAL_CHROME === "1") return false
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) return true
  if (process.env.AWS_EXECUTION_ENV?.includes("AWS_Lambda")) return true
  // Fallback fiable : déploiement Next sur Vercel = /var/task
  try {
    return process.platform === "linux" && fs.existsSync("/var/task")
  } catch {
    return false
  }
}

/**
 * Sur Vercel, /var/task est en lecture seule. Remotion place le cache Chrome
 * dans node_modules/.remotion (via process.cwd()). En se plaçant dans /tmp,
 * le cache devient /tmp/.remotion (écritable).
 */
export async function withWritableRemotionCache<T>(fn: () => Promise<T>): Promise<T> {
  if (!isVercelServerless()) {
    return fn()
  }

  const tmp = os.tmpdir()
  const previousCwd = process.cwd()
  process.chdir(tmp)
  fs.mkdirSync(path.join(tmp, ".remotion"), { recursive: true })

  try {
    return await fn()
  } finally {
    process.chdir(previousCwd)
  }
}
