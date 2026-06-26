import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()

  const errs: string[] = []
  page.on('pageerror', e => errs.push(`[pageerror] ${e.message}`))
  page.on('console', msg => { if (msg.type() === 'error') errs.push(`[console.error] ${msg.text()}`) })
  page.on('requestfailed', req => errs.push(`[reqfailed] ${req.url()} — ${req.failure()?.errorText}`))

  console.log('Opening /...')
  await page.goto('https://app-aprimefluides.vercel.app/', { waitUntil: 'networkidle', timeout: 30000 })
  console.log('Loaded. Taking screenshot at t=0...')
  await page.screenshot({ path: '/tmp/home-0ms.png', fullPage: true })

  await page.waitForTimeout(1500)
  console.log('Taking screenshot at t=1500ms...')
  await page.screenshot({ path: '/tmp/home-1500ms.png', fullPage: true })

  // Check if the buttons are visible
  const btn1 = await page.locator('a[href="/nouveau"]').isVisible().catch(() => false)
  const btn2 = await page.locator('a[href="/devis"]').isVisible().catch(() => false)
  const ltdbText = await page.locator('h1:has-text("Aprime")').isVisible().catch(() => false)

  console.log('Aprime h1 visible:', ltdbText)
  console.log('Rapport button visible:', btn1)
  console.log('Devis button visible:', btn2)

  if (errs.length) {
    console.log('\n=== ERRORS ===')
    errs.forEach(e => console.log(e))
  } else {
    console.log('\nNo errors')
  }

  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
