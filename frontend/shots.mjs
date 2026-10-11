/** Captures screenshots of the cart and checkout pages with items in the cart. */
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:5173'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1000 })

await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.p-card')
const buttons = await page.$$('.btn-primary')
await buttons[0].click()
await buttons[1].click()
await buttons[3].click()
await new Promise((r) => setTimeout(r, 1500))

await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.price-box')
await page.screenshot({ path: 'shot_cart.png' })
console.log('cart screenshot saved')

await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.pay-option')
await page.type('#name', 'Sunil Kumar')
await page.type('#phone', '9876543210')
await page.type('#address', 'House 12, Gandhi Nagar, Delhi 110051')
await page.screenshot({ path: 'shot_checkout.png' })
console.log('checkout screenshot saved')

await browser.close()