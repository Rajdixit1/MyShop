/** Captures mobile-sized screenshots to verify responsive + install UX. */
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:5173'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })

await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 900))
await page.screenshot({ path: 'shot_mobile_home.png' })
console.log('mobile home saved')

await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle2' })
await page.waitForSelector('#adm-user')
await page.click('.btn-primary')
await page.waitForSelector('.stat-card', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: 'shot_mobile_admin.png' })
console.log('mobile admin saved')

await browser.close()