/**
 * End-to-end smoke test of the shopping flow using a real Chrome instance.
 * Run:  node e2e-test.mjs
 */
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:5173'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

let passed = 0
let failed = 0
const check = (label, ok, extra = '') => {
  if (ok) {
    passed++
    console.log(`  PASS  ${label} ${extra}`)
  } else {
    failed++
    console.log(`  FAIL  ${label} ${extra}`)
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1500,1000'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1000 })

const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(String(e)))
page.on('requestfailed', (r) => consoleErrors.push(`REQFAIL ${r.url()}`))
page.on('response', (r) => {
  if (r.status() >= 400) consoleErrors.push(`HTTP ${r.status()} ${r.url()}`)
})

const text = () => page.evaluate(() => document.body.innerText)
const clickByText = async (selector, label) => {
  const handle = await page.evaluateHandle(
    (sel, lbl) => [...document.querySelectorAll(sel)].find((el) => el.innerText.trim().includes(lbl)),
    selector,
    label,
  )
  const el = handle.asElement()
  if (!el) throw new Error(`Could not find ${selector} with text "${label}"`)
  await el.click()
}

console.log('1. Home page loads with products')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.p-card', { timeout: 15000 })
check('product cards rendered', (await page.$$('.p-card')).length > 10)
check('category strip rendered', (await page.$$('.cat-item')).length >= 12)
check('banner rendered', (await page.$$('.banner-slide')).length === 1)

console.log('2. Add to cart from home')
await clickByText('.btn-primary', 'ADD TO CART')
await page.waitForFunction(
  () => document.querySelector('.cart-badge')?.innerText.trim() === '1',
  { timeout: 10000 },
)
check('cart badge shows 1', true)

console.log('3. Cart page shows server-priced summary')
await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.price-box', { timeout: 15000 })
const cartText = await text()
check('cart line item visible', cartText.includes('ADD') === false && cartText.includes('PRICE DETAILS'))
check('free delivery hint shown', cartText.includes('FREE delivery'))
check('price box total present', cartText.includes('Total Amount'))

console.log('4. Increase quantity from cart')
const before = await page.$eval('.qty-box span', (el) => el.innerText)
await clickByText('.qty-box button', '＋')
await page.waitForFunction(
  (prev) => document.querySelector('.qty-box span')?.innerText !== prev,
  { timeout: 10000 },
  before,
)
const after = await page.$eval('.qty-box span', (el) => el.innerText)
check('quantity incremented', Number(after) === Number(before) + 1, `${before} -> ${after}`)

console.log('5. Checkout sends a signed-out shopper to login')
await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle2' })
await page.waitForFunction(() => location.pathname === '/login', { timeout: 10000 })
check('checkout redirects to login when signed out', true)
check('login remembers where to come back',
  (await page.url()).includes('next=/checkout'), `-> ${page.url().split('?')[1]}`)

console.log('6. Registering mid-checkout returns to the checkout form')
await clickByText('.tab', 'Register')
await page.waitForSelector('#reg-name')
const GUEST_PHONE = `9${String(Math.floor(100000000 + Math.random() * 899999999))}`
await page.type('#reg-name', 'Sunil Kumar')
await page.type('#reg-phone', GUEST_PHONE)
await page.type('#reg-pass', 'test123')
await clickByText('.btn-primary', 'Create Account')
await page.waitForSelector('.pay-option', { timeout: 20000 })
check('after login the checkout form is shown', page.url().includes('/checkout'))

console.log('7. Checkout pre-fills the account details')
const prefilledName = await page.$eval('#name', (el) => el.value)
const prefilledPhone = await page.$eval('#phone', (el) => el.value)
check('name pre-filled from the account', prefilledName === 'Sunil Kumar', `-> "${prefilledName}"`)
check('phone pre-filled from the account', prefilledPhone === GUEST_PHONE, `-> "${prefilledPhone}"`)

console.log('8. Checkout validation blocks an order with no address')
await clickByText('.btn-green', 'PLACE ORDER')
await page.waitForSelector('.field .err', { timeout: 5000 })
check('address error shown when nothing is filled', (await page.$$('.field .err')).length >= 1)

console.log('9. Map pin picker renders and drops a pin')
await page.waitForSelector('[data-testid="geo-map"]', { timeout: 15000 })
check('location map rendered', true)
const mapBox = await page.$eval('[data-testid="geo-map"]', (el) => {
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
// drag the map and release to drop the pin
await page.mouse.move(mapBox.x, mapBox.y)
await page.mouse.down()
await page.mouse.move(mapBox.x + 60, mapBox.y + 40, { steps: 8 })
await page.mouse.up()
await page.waitForSelector('[data-testid="geo-coords"]', { timeout: 8000 })
const coords = await page.$eval('[data-testid="geo-coords"]', (el) => el.innerText)
check('pin dropped on the map', /Pinned\s+-?\d+\.\d+/.test(coords), `-> ${coords.trim()}`)

console.log('10. Save the address for reuse and place the order')
await page.type('#address', 'House 12, Gandhi Nagar, Delhi 110051')
await clickByText('[data-testid="save-address-btn"]', 'SAVE THIS ADDRESS')
await page.waitForFunction(
  () => document.body.innerText.includes('Saved - you can reuse it'),
  { timeout: 10000 },
)
check('address saved to the account', true)
await page.waitForSelector('[data-testid="saved-address"]', { timeout: 8000 })
check('saved address is offered for reuse', true)

await clickByText('.pay-option', 'Cash on Delivery')
await clickByText('.btn-green', 'PLACE ORDER')
await page.waitForSelector('.success-box', { timeout: 20000 })
const successText = await text()
check('order confirmed page', successText.includes('Order Confirmed'))
check('order number shown', /Order Number: RD\d+/.test(successText))
check('delivery map shown on the success page',
  (await page.$('[data-testid="geo-static-map"]')) !== null)

console.log('11. Cart is emptied after order')
await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.empty', { timeout: 15000 })
check('cart shows empty state', (await text()).includes('Your cart is empty'))

console.log('12. Search and category navigation')
await page.goto(`${BASE}/search?q=daal`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.p-card', { timeout: 15000 })
check('search returns results', (await text()).includes('Results for "daal"'))

await page.goto(`${BASE}/category/oil-ghee`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.p-card', { timeout: 15000 })
const catHeading = await page.$eval('.list-title', (el) => el.innerText)
const catCount = Number((catHeading.match(/\((\d+)/) || [])[1])
check('category page filtered to 7 oil products', catCount === 7, `-> "${catHeading}"`)

console.log('13. Sorting and filtering')
await page.select('.sort-select', 'price_low')
await page.waitForFunction(() => !document.body.innerText.includes('skeleton'), { timeout: 10000 })
const prices = await page.$$eval('.p-price strong', (els) =>
  els.map((e) => Number(e.innerText.replace(/[^\d]/g, ''))),
)
check('sorted by price ascending', prices.every((p, i) => i === 0 || prices[i - 1] <= p),
  `[${prices.slice(0, 5).join(', ')}]`)

await page.goto(`${BASE}/products?max_price=100`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.p-card', { timeout: 15000 })
const cheap = await page.$$eval('.p-price strong', (els) =>
  els.map((e) => Number(e.innerText.replace(/[^\d]/g, ''))),
)
check('price filter applied', cheap.every((p) => p <= 100), `[${cheap.join(', ')}]`)

console.log('14. No console errors during the flow')
console.log('   collected errors:', JSON.stringify(consoleErrors, null, 2))
const realErrors = consoleErrors.filter((e) => !/favicon/i.test(e))
check('zero console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)