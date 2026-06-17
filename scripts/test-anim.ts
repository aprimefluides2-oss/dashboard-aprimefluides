import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'no-preference',
  })
  const page = await ctx.newPage()

  // Disable cache to force fresh load
  await ctx.addCookies([])
  await page.goto('https://app-aprimefluides.vercel.app/?nocache=' + Date.now(), { waitUntil: 'domcontentloaded' })

  const times = [100, 400, 800, 1100, 1500, 1800, 2100, 2500]
  for (const ms of times) {
    await page.waitForTimeout(ms === times[0] ? ms : ms - times[times.indexOf(ms) - 1])
    await page.screenshot({ path: `/tmp/anim-${String(ms).padStart(4, '0')}ms.png` })
    console.log(`captured t=${ms}ms`)
  }
  await browser.close()
}
main().catch(e => { console.error(e); process.exit(1) })
