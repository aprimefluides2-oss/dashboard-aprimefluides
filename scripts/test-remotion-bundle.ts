/**
 * Vérifie que le bundle Remotion est utilisable (chemins + lecture bundle.js.map).
 *
 * Usage: npm run test:remotion
 *        npm run test:remotion -- --vercel
 *        npm run test:remotion -- --compose
 */
import fs from "node:fs"
import path from "node:path"

const withCompose = process.argv.includes("--compose")
const simulateVercel = process.argv.includes("--vercel")

function ok(msg: string) {
  console.log(`✓ ${msg}`)
}
function fail(msg: string): never {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

async function main() {
  if (simulateVercel) {
    process.env.VERCEL = "1"
    if (!process.env.REMOTION_PROJECT_ROOT) {
      process.env.REMOTION_PROJECT_ROOT = process.cwd()
    }
  }

  const { REMOTION_PROJECT_ROOT, withWritableRemotionCache } = await import("../lib/remotion-serverless-env")

  console.log("VERCEL =", process.env.VERCEL || "0")
  console.log("REMOTION_PROJECT_ROOT =", REMOTION_PROJECT_ROOT)
  console.log("cwd =", process.cwd())

  const buildDir = path.join(REMOTION_PROJECT_ROOT, "build")
  const indexHtml = path.join(buildDir, "index.html")
  const bundleMap = path.join(buildDir, "bundle.js.map")

  if (!fs.existsSync(indexHtml)) {
    fail(`index.html introuvable : ${indexHtml}\n→ Lancez npm run remotion:bundle`)
  }
  ok(`index.html présent`)

  if (!fs.existsSync(bundleMap)) {
    fail(`bundle.js.map introuvable : ${bundleMap}`)
  }
  ok(`bundle.js.map lisible (${fs.statSync(bundleMap).size} octets)`)

  try {
    fs.readFileSync(bundleMap, "utf8")
    ok("lecture bundle.js.map OK (simule ENOENT Vercel)")
  } catch (e) {
    fail(`lecture map : ${e}`)
  }

  if (!withCompose) {
    console.log("\nTest léger OK.")
    return
  }

  const { selectComposition } = await import("@remotion/renderer")
  const inputProps = {
    format: "horizontal" as const,
    photos: [{ url: "https://picsum.photos/1280/720" }],
    ville: "Argenteuil",
    typeIntervention: "Débouchage",
    enableMusic: false,
  }

  await withWritableRemotionCache(async () => {
    console.log("\nselectComposition InterventionHorizontal…")
    const composition = await selectComposition({
      serveUrl: buildDir,
      id: "InterventionHorizontal",
      inputProps,
    })
    ok(`composition : ${composition.id} (${composition.durationInFrames} frames)`)
  })

  console.log("\nTest complet OK.")
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e)
  if (e instanceof Error && e.stack) console.error(e.stack)
  process.exit(1)
})
