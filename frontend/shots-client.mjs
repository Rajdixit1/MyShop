/** Captures screenshots of the customer login and My Orders pages. */
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:5173'
const PHONE = '9' + String(Math.floor(100000000 + Math.random() * 899999999))

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1000 })

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.login-box')
await page.screenshot({ path: 'shot_login.png' })
console.log('login saved')

await page.evaluate(() => {
  [...document.querySelectorAll('.tab')].find((t) => t.innerText.includes('Register')).click()
})
await page.waitForSelector('#reg-name')
await page.type('#reg-name', 'Sunil Kumar')
await page.type('#reg-phone', PHONE)
await page.type('#reg-pass', 'secret123')
await page.type('#reg-addr', 'Flat 402, Green Park, New Delhi 110016')
await page.click('.btn-primary')
await page.waitForSelector('.price-box', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: 'shot_my_orders.png' })
console.log('my orders saved')

// one real order so the page shows a status badge
await page.goto(`${BASE}/product/tata-salt-1kg`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.btn-primary')
await page.click('.btn-primary')
await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.pay-option')
await page.type('#name', 'Sunil Kumar')
await page.type('#phone', PHONE)
await page.type('#address', 'Flat 402, Green Park, New Delhi 110016')
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.btn-green')]
    .find((b) => b.innerText.includes('PLACE ORDER'))
  btn.click()
})
await page.waitForSelector('.success-box', { timeout: 20000 })
await page.goto(`${BASE}/orders`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.badge', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: 'shot_my_orders.png' })
console.log('my orders with order saved')

await browser.close()