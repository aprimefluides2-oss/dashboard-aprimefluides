import { chromium } from 'playwright'
import fs from 'fs'

const URL = process.env.TEST_URL || 'https://app-aprimefluides.vercel.app/preview-pdf'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ acceptDownloads: true })
  const page = await ctx.newPage()

  const errors: string[] = []
  page.on('pageerror', e => {
    errors.push(`[PAGE ERROR] ${e.message}\n${e.stack}`)
  })
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[CONSOLE ERROR] ${msg.text()}`)
  })
  page.on('requestfailed', req => {
    errors.push(`[REQ FAILED] ${req.url()} — ${req.failure()?.errorText}`)
  })

  console.log('Opening', URL)
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
  console.log('Page loaded, title:', await page.title())

  // wait for the download button
  await page.waitForSelector('button:has-text("Télécharger PDF"), a:has-text("Télécharger PDF")', { timeout: 15000 })

  // Give the PDFDownloadLink time to generate
  console.log('Waiting 3s for PDF link blob to be ready...')
  await page.waitForTimeout(3000)

  // Click download
  console.log('Clicking download...')
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('button:has-text("Télécharger PDF"), a:has-text("Télécharger PDF")'),
  ])

  const outPath = '/tmp/test-preview-download.pdf'
  await download.saveAs(outPath)
  const stat = fs.statSync(outPath)
  console.log(`Downloaded ${download.suggestedFilename()} → ${outPath}  (${stat.size} bytes)`)

  if (errors.length > 0) {
    console.log('\n=== ERRORS CAPTURED ===')
    errors.forEach(e => console.log(e))
  }

  await browser.close()
}

main().catch(e => {
  console.error('FAIL:', e)
  process.exit(1)
})
