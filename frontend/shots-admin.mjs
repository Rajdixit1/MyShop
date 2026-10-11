/** Captures screenshots of the admin panel pages. */
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:5173'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1000 })

await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle2' })
await page.waitForSelector('#adm-user')
await page.click('.btn-primary')
await page.waitForSelector('.stat-card', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: 'shot_admin_dashboard.png' })
console.log('dashboard saved')

// product form with the image uploader
await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle2' })
await page.waitForSelector('table.data', { timeout: 15000 })
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.btn-sm.green')].find((b) => b.innerText.includes('Add Product'))
  btn.click()
})
await page.waitForSelector('[data-testid="upload-input"]', { timeout: 15000 })
await page.evaluate(() => {
  // fill in enough of the form to look like a real product
  const inputs = document.querySelectorAll('.admin-modal input')
  inputs[0].value = 'Premium Basmati Rice'
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
  inputs[1].value = 'Daal Boro'
  inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: 'shot_admin_upload.png' })
console.log('upload form saved')

await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle2' })
await page.waitForSelector('table.data')
await page.click('.btn-sm.green')
await page.waitForSelector('.admin-modal')
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: 'shot_admin_products.png' })
console.log('products + modal saved')

await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle2' })
await page.waitForSelector('table.data')
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: 'shot_admin_orders.png' })
console.log('orders saved')

await browser.close()