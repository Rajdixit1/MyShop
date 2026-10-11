/** Screenshots for search suggestions, tracking and WhatsApp. */
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:5173'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1000 })

async function clickText(selector, label) {
  const handle = await page.evaluateHandle(
    (sel, lbl) => [...document.querySelectorAll(sel)].find((el) => el.innerText.trim().includes(lbl)),
    selector, label,
  )
  const el = handle.asElement()
  if (!el) throw new Error(`No ${selector} containing "${label}"`)
  await el.click()
}

// hide the install banner so it does not sit over the dropdown in the shot
await page.evaluateOnNewDocument(() => {
  sessionStorage.setItem('rashan-install-dismissed', '1')
})

// 1. search suggestions dropdown
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await page.waitForSelector('#search-input')
await page.click('#search-input')
await page.type('#search-input', 'rice', { delay: 60 })
await page.waitForSelector('.suggest-row', { timeout: 10000 })
// confirm the dropdown is still open right before capturing
console.log('rows before shot:', (await page.$$('.suggest-row')).length)
await new Promise((r) => setTimeout(r, 300))
console.log('rows at shot time:', (await page.$$('.suggest-row')).length)
await page.screenshot({ path: 'shot_suggestions.png' })
console.log('suggestions saved')

// 2. an order to track (login is compulsory, so register and use the token)
const order = await page.evaluate(async () => {
  const phone = `9${String(Math.floor(100000000 + Math.random() * 899999999))}`
  const reg = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sunil Kumar', phone, password: 'secret123' }),
  })
  const { token } = await reg.json()
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      customer_name: 'Sunil Kumar',
      phone,
      address: 'Flat 402, Green Park, New Delhi 110016',
      lat: 28.5665,
      lng: 77.219,
      items: [{ slug: 'tata-salt-1kg', qty: 2 }, { slug: 'aashirvaad-atta-5kg', qty: 1 }],
    }),
  })
  return res.json()
})
const no = order.order_no

// move it along so the timeline has content
const adm = await page.evaluate(async (orderNo) => {
  const login = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const { token } = await login.json()
  for (const status of ['Packed', 'Shipped', 'Out for Delivery']) {
    await fetch(`/api/admin/orders/${orderNo}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
  }
  return token
}, no)

await page.evaluate(async (orderNo, token) => {
  await fetch(`/api/admin/orders/${orderNo}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: 'Called customer',
      note: 'Confirmed the delivery slot between 6 PM and 8 PM.',
    }),
  })
}, no, adm)

// 3. tracking page
await page.goto(`${BASE}/track/${no}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.timeline-item', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: 'shot_track_order.png', fullPage: true })
console.log('tracking saved')

// 4. admin order detail with the activity timeline
await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle2' })
await page.waitForSelector('#adm-user')
await page.click('.btn-primary')
await page.waitForSelector('.stat-card', { timeout: 15000 })
await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle2' })
await page.waitForSelector('table.data')
await page.click('table.data tbody tr .btn-sm.blue')
await page.waitForSelector('.timeline-item')
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: 'shot_admin_activity.png' })
console.log('admin activity saved')

// 5. the customer note form, which only renders for a logged-in customer
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.login-box')
await clickText('.tab', 'Register')
await page.waitForSelector('#reg-name')
// a random number so re-running the script never hits "already registered"
await page.type('#reg-name', 'Sunil Kumar')
await page.type('#reg-phone', `9${String(Math.floor(100000000 + Math.random() * 899999999))}`)
await page.type('#reg-pass', 'secret123')
await clickText('.btn-primary', 'Create Account')
await page.waitForSelector('.price-box', { timeout: 15000 })

await page.goto(`${BASE}/track/${no}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('input[placeholder*="Please call"]', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: 'shot_track_note.png', fullPage: true })
console.log('customer note form saved')

// checkout with the interactive map pin picker

// seed the cart first, then land on checkout
const firstSlug = await page.evaluate(async () => {
  const res = await fetch('/api/products?page_size=1')
  const data = await res.json()
  const slug = data.items[0].slug
  localStorage.setItem('rashan-dukaan-cart-v1', JSON.stringify([{ slug, qty: 1 }]))
  return slug
})

// the script is already signed in from the registration above, so go straight
// to checkout - no need to sign out, which would drop the session
await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle2' })
await page.waitForSelector('[data-testid="geo-map"]', { timeout: 20000 })
await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle2' })
await page.waitForSelector('[data-testid="geo-map"]', { timeout: 20000 })
// drop a pin by dragging the map, as a shopper would
const geoBox = await page.$eval('[data-testid="geo-map"]', (el) => {
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
await page.mouse.move(geoBox.x, geoBox.y)
await page.mouse.down()
await page.mouse.move(geoBox.x + 80, geoBox.y + 50, { steps: 10 })
await page.mouse.up()
await page.waitForSelector('[data-testid="geo-coords"]', { timeout: 8000 })
await page.type('#address', 'Block A, Connaught Place, New Delhi 110001')
await new Promise((r) => setTimeout(r, 4000)) // let the map tiles paint
await page.screenshot({ path: 'shot_geo_checkout.png', fullPage: true })

await clickText('[data-testid="save-address-btn"]', 'SAVE THIS ADDRESS')
await page.waitForSelector('[data-testid="saved-address"]', { timeout: 10000 })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: 'shot_geo_saved.png', fullPage: true })
console.log('geo map screenshots written')

await browser.close()
