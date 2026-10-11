/**
 * E2E test for customer auth + admin panel using a real Chrome instance.
 * Run:  npm run test:admin-e2e
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:5173'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PHONE = '9' + String(Math.floor(100000000 + Math.random() * 899999999))

let passed = 0
let failed = 0
const check = (label, ok, extra = '') => {
  if (ok) { passed++; console.log(`  PASS  ${label} ${extra}`) }
  else { failed++; console.log(`  FAIL  ${label} ${extra}`) }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1500,1000'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1000 })

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('response', (r) => {
  if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`)
})

const text = () => page.evaluate(() => document.body.innerText)

async function clickText(selector, label) {
  const handle = await page.evaluateHandle(
    (sel, lbl) => [...document.querySelectorAll(sel)].find((el) => el.innerText.trim().includes(lbl)),
    selector, label,
  )
  const el = handle.asElement()
  if (!el) throw new Error(`No ${selector} containing "${label}"`)
  await el.click()
}

console.log('1. Customer registers a new account')
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.login-box')
await clickText('.tab', 'Register')
await page.type('#reg-name', 'E2E Customer')
await page.type('#reg-phone', PHONE)
await page.type('#reg-pass', 'secret123')
await page.type('#reg-addr', '12 Test Street, Delhi 110051')
await clickText('.btn-primary', 'Create Account')
await page.waitForSelector('.price-box', { timeout: 15000 })
// The page shows a spinner while fetching orders; wait for it to clear.
await page.waitForFunction(
  () => document.querySelectorAll('.spinner').length === 0
    && document.body.innerText.includes('No orders yet'),
  { timeout: 15000 },
)
check('registered and landed on orders page', (await text()).includes('E2E Customer'))
check('no orders yet message', (await text()).includes('No orders yet'))

console.log('2. Header shows the logged-in user')
const header = await page.$eval('.header', (el) => el.innerText)
check('header greets user by name', header.includes('E2E'), `-> "${header.replace(/\n/g, ' ')}"`)

console.log('3. Checkout links the order to the logged-in user')
await page.goto(`${BASE}/product/tata-salt-1kg`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.btn-primary')
await clickText('.btn-primary', 'ADD TO CART')
await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.pay-option')
await page.type('#name', 'E2E Customer')
await page.type('#phone', PHONE)
await page.type('#address', '12 Test Street, Delhi 110051')
await clickText('.btn-green', 'PLACE ORDER')
await page.waitForSelector('.success-box', { timeout: 20000 })
check('order placed while logged in', (await text()).includes('Order Confirmed'))

console.log('4. Order appears in My Orders with status')
await page.goto(`${BASE}/orders`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.badge', { timeout: 15000 })
const ordersText = await text()
check('order listed for customer', /RD\d+/.test(ordersText))
check('status badge shown', ordersText.includes('Order Confirmed'))
check('lifetime spend computed', ordersText.includes('Lifetime spend'))

console.log('5. Logout returns to guest mode')
await clickText('.link-btn', 'LOGOUT')
await page.waitForFunction(() => !document.body.innerText.includes('E2E'), { timeout: 10000 })
check('logged out', true)

console.log('6. Admin route is protected')
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' })
await page.waitForFunction(() => location.pathname === '/admin/login', { timeout: 10000 })
check('redirected to admin login', true)

console.log('7. Admin login and dashboard')
await page.waitForSelector('#adm-user')
await clickText('.btn-primary', 'Login to Dashboard')
await page.waitForSelector('.stat-card', { timeout: 15000 })
const dash = await text()
check('dashboard stat cards render', (await page.$$('.stat-card')).length === 6)
check('shows revenue', (await text()).toUpperCase().includes('TOTAL REVENUE'))
check('best sellers table', dash.includes('Best selling products'))
console.log('8. Admin can create a product')
await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle2' })
await page.waitForSelector('table.data')
const beforeCount = (await page.$$('table.data tbody tr')).length
await clickText('.btn-sm.green', 'Add Product')
await page.waitForSelector('.admin-modal')
const inputs = await page.$$('.admin-modal input')
await inputs[0].type('E2E Test Masala')
await inputs[1].type('E2E Brand')
const numbers = await page.$$('.admin-modal input[type=number]')
await numbers[0].type('199')
await numbers[1].type('249')
await clickText('.modal-actions .btn-sm.green', 'Save')
await page.waitForFunction(
  (n) => document.querySelectorAll('table.data tbody tr').length === n + 1,
  { timeout: 15000 },
  beforeCount,
)
check('product created and listed', true, `-> ${beforeCount} -> ${beforeCount + 1}`)

console.log('8b. Admin can upload a product photo')
// build a real PNG in the page, then feed it to the file input like a user would
const pngDataUrl = await page.evaluate(() => {
  const c = document.createElement('canvas')
  c.width = 40; c.height = 40
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ff8c00'
  ctx.fillRect(0, 0, 40, 40)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 26px sans-serif'
  ctx.fillText('E2E', 3, 28)
  return c.toDataURL('image/png')
})
await clickText('.btn-sm.blue', 'Edit')
await page.waitForSelector('.admin-modal')
await page.waitForSelector('[data-testid="upload-input"]', { timeout: 10000 })
// puppeteer's uploadFile takes a real path, so write the PNG to a temp file first
const pngPath = path.join(os.tmpdir(), 'e2e-product.png')
fs.writeFileSync(pngPath, Buffer.from(pngDataUrl.split(',')[1], 'base64'))
const fileInput = await page.$('[data-testid="upload-input"]')
await fileInput.uploadFile(pngPath)
await page.waitForFunction(
  () => document.querySelector('[data-testid="upload-msg"]')?.innerText.includes('Image uploaded'),
  { timeout: 20000 },
)
check('image uploaded from the admin form', true)
const previewSrc = await page.$eval('[data-testid="upload-preview"] img', (el) => el.getAttribute('src'))
check('preview shows the uploaded photo', previewSrc?.startsWith('/uploads/'), `-> ${previewSrc}`)
await clickText('.modal-actions .btn-sm.green', 'Save')
await page.waitForFunction(() => !document.querySelector('.admin-modal'), { timeout: 15000 })

// the storefront must render the photo too, not the emoji fallback
await page.goto(`${BASE}/products?q=E2E`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.p-media', { timeout: 15000 })
const cardHasPhoto = await page.$$eval('.p-media', (els) =>
  els.some((el) => el.querySelector('img')?.getAttribute('src')?.startsWith('/uploads/')))
check('storefront renders the uploaded photo', cardHasPhoto)

// back to the admin product list so the remaining steps still have their page
await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle2' })
await page.waitForSelector('table.data', { timeout: 15000 })

console.log('9. Admin can edit a product')
await clickText('.btn-sm.blue', 'Edit')
await page.waitForSelector('.admin-modal')
const stockInput = (await page.$$('.admin-modal input[type=number]'))[2]
await stockInput.click({ clickCount: 3 })
await stockInput.type('7')
await clickText('.modal-actions .btn-sm.green', 'Save')
await page.waitForFunction(() => !document.querySelector('.admin-modal'), { timeout: 15000 })
const badges = await page.$$eval('.badge', (els) => els.map((e) => e.innerText))
check('stock updated to 7', badges.includes('7'), `-> ${badges.slice(0, 6)}`)

console.log('10. Admin can delete the product')
// earlier runs may have left extra "E2E Test Masala" rows behind, so delete them
// all instead of assuming exactly one row is present
const namesNow = await page.$$eval('table.data tbody tr td:first-child', (els) => els.map((e) => e.innerText))
const targets = namesNow.filter((n) => n.includes('E2E Test Masala')).length
for (let i = namesNow.length - 1; i >= 0; i -= 1) {
  if (!namesNow[i].includes('E2E Test Masala')) continue
  const before = (await page.$$('table.data tbody tr')).length
  page.once('dialog', (d) => d.accept())
  await page.$$eval(
    'table.data tbody tr',
    (els, idx) => els[idx].querySelector('.btn-sm.red').click(),
    i,
  )
  // deleting one row must shrink the table by exactly one
  await page.waitForFunction(
    (n) => document.querySelectorAll('table.data tbody tr').length === n - 1,
    { timeout: 15000 },
    before,
  )
}
check('product deleted', true, `-> removed ${targets} row(s)`)

console.log('11. Admin order management')
await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle2' })
await page.waitForSelector('table.data')
check('customer order visible to admin', (await text()).includes('E2E Customer'))
const select = await page.$('table.data tbody tr select')
await select.select('Shipped')
await page.waitForFunction(() => document.body.innerText.includes('Shipped'), { timeout: 15000 })
check('order status changed to Shipped', true)

console.log('12. Admin customers page')
await page.goto(`${BASE}/admin/customers`, { waitUntil: 'networkidle2' })
await page.waitForSelector('table.data')
check('registered customer appears', (await text()).includes(PHONE), `-> ${PHONE}`)

console.log('13. Admin sign out')
await clickText('.btn-sm.red', 'Sign out')
await page.waitForFunction(() => location.pathname === '/admin/login', { timeout: 10000 })
check('signed out of admin', true)

console.log('14. PWA assets are served')
for (const p of ['/manifest.webmanifest', '/sw.js', '/icons/icon-192.png', '/icons/icon-512.png']) {
  const res = await page.goto(`${BASE}${p}`)
  check(`${p} served`, res.status() === 200, `-> ${res.status()}`)
}
const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json()
check('manifest has app name', manifest.name.includes('Devenand'))
check('manifest display is standalone', manifest.display === 'standalone')
check('manifest has maskable icon', manifest.icons.some((i) => i.purpose === 'maskable'))

check('zero server/page errors', errors.length === 0, errors.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
check('recent orders table', dash.includes('Recent orders'))