# Devenand Saw Kirana Store - Grocery E-Commerce Website + Admin Panel + Installable App

Flipkart-style online grocery store (rashan dukan) built with **FastAPI** backend and **React** frontend, with a **customer login**, a full **admin panel**, and **PWA support** so the same codebase runs as a web app, Android, iOS, macOS and Windows app.

![stack](https://img.shields.io/badge/backend-FastAPI-388e3c) ![stack](https://img.shields.io/badge/frontend-React-61dafb) ![stack](https://img.shields.io/badge/database-SQLite-2874f0) ![stack](https://img.shields.io/badge/app-PWA%20%2B%20Capacitor-7c3aed)

## Features

### Storefront
- **Home page** - category strip (12 categories), auto-rotating banner carousel, deal countdown timer, bestsellers grid
- **75 grocery products** across 12 categories: Atta/Rice/Daal, Oil & Ghee, Masala & Spices, Dry Fruits, Sugar & Salt, Biscuits & Snacks, Beverages, Dairy & Frozen, Cleaning, Personal Care, Baby Care, Breakfast
- **Product listing** - search, category filter, brand filter, price range, rating filter, 6 sort options, pagination
- **Search suggestions** - debounced type-ahead dropdown showing matching products (with price, MRP and stock), categories and brands; arrow-key + Enter navigation
- **Product detail** - breadcrumb, highlights, quantity selector, related products, stock warnings
- **Cart** - persistent via localStorage, quantity +/- , remove, clear
- **Server-side pricing** - the browser never decides prices; every cart is re-priced by the API
- **Checkout** - address form with validation, COD/UPI/Card options, order placement with stock deduction
- **Exact location & map pin** - drag the map (or tap **USE MY EXACT LOCATION** for device GPS) to drop a pin, with live latitude/longitude and accuracy in metres
- **Saved addresses** - save an address with its pin, reuse it on the next order in one tap, and the pin is kept on the account so checkout pre-fills itself
- **Address lookup** - an unpinned order is reverse geocoded to a readable street address (OpenStreetMap Nominatim, cached server-side)
- **Map** - built directly on OpenStreetMap raster tiles with plain Web Mercator maths: no map library, no API key, works offline for the pin even when tiles do not load
- **Order success** page with order number, itemised bill, track button and WhatsApp share

### Order tracking (`/track/{order_no}`)
- **Delivery progress** - five stages (Confirmed → Packed → Shipped → Out for Delivery → Delivered) with completed/pending markers
- **Expected delivery** date calculated from when the order was placed
- **Activity timeline** - every logged update with timestamp and who recorded it (System / Store team / You)
- **Customer requests** - logged-in customers can add delivery instructions; other customers get HTTP 403
- **WhatsApp** - click-to-chat link with the order number, status, itemised bill and delivery address pre-filled

### Customer account
- **Register / Login** with mobile number + password (PBKDF2 hashed, HMAC bearer tokens)
- **My Orders** page with live status badges, item breakdown, lifetime spend and a track button per order
- **Login is compulsory to order** - `/checkout` redirects a signed-out shopper to `/login?next=/checkout` and returns them to the checkout form once they sign in or register
- The API enforces it too: `POST /api/orders` returns **401** without a customer token and **403** for an admin token

### WhatsApp
- **Floating help button** on every storefront page (hidden in the admin panel) linking to the support desk
- **Order-specific links** - wa.me deep links pointing at the customer's own number, pre-filled with the full bill
- **Support number** comes from the API, so it can be changed with the `RASHAN_WHATSAPP` env var (10-digit Indian numbers get `91` prepended automatically)
- No WhatsApp Business API needed - these are plain `wa.me` click-to-chat URLs

### Admin panel (`/admin`)
- **Secure admin login** - customer tokens cannot access admin routes (HTTP 403)
- **Dashboard** - revenue, orders, products, customers, low-stock and out-of-stock counters, orders-by-status, best sellers, recent orders
- **Products** - full CRUD: create, edit, delete, search, emoji icon picker, colour picker, bestseller/deal flags (discount % recalculated by the API)
- **Image upload** - upload a real product photo (JPG / PNG / WebP / GIF, up to 3 MB); the admin form previews it before saving, and "Remove image" falls back to the emoji placeholder
- **Orders** - filter by status, update order status, itemised order detail, per-order **activity timeline**
- **Delivery pin** - the exact map location of each order inside the order detail, with an *Open in Maps* link for the rider
- **Warehouse updates** - quick-preset buttons (Called customer / Left for packing / Address issue / Out for pickup) that log straight onto the customer's timeline
- **Search insights** - "what customers are searching for", aggregated with counts and flagged when a search returned zero results
- **Customers** - registered customers with phone and address

### Installable app
- **PWA** - `manifest.webmanifest` + service worker with generated icons (192/512/maskable/apple-touch)
- **Install prompt** banner in the app for Chrome/Edge
- **Capacitor** config included for building real **APK** (Android) and **IPA** (iOS)

## Project structure

```
myshop/
├── backend/
│   ├── requirements.txt
│   ├── test_api.py           # 28 API tests (stdlib only)
│   ├── test_admin_api.py     # 42 auth, admin CRUD and image upload tests
│   ├── test_track_api.py     # 51 tracking, WhatsApp, geo and suggestion tests
│   ├── test_wsgi.py           # 14 WSGI/SPA/deployment tests (no uvicorn)
│   ├── test_admin_password.py # 3 deployment password-override tests
│   ├── wsgi.py                # ASGI to WSGI adapter (PythonAnywhere)
│   ├── pythonanywhere_wsgi.py # WSGI config file for the Web tab
│   ├── setup_pythonanywhere.sh
│   └── app/
│       ├── main.py           # FastAPI app + store, auth and admin routes
│       ├── auth.py           # PBKDF2 password hashing + HMAC tokens
│       ├── db.py             # SQLite schema, migration and helpers
│       ├── schemas.py        # Pydantic models
│       ├── seed_categories.py
│       ├── seed_products.py  # combines all product parts
│       └── seed_products_a..e.py
└── frontend/
    ├── capacitor.config.ts   # native Android / iOS wrapper config
    ├── scripts/make_icons.py # generates the PWA icons
    ├── e2e-test.mjs          # 17 store browser tests (Puppeteer)
    ├── e2e-admin-test.mjs    # 27 auth + admin browser tests
    ├── e2e-track-test.mjs    # 32 suggestion + tracking + WhatsApp browser tests
    ├── public/
    │   ├── manifest.webmanifest
    │   ├── sw.js             # offline-capable service worker
    │   └── icons/
    └── src/
        ├── App.jsx, main.jsx, api.js, styles.css
        ├── context/ (CartContext, AuthContext, AdminContext)
        ├── components/  (Header, SearchBox, WhatsAppButton, Footer, ProductCard, CategoryStrip, BannerCarousel, InstallPrompt)
        └── pages/
            ├── Home, ProductListing, ProductDetail, Cart, Checkout, OrderSuccess
            ├── TrackOrder, LoginPage, MyOrders
            └── admin/ (AdminLogin, AdminLayout, AdminDashboard, AdminProducts, ProductModal, AdminOrders, AdminCustomers)
```

## Getting started

### 1. Backend (port 8000)

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The SQLite database (`backend/grocery.db`) is created and seeded automatically on first start.
Interactive API docs: http://127.0.0.1:8000/docs

### 2. Frontend (port 5173)

```powershell
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173

> The Vite dev server proxies `/api` calls to the backend, so run the backend first.

### Logins

| Panel | URL | Credentials |
| --- | --- | --- |
| Customer | `/login` | register with any 10 digit mobile number |
| Admin | `/admin` | `admin` / `admin123` (change before deploying - see below) |

## Deploying to PythonAnywhere (free plan)

The free plan runs **WSGI only**, so the ASGI app is adapted with `a2wsgi`. The
whole site (API + frontend) is served from a single web app, which keeps `/api`
relative and means no CORS configuration at all.

**1. Upload the project.** Easiest is GitHub:

```bash
cd ~
bash <(curl -sL https://raw.githubusercontent.com/YOUR_USER/myshop/main/backend/setup_pythonanywhere.sh)
```

or manually, `git clone` into `/home/hellkum12kumar09/my_site/`, then:

```bash
mkvirtualenv --overwrite rashan
pip install -r ~/my_site/myshop/backend/requirements.txt
mkdir -p ~/my_site/myshop/backend/uploads
```

**2. Build the frontend.** Node is not installed on the free plan, so build
locally and upload `frontend/dist/` through the **Files** tab, preserving the
folder layout:

```powershell
cd frontend
npm run build
```

**3. Configure the Web tab** - *Web* → *Add a new web app* → *Manual configuration*:

| Field | Value |
| --- | --- |
| Source code | `/home/hellkum12kumar09/my_site/myshop/backend/pythonanywhere_wsgi.py` |
| Working directory | `/home/hellkum12kumar09/my_site/myshop/backend` |
| Virtualenv | `/home/hellkum12kumar09/.virtualenvs/rashan` |

Then press the green **Reload**. The site appears at
`https://hellkum12kumar09.pythonanywhere.com`.

**4. Set environment variables** - *Web* tab → *Environment variables*:

| Variable | Why |
| --- | --- |
| `RASHAN_SECRET` | long random string; signs the login tokens |
| `RASHAN_ADMIN_PASSWORD` | replaces the `admin123` demo password |
| `RASHAN_WHATSAPP` | support number with country code, e.g. `919999999999` |
| `RASHAN_DB_PATH` | optional; defaults to `backend/grocery.db` |
| `RASHAN_DATA_DIR` | optional; defaults to `backend/uploads` |

Generate a secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

Changing `RASHAN_ADMIN_PASSWORD` re-hashes the stored password on the next
reload, so `admin123` stops working immediately.

Run `python test_wsgi.py` locally before deploying - it exercises the WSGI path,
the SPA routes and the upload handler without needing a browser.

## Using it as an app

The same build installs as a real app on **Android, iOS, macOS and Windows** (and Linux), because it is a Progressive Web App with an app manifest, generated icons and a service worker.

### Option A - install as a PWA (no extra tools needed)

```powershell
cd frontend
npm run build
npm run preview        # serve the production build
```

1. Open the served URL in Chrome / Edge and click the **Install app** banner
   (or the install icon in the address bar).
2. **Android Chrome**: menu ⋮ → *Install app* → the app gets a home-screen icon.
3. **iPhone Safari**: Share → *Add to Home Screen*.
4. **macOS / Windows Chrome or Edge**: install icon in the address bar.
5. **Desktop install requires HTTPS or localhost** - that is why you test on `localhost`.

Regenerate icons at any time with:

```powershell
cd frontend
npm run icons
```

### Option B - build a native APK / IPA with Capacitor

```powershell
cd frontend
npm run cap:sync        # build the web app and copy it into the native projects

npm run cap:android     # opens Android Studio (Build > Generate Signed Bundle / APK)
npm run cap:ios         # opens Xcode (Product > Run / Archive to App Store)
npm run cap:apk         # headless debug APK -> frontend/android/app/build/outputs/apk/debug/
```

**Prerequisites:** Android Studio with the Android SDK for the APK, and a Mac with Xcode for the IPA. The project ID is `com.rashandukaan.app`.

> While developing on a device, point the native app at your machine by uncommenting
> `server.url` in `capacitor.config.ts` and using your PC's LAN IP instead of `127.0.0.1`.

## Tests

```powershell
# Backend: 26 tests covering search, filters, sorting, paging, cart maths, orders
cd backend
python test_api.py

# Backend: 27 tests covering registration, login, tokens, admin CRUD and orders
python test_admin_api.py

# Backend: 35 tests covering tracking, WhatsApp links, timelines and suggestions
python test_track_api.py

# Frontend: 17 tests driving a real Chrome instance through the full shopping flow
cd frontend
npm run test:e2e

# Frontend: 27 tests covering registration, checkout, admin panel CRUD and PWA assets
npm run test:admin-e2e

# Frontend: 32 tests covering search suggestions, order tracking and WhatsApp
npm run test:track-e2e
```

Both servers must be running before executing the tests.

## API reference

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/health` | Health check |
| GET | `/api/categories` | Categories with product counts |
| GET | `/api/products` | List with `q`, `category`, `brands`, `min_price`, `max_price`, `min_rating`, `sort`, `page`, `page_size` |
| GET | `/api/products/{slug}` | Product detail |
| GET | `/api/products/{slug}/related` | Related products in the same category |
| GET | `/api/deals` | Products flagged as deals |
| GET | `/api/bestsellers` | Popular products |
| GET | `/api/brands` | Distinct brands for filters |
| GET | `/api/price-range` | Min/max price |
| POST | `/api/cart/validate` | Server-authoritative cart pricing |
| POST | `/api/orders` | Place an order (deducts stock, links to user when logged in) |
| GET | `/api/orders/{order_no}` | Fetch an order |
| GET | `/api/orders/{order_no}/track` | Order + activity timeline + ETA + WhatsApp link |
| POST | `/api/orders/{order_no}/events` | Customer adds a request to their own order timeline |
| GET | `/api/products/suggest` | Type-ahead suggestions for `q` (products, categories, brands) |
| GET | `/api/support/whatsapp` | Click-to-chat link to the support desk |
| POST | `/api/auth/register` | Create a customer account, returns a token |
| POST | `/api/auth/login` | Customer login |
| GET | `/api/auth/me` | Current customer profile |
| GET | `/api/orders/mine` | Orders of the logged-in customer |
| POST | `/api/admin/login` | Admin login (role `admin`) |
| POST | `/api/admin/upload` | Upload a product photo (multipart), returns its `/uploads/...` URL |
| GET | `/api/admin/stats` | Dashboard metrics, status counts, top products |
| GET | `/api/admin/products` | All products including out-of-stock |
| POST | `/api/admin/products` | Create a product |
| PUT | `/api/admin/products/{slug}` | Update a product |
| DELETE | `/api/admin/products/{slug}` | Delete a product |
| GET | `/api/admin/orders` | All orders, optional `status` filter |
| PATCH | `/api/admin/orders/{order_no}` | Update order status (also appends to the timeline) |
| GET | `/api/admin/orders/{order_no}/events` | Order activity timeline, newest first |
| POST | `/api/admin/orders/{order_no}/events` | Log a warehouse update against an order |
| GET | `/api/admin/searches` | What customers are searching for, with counts |
| GET | `/api/admin/customers` | Registered customers |

All `/api/admin/*` routes require `Authorization: Bearer <admin token>`.
`/api/auth/me`, `/api/orders/mine` and `POST /api/orders/{order_no}/events` require a customer token.

## Pricing rules

- Free delivery on orders above ₹499, otherwise ₹29
- ₹5 handling fee on non-empty carts
- 5% GST added on the subtotal
- Cart quantities are clamped to available stock and mismatches are returned in `issues`

## Notes

- Product images are uploaded through the admin panel to `backend/uploads/` and served from `/uploads`; products without a photo fall back to the emoji placeholder on a coloured background, so no external image hosting is needed.
- Payments are simulated; only COD behaves like a real flow.
- Passwords are stored as PBKDF2-SHA256 hashes (120k iterations) and tokens are HMAC-SHA256 signed with a 7 day expiry. Set the `RASHAN_SECRET` environment variable in production.
- The demo admin account (`admin` / `admin123`) is created automatically on first start; change it before deploying anywhere public.
- WhatsApp uses plain `wa.me` click-to-chat links, so nothing is sent until the user taps send. Set `RASHAN_WHATSAPP` to the support number (country code included, e.g. `919999999999`); 10-digit Indian numbers get `91` prepended automatically.
- Search terms are recorded in a `search_log` table to power the admin search-insights panel. Clear or rotate that table if you consider search history sensitive.
- The backend runs single-process (SQLite, in-process seeding). For production you would move to PostgreSQL and add a real payment gateway.
#   M y S h o p  
 