import path from "node:path"
import os from "node:os"
import fs from "node:fs/promises"
import fsSync from "node:fs"
import { renderMedia, selectComposition } from "@remotion/renderer"
import {
  isVercelServerless,
  REMOTION_PROJECT_ROOT,
  withWritableRemotionCache,
} from "@/lib/remotion-serverless-env"
import { getServerlessChromiumConfig } from "@/lib/remotion-vercel-chrome"

export type VideoFormat = "vertical" | "horizontal" | "square"

const COMPOSITION_ID: Record<VideoFormat, string> = {
  vertical: "InterventionVertical",
  horizontal: "InterventionHorizontal",
  square: "InterventionSquare",
}

export type RenderInput = {
  format: VideoFormat
  photos: { url: string; caption?: string }[]
  ville?: string
  typeIntervention?: string
  clientNom?: string
  dateRealisee?: string
  enableMusic?: boolean
}

const PREBUNDLE_DIR = path.join(REMOTION_PROJECT_ROOT, "build")

function getServeUrl(): string {
  const fromEnv = process.env.REMOTION_SERVE_URL?.trim()
  if (fromEnv) return fromEnv

  const indexHtml = path.join(PREBUNDLE_DIR, "index.html")
  if (fsSync.existsSync(indexHtml)) {
    return PREBUNDLE_DIR
  }

  const hint = isVercelServerless()
    ? "Vérifiez que « remotion bundle » s’exécute avant next build."
    : "Lancez « npm run remotion:bundle » puis relancez le serveur."

  throw new Error(`Bundle Remotion introuvable (dossier build/). ${hint}`)
}

export async function renderVideoLocal(input: RenderInput): Promise<{ filePath: string; bytes: number }> {
  return withWritableRemotionCache(async () => {
    const serveUrl = getServeUrl()
    const inputProps = {
      format: input.format,
      photos: input.photos,
      ville: input.ville,
      typeIntervention: input.typeIntervention,
      clientNom: input.clientNom,
      dateRealisee: input.dateRealisee,
      enableMusic: input.enableMusic ?? true,
    }

    const serverlessChrome = await getServerlessChromiumConfig()
    if (!serverlessChrome && REMOTION_PROJECT_ROOT.startsWith("/var/task")) {
      throw new Error(
        "Rendu vidéo sur Vercel : Chromium serverless non initialisé. " +
          "Ajoutez AWS_LAMBDA_JS_RUNTIME=nodejs22.x dans Vercel → Environment Variables puis redeploy.",
      )
    }
    const renderOpts = serverlessChrome
      ? {
          browserExecutable: serverlessChrome.browserExecutable,
          chromiumOptions: {
            args: serverlessChrome.chromiumArgs,
            enableMultiProcessOnLinux: false,
            disableWebSecurity: true,
          },
        }
      : {}

    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID[input.format],
      inputProps,
      ...renderOpts,
    })

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ltdb-video-"))
    const filePath = path.join(tmpDir, `${input.format}.mp4`)

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: filePath,
      inputProps,
      overwrite: true,
      videoBitrate: "3M",
      x264Preset: "veryfast",
      ...renderOpts,
    })

    const stat = await fs.stat(filePath)
    return { filePath, bytes: stat.size }
  })
}

export async function renderVideo(input: RenderInput) {
  const lambdaFn = process.env.REMOTION_LAMBDA_FUNCTION_NAME
  if (lambdaFn) {
    throw new Error("Lambda mode not implemented yet — Phase 2bis")
  }
  return renderVideoLocal(input)
}
