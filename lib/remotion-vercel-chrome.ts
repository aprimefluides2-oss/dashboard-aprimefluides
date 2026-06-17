import path from "node:path"
import { isVercelServerless } from "@/lib/remotion-serverless-env"

export type ServerlessChromiumConfig = {
  browserExecutable: string
  chromiumArgs: string[]
}

let cached: ServerlessChromiumConfig | null = null

/**
 * Chromium packagé pour AWS Lambda / Vercel (libs NSS incluses).
 * Nécessite AWS_LAMBDA_JS_RUNTIME=nodejs22.x (vercel.json ou dashboard).
 */
export async function getServerlessChromiumConfig(): Promise<ServerlessChromiumConfig | null> {
  if (!isVercelServerless()) return null
  if (cached) return cached

  // Doit exister AVANT l'import de @sparticuz/chromium (extrait al2023.tar.br)
  process.env.AWS_LAMBDA_JS_RUNTIME ??= "nodejs22.x"

  type SparticuzChromium = {
    executablePath: () => Promise<string>
    args: string[]
  }
  let chromium: SparticuzChromium
  try {
    const mod = await import("@sparticuz/chromium")
    chromium = ((mod as { default?: SparticuzChromium }).default ?? mod) as SparticuzChromium
  } catch (e) {
    throw new Error(
      `Module @sparticuz/chromium introuvable sur le serveur : ${e instanceof Error ? e.message : e}`,
    )
  }

  let executablePath: string
  try {
    executablePath = await chromium.executablePath()
  } catch (e) {
    throw new Error(
      `Extraction Chromium serverless échouée (vérifiez AWS_LAMBDA_JS_RUNTIME=nodejs22.x et le tracing Vercel) : ${
        e instanceof Error ? e.message : e
      }`,
    )
  }

  if (!executablePath || !executablePath.includes("chromium")) {
    throw new Error(`Chemin Chromium serverless invalide : ${executablePath}`)
  }
  const execDir = path.dirname(executablePath)

  const libPaths = [
    "/tmp/al2023/lib",
    "/tmp/al2/lib",
    execDir,
    process.env.LD_LIBRARY_PATH,
  ].filter(Boolean) as string[]

  process.env.LD_LIBRARY_PATH = Array.from(new Set(libPaths)).join(":")

  cached = {
    browserExecutable: executablePath,
    chromiumArgs: chromium.args,
  }
  return cached
}
