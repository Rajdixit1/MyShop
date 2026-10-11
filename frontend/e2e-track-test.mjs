/**
 * E2E for search suggestions, order tracking and WhatsApp links.
 * Run:  npm run test:track-e2e
 */
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function clickText(selector, label) {
  const handle = await page.evaluateHandle(
    (sel, lbl) => [...document.querySelectorAll(sel)].find((el) => el.innerText.trim().includes(lbl)),
    selector, label,
  )
  const el = handle.asElement()
  if (!el) throw new Error(`No ${selector} containing "${label}"`)
  await el.click()
}

const suggestRows = () => page.$$eval('.suggest-row', (els) => els.map((e) => e.innerText))
const typeSearch = async (term) => {
  await page.click('#search-input', { clickCount: 3 })
  await page.keyboard.press('Backspace')
  await page.type('#search-input', term, { delay: 45 })
}

console.log('1. Search suggestions appear while typing')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await page.waitForSelector('#search-input')
await typeSearch('rice')
await page.waitForSelector('.suggest-row', { timeout: 10000 })
const rows = await suggestRows()
check('suggestions dropdown opens', rows.length > 0, `-> ${rows.length} rows`)
check('product suggestions listed', rows.some((r) => r.includes('Rice')), `-> ${rows[0]}`)
check('price shown in suggestion', rows[0].includes('₹'))
check('category suggestion shown', rows.some((r) => r.includes('Atta, Rice & Daal')))

console.log('2. Keyboard navigation and Enter')
await page.keyboard.press('ArrowDown')
await sleep(150)
const activeCount = await page.$$eval('.suggest-row.active', (e) => e.length)
check('arrow key highlights a row', activeCount === 1)
await page.keyboard.press('Enter')
await page.waitForFunction(() => location.pathname.startsWith('/product/'), { timeout: 10000 })
check('enter opens the suggested product', true, `-> ${page.url().split('/').pop()}`)

console.log('3. Suggestion click navigates to a product')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await page.waitForSelector('#search-input')

console.log('5. Customer logs in and places an order')
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.login-box')
await clickText('.tab', 'Register')
await page.waitForSelector('#reg-name')
await page.type('#reg-name', 'Track Customer')
await page.type('#reg-phone', PHONE)
await page.type('#reg-pass', 'secret123')
await clickText('.btn-primary', 'Create Account')
await page.waitForSelector('.price-box', { timeout: 15000 })

await page.goto(`${BASE}/product/tata-salt-1kg`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.btn-primary')
await clickText('.btn-primary', 'ADD TO CART')
await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.pay-option')
await page.type('#name', 'Track Customer')
await page.type('#phone', PHONE)
await page.type('#address', '12 Test Street, Delhi 110051')
await clickText('.btn-green', 'PLACE ORDER')
await page.waitForSelector('.success-box', { timeout: 20000 })
const orderNo = await page.$eval('.order-no', (el) => el.innerText.replace(/\D/g, ''))
check('order placed', Boolean(orderNo), `-> RD${orderNo}`)

console.log('6. Order success page has track + WhatsApp')
check('track button present', (await page.$$('[data-testid=track-order-btn]')).length === 1)
const waHref = await page.$eval('[data-testid=whatsapp-success]', (el) => el.href)
check('whatsapp link points at wa.me', waHref.startsWith('https://wa.me/91'), `-> ${waHref.slice(0, 34)}`)
check('whatsapp message has the order number', decodeURIComponent(waHref).includes(`RD${orderNo}`))
check('whatsapp targets the customer number', waHref.includes(PHONE), `-> +91${PHONE}`)

console.log('7. Track order page')
await page.click('[data-testid=track-order-btn]')
await page.waitForFunction(() => location.pathname.startsWith('/track/'), { timeout: 10000 })
await page.waitForSelector('.timeline-item', { timeout: 15000 })
const trackText = await text()
check('tracking page renders', trackText.includes('Delivery progress'))
check('all five stages listed',
  ['Order Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered']
    .every((s) => trackText.includes(s)))
check('activity timeline shown', trackText.includes('Activity'))
check('activity has the confirmation entry', trackText.includes('Order confirmed'))
check('eta displayed', trackText.includes('Expected delivery'))
check('whatsapp button on track page', (await page.$$('[data-testid=whatsapp-order]')).length === 1)

console.log('8. Customer adds a request to their order')
const beforeCount = (await page.$$('.timeline-item')).length
await page.type('input[placeholder*="Please call"]', 'Please call before delivery')
await page.type('textarea[placeholder*="Extra details"]', 'Gate code 1234')
await page.evaluate(() => {
  [...document.querySelectorAll('.btn-blue')]
    .find((b) => b.innerText.includes('ADD REQUEST')).click()
})
await page.waitForFunction(
  (n) => document.querySelectorAll('.timeline-item').length === n + 1,
  { timeout: 15000 },
  beforeCount,
)
check('request added to timeline', true, `-> ${beforeCount} -> ${beforeCount + 1}`)
check('request text visible', (await text()).includes('Please call before delivery'))

console.log('9. Admin advances the order and the timeline grows')
await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle2' })
await page.waitForSelector('#adm-user')
await clickText('.btn-primary', 'Login to Dashboard')
await page.waitForSelector('.stat-card', { timeout: 15000 })
await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle2' })
await page.waitForSelector('table.data')

const targetIndex = await page.$$eval(
  'table.data tbody tr td:first-child',
  (els, needle) => els.findIndex((e) => e.innerText.includes(needle)),
  `RD${orderNo}`,
)
check('admin sees the new order', targetIndex >= 0, `-> row ${targetIndex}`)

await page.select(
  `table.data tbody tr:nth-child(${targetIndex + 1}) select`, 'Shipped')
await page.waitForFunction(() => document.body.innerText.includes('Shipped'), { timeout: 15000 })
check('admin changed status to Shipped', true)

console.log('10. Admin logs a warehouse update')
await page.$$eval(
  'table.data tbody tr',
  (els, i) => els[i].querySelector('.btn-sm.blue').click(),
  targetIndex,
)
await page.waitForSelector('.timeline-item')
await clickText('.btn-sm.grey', 'Called customer')
await clickText('.btn-sm.green', 'LOG UPDATE')
await page.waitForFunction(
  () => document.querySelector('.admin-modal').innerText.includes('Confirmed the delivery slot'),
  { timeout: 15000 },
)
check('admin update logged in timeline', true)

console.log('11. Search insights visible to the store')
check('search insights panel shown', (await text()).includes('searching for'))
const insight = await page.$$eval('.badge.blue', (els) => els.map((e) => e.innerText))
check('recorded searches listed', insight.some((t) => t.includes('rice')), `-> ${insight.slice(0, 4)}`)

console.log('12. Customer sees the admin update on the tracking page')
await page.goto(`${BASE}/track/RD${orderNo}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.timeline-item')
const after = await text()
check('shipped stage marked done', after.includes('Shipped'))
check('admin update visible to customer', after.includes('Confirmed the delivery slot'))
// .timeline-source is uppercased by CSS, so compare case-insensitively
check('store team label shown', after.toLowerCase().includes('store team'))
check('customer request still there', after.includes('Gate code 1234'))

console.log('13. Floating WhatsApp button on store pages')
await page.goto(`${BASE}/products`, { waitUntil: 'networkidle2' })
await page.waitForSelector('[data-testid=whatsapp-float]', { timeout: 10000 })
const floatHref = await page.$eval('[data-testid=whatsapp-float]', (el) => el.href)
check('floating button links to wa.me', floatHref.startsWith('https://wa.me/91'))
check('support greeting pre-filled', decodeURIComponent(floatHref).includes('need help'))

console.log('14. Unknown order shows a friendly error')
await page.goto(`${BASE}/track/RD000000`, { waitUntil: 'networkidle2' })
await page.waitForFunction(() => document.body.innerText.includes('could not find'), { timeout: 10000 })
check('missing order handled gracefully', true)

check('zero server/page errors', errors.length === 0, errors.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
await page.type('textarea[placeholder*="Extra details"]', 'Gate code 1234')
await clickText('.btn-blue', 'ADD REQUEST')
await page.waitForFunction(
  (n) => document.querySelectorAll('.timeline-item').length === n + 1,
  { timeout: 15000 },
  beforeCount,
)
check('request added to timeline', true, `-> ${beforeCount} -> ${beforeCount + 1}`)
check('request text visible', (await text()).includes('Please call before delivery'))

await typeSearch('salt')
await page.waitForSelector('.suggest-row')
await clickText('.suggest-row', 'Salt')
await page.waitForFunction(() => location.pathname.startsWith('/product/'), { timeout: 10000 })
check('clicking a suggestion opens the product', true)

console.log('4. No-match and empty states')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await typeSearch('zzzznotathing')
await page.waitForSelector('.suggest-empty', { timeout: 10000 })
check('no-match message shown', (await text()).includes('No matches'))
await page.click('.logo')
await sleep(700)
check('dropdown closes on navigation', (await page.$$('.suggest-box')).length === 0)