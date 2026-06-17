import { chromium } from 'playwright'

async function shot(vp: { width: number; height: number }, name: string) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: vp })
  const page = await ctx.newPage()
  await page.goto('https://app-aprimefluides.vercel.app/?t=' + Date.now(), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.screenshot({ path: `/tmp/resp-${name}.png` })
  await browser.close()
  console.log(`${name} OK`)
}

async function main() {
  await shot({ width: 390, height: 844 }, 'iphone14')
  await shot({ width: 375, height: 667 }, 'iphonese')
  await shot({ width: 360, height: 740 }, 'android-s')
  await shot({ width: 768, height: 1024 }, 'ipad')
  await shot({ width: 1280, height: 800 }, 'desktop')
}

main().catch(e => { console.error(e); process.exit(1) })
