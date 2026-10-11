"""Devanand Saw Kirana Store API - a Flipkart-style grocery store backend."""

import json
import os
import random
import re
import urllib.request
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from .auth import create_token, decode_token, hash_password, verify_password
from .db import DATA_DIR, get_db, init_db
from .schemas import (
    Address,
    AddressIn,
    AdminLoginRequest,
    AdminStats,
    CartLine,
    CartSummary,
    CartValidateRequest,
    Category,
    EventCreate,
    LoginRequest,
    Order,
    OrderCreate,
    OrderEvent,
    OrderItem,
    OrderStatusUpdate,
    Product,
    ProductCreate,
    ProductPage,
    ProductUpdate,
    RegisterRequest,
    Suggestion,
    SuggestResponse,
    TokenResponse,
    TrackOrder,
    UserOut,
)
from .seed_categories import CATEGORIES
from .seed_products import PRODUCTS

DELIVERY_FEE = 29.0
HANDLING_FEE = 5.0
FREE_DELIVERY_ABOVE = 499.0
TAX_RATE = 0.05

# Nominatim's usage policy requires an identifying User-Agent on every request.
RASHAN_UA = os.environ.get("RASHAN_UA", "RashanDukaan/1.0 (local demo grocery store)")
# lat/lng -> address, kept so repeated pins do not hit the public rate limit.
_GEOCODE_CACHE: dict[tuple[float, float], dict] = {}

# Uploaded product photos are stored in the database (so they survive hosts
# without a persistent disk) and served from /uploads. Files already sitting in
# UPLOAD_DIR from older versions are still served from disk.
UPLOAD_DIR = DATA_DIR
MAX_UPLOAD_BYTES = 3 * 1024 * 1024  # 3 MB - plenty for a product photo
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

app = FastAPI(title="Devanand Saw Kirana Store API", version="1.0.0", description="Grocery store backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(UPLOAD_DIR, exist_ok=True)


DEFAULT_ADMIN = {"username": "admin", "password": "admin123"}

# Support desk number used to build wa.me links. Override with RASHAN_WHATSAPP.
SUPPORT_WHATSAPP = os.environ.get("RASHAN_WHATSAPP", "919999999999")

# Every status a delivery moves through, in order. Used for tracking timelines
# and to estimate the delivery date.
STATUS_FLOW = ["Order Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered"]

STATUS_META = {
    "Order Confirmed": {"title": "Order confirmed", "emoji": "✅",
                        "note": "We have received your order and payment preference."},
    "Packed": {"title": "Packed at the store", "emoji": "📦",
               "note": "Your items are packed and ready for pickup by the delivery partner."},
    "Shipped": {"title": "Shipped", "emoji": "🚚",
                "note": "Your parcel has left the warehouse and is on the move."},
    "Out for Delivery": {"title": "Out for delivery", "emoji": "🛵",
                         "note": "The delivery agent is on the way to your address."},
    "Delivered": {"title": "Delivered", "emoji": "🎉",
                  "note": "Your order was delivered. Thank you for shopping with us!"},
    "Cancelled": {"title": "Order cancelled", "emoji": "❌",
                  "note": "This order was cancelled."},
}


def log_event(conn, order_no: str, status: str, title: str, note: str = "",
              source: str = "system") -> None:
    """Appends one entry to the order's tracking timeline."""
    conn.execute(
        """INSERT INTO order_events (order_no, status, title, note, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (order_no, status, title, note, source, datetime.now().isoformat(timespec="seconds")),
    )


def _clean_phone(phone: str) -> str:
    """Strips everything but digits so the number works in a wa.me link."""
    return "".join(ch for ch in (phone or "") if ch.isdigit())


def whatsapp_link(phone: str, message: str) -> str:
    """Builds a click-to-chat WhatsApp URL (no WhatsApp Business API needed)."""
    from urllib.parse import quote

    number = _clean_phone(phone) or SUPPORT_WHATSAPP
    if len(number) == 10:  # Indian mobile entered without the country code
        number = f"91{number}"
    return f"https://wa.me/{number}?text={quote(message)}"


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    seed_if_empty()


DEFAULT_ADMIN = {"username": "admin", "password": "admin123"}

# On a public deployment set RASHAN_ADMIN_PASSWORD (and optionally
# RASHAN_ADMIN_USER) so the demo credentials are never the real ones. Changing it
# here resets the stored password on the next reload, which is the quickest way
# to lock the admin account out of anyone who has read the README.
ADMIN_USER = os.environ.get("RASHAN_ADMIN_USER") or DEFAULT_ADMIN["username"]
ADMIN_PASSWORD = os.environ.get("RASHAN_ADMIN_PASSWORD") or DEFAULT_ADMIN["password"]


def ensure_admin(conn) -> None:
    """Creates the admin account, or re-hashes the password if the env changed."""
    row = conn.execute("SELECT * FROM admins WHERE username = ?", (ADMIN_USER,)).fetchone()
    if row is not None:
        # only touch the stored hash when an override was actually configured
        if os.environ.get("RASHAN_ADMIN_PASSWORD") and not verify_password(
            ADMIN_PASSWORD, row["password"]
        ):
            conn.execute(
                "UPDATE admins SET password = ? WHERE username = ?",
                (hash_password(ADMIN_PASSWORD), ADMIN_USER),
            )
        return
    conn.execute(
        "INSERT INTO admins (username, password) VALUES (?, ?)",
        (ADMIN_USER, hash_password(ADMIN_PASSWORD)),
    )


def seed_if_empty() -> None:
    with get_db() as db:
        ensure_admin(db)
        count = db.execute("SELECT COUNT(*) AS c FROM categories").fetchone()["c"]
        if count:
            return
        db.executemany(
            "INSERT INTO categories (slug, name, icon, tagline) VALUES (?, ?, ?, ?)", CATEGORIES
        )
        cat_ids = {r["slug"]: r["id"] for r in db.execute("SELECT id, slug FROM categories")}
        rows = [
            (
                d["slug"], d["name"], d["brand"], cat_ids[d["category"]], d["price"], d["mrp"],
                d["unit"], d["rating"], d["rating_count"], d["reviews"], d["stock"],
                d["emoji"], d["color"], d["description"], json.dumps(d["highlights"]),
                1 if d["bestseller"] else 0, 1 if d["deal"] else 0,
            )
            for d in PRODUCTS
        ]
        db.executemany(
            """INSERT INTO products
               (slug, name, brand, category_id, price, mrp, unit, rating, rating_count, reviews,
                stock, emoji, color, description, highlights, bestseller, deal)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            rows,
        )


BASE_SELECT = """
    SELECT p.*, c.slug AS category_slug, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id
"""


def fetch_by_slug(conn, slug: str):
    return conn.execute(BASE_SELECT + " WHERE p.slug = ?", (slug,)).fetchone()


def row_to_product(row) -> Product:
    mrp = float(row["mrp"])
    price = float(row["price"])
    savings = round(mrp - price, 2)
    discount = int(round((savings / mrp) * 100)) if mrp else 0
    return Product(
        id=row["id"], slug=row["slug"], name=row["name"], brand=row["brand"],
        category=row["category_slug"], category_name=row["category_name"],
        price=price, mrp=mrp, discount_percent=discount, savings=savings, unit=row["unit"],
        rating=float(row["rating"]), rating_count=row["rating_count"], reviews=row["reviews"],
        stock=row["stock"], in_stock=row["stock"] > 0, emoji=row["emoji"], color=row["color"],
        image_url=row["image_url"] if "image_url" in row.keys() else "",
        description=row["description"], highlights=json.loads(row["highlights"]),
        bestseller=bool(row["bestseller"]), deal=bool(row["deal"]),
    )


def build_cart(items) -> CartSummary:
    """Server-side price calculation - the client never decides the price."""
    with get_db() as db:
        lines = []
        issues = []
        subtotal = 0.0
        mrp_total = 0.0
        item_count = 0

        for item in items:
            row = fetch_by_slug(db, item.slug)
            if row is None:
                issues.append(f"{item.slug} is no longer available")
                continue
            product = row_to_product(row)
            qty = item.qty
            if qty > product.stock:
                issues.append(f"{product.name}: only {product.stock} left in stock")
                qty = product.stock
            if qty <= 0:
                issues.append(f"{product.name} is out of stock")
                continue
            lines.append(CartLine(product=product, qty=qty, line_total=round(product.price * qty, 2)))
            subtotal += product.price * qty
            mrp_total += product.mrp * qty
            item_count += qty

        subtotal = round(subtotal, 2)
        mrp_total = round(mrp_total, 2)
        savings = round(mrp_total - subtotal, 2)
        delivery = 0.0 if (subtotal >= FREE_DELIVERY_ABOVE or subtotal == 0) else DELIVERY_FEE
        handling = HANDLING_FEE if subtotal > 0 else 0.0
        tax = round(subtotal * TAX_RATE, 2)
        total = round(subtotal + delivery + handling + tax, 2)

    return CartSummary(
        items=lines, item_count=item_count, mrp_total=mrp_total, subtotal=subtotal,
        total_savings=savings, delivery_fee=delivery, handling_fee=handling,
        order_total=total, free_delivery_threshold=FREE_DELIVERY_ABOVE, issues=issues,
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "rashan-dukaan-api", "version": "2.0.0"}


# ---------------------------------------------------------------- auth deps
def _bearer(authorization: Optional[str]) -> Optional[tuple[int, str]]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return decode_token(authorization.split(" ", 1)[1].strip())


def current_user(authorization: Optional[str] = Header(None)) -> tuple[int, str]:
    data = _bearer(authorization)
    if data is None:
        raise HTTPException(status_code=401, detail="Please login to continue")
    user_id, role = data
    if role != "user":
        raise HTTPException(status_code=403, detail="Customer access only")
    return data


def current_admin(authorization: Optional[str] = Header(None)) -> int:
    data = _bearer(authorization)
    if data is None:
        raise HTTPException(status_code=401, detail="Admin login required")
    user_id, role = data
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")
    return user_id


def user_to_out(row) -> UserOut:
    keys = row.keys()
    return UserOut(id=row["id"], name=row["name"], phone=row["phone"],
                   address=row["address"] or "", created_at=row["created_at"],
                   lat=row["lat"] if "lat" in keys else None,
                   lng=row["lng"] if "lng" in keys else None)


# ---------------------------------------------------------------- client auth
@app.post("/api/auth/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest):
    if not re.fullmatch(r"[6-9]\d{9}", payload.phone):
        raise HTTPException(status_code=400, detail="Enter a valid 10 digit Indian mobile number")
    with get_db() as db:
        if db.execute("SELECT 1 FROM users WHERE phone = ?", (payload.phone,)).fetchone():
            raise HTTPException(status_code=409, detail="This mobile number is already registered")
        db.execute(
            "INSERT INTO users (name, phone, password, address, created_at) VALUES (?, ?, ?, ?, ?)",
            (payload.name.strip(), payload.phone, hash_password(payload.password),
             payload.address, datetime.now().isoformat(timespec="seconds")),
        )
        row = db.execute("SELECT * FROM users WHERE phone = ?", (payload.phone,)).fetchone()
    return TokenResponse(token=create_token(row["id"], "user"), role="user", user=user_to_out(row))


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    with get_db() as db:
        row = db.execute("SELECT * FROM users WHERE phone = ?", (payload.phone,)).fetchone()
        if row is None or not verify_password(payload.password, row["password"]):
            raise HTTPException(status_code=401, detail="Invalid mobile number or password")
    return TokenResponse(token=create_token(row["id"], "user"), role="user", user=user_to_out(row))


@app.get("/api/auth/me", response_model=UserOut)
def me(data: tuple[int, str] = Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM users WHERE id = ?", (data[0],)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_out(row)


@app.get("/api/orders/mine", response_model=list[Order])
def my_orders(data: tuple[int, str] = Depends(current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", (data[0],)
        ).fetchall()
    return [_row_to_order(r) for r in rows]


@app.get("/api/geo/reverse")
def reverse_geocode(lat: float = Query(..., ge=-90, le=90),
                   lng: float = Query(..., ge=-180, le=180)):
    """Turns an exact pin into a readable address using OpenStreetMap Nominatim.

    Results are cached in-process because Nominatim asks for <= 1 request/second.
    """
    key = (round(lat, 5), round(lng, 5))
    if key in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[key]

    url = ("https://nominatim.openstreetmap.org/reverse"
           f"?lat={lat}&lon={lng}&format=jsonv2&zoom=18&addressdetails=1")
    req = urllib.request.Request(url, headers={"User-Agent": RASHAN_UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        # Offline or rate limited - the pin itself is still usable
        return {"lat": lat, "lng": lng, "address": "", "source": "unavailable"}

    parts = data.get("address") or {}
    name = parts.get("house_number") and f"{parts['house_number']} " or ""
    name += parts.get("road") or parts.get("suburb") or parts.get("village") or ""
    city = parts.get("city") or parts.get("town") or parts.get("village") or parts.get("county") or ""
    state = parts.get("state") or ""
    pincode = parts.get("postcode") or ""
    display = data.get("display_name") or ", ".join(
        p for p in (name.strip(), city, state, pincode) if p
    )
    out = {
        "lat": lat, "lng": lng, "address": display,
        "city": city, "state": state, "pincode": pincode, "source": "nominatim",
    }
    _GEOCODE_CACHE[key] = out
    return out


# ------------------------------------------------------- saved geo addresses
def _row_to_address(row) -> Address:
    return Address(
        id=row["id"], label=row["label"], address=row["address"],
        lat=row["lat"], lng=row["lng"], is_default=bool(row["is_default"]),
        created_at=row["created_at"],
    )


@app.get("/api/auth/addresses", response_model=list[Address])
def list_addresses(data: tuple[int, str] = Depends(current_user)):
    """Saved delivery locations for the signed-in customer."""
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC",
            (data[0],),
        ).fetchall()
    return [_row_to_address(r) for r in rows]


@app.post("/api/auth/addresses", response_model=Address, status_code=201)
def save_address(payload: AddressIn, data: tuple[int, str] = Depends(current_user)):
    """Stores a delivery address with its exact map pin for reuse at checkout."""
    if payload.lat is None or payload.lng is None:
        raise HTTPException(status_code=400, detail="Drop a pin on the map to save the address")
    with get_db() as db:
        first = db.execute("SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?",
                           (data[0],)).fetchone()["n"] == 0
        is_default = 1 if (payload.make_default or first) else 0
        if is_default:
            db.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", (data[0],))
        db.execute(
            """INSERT INTO addresses (user_id, label, address, lat, lng, is_default, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (data[0], payload.label.strip() or "Home", payload.address.strip(),
             payload.lat, payload.lng, is_default, datetime.now().isoformat(timespec="seconds")),
        )
        row = db.execute("SELECT * FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                         (data[0],)).fetchone()
        db.execute("UPDATE users SET address = ?, lat = ?, lng = ? WHERE id = ?",
                   (payload.address.strip(), payload.lat, payload.lng, data[0]))
    return _row_to_address(row)


@app.delete("/api/auth/addresses/{address_id}", status_code=204)
def delete_address(address_id: int, data: tuple[int, str] = Depends(current_user)):
    """A customer can only delete their own saved addresses."""
    with get_db() as db:
        cur = db.execute("DELETE FROM addresses WHERE id = ? AND user_id = ?",
                         (address_id, data[0]))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Address not found")
    return Response(status_code=204)


@app.get("/api/categories", response_model=list[Category])
def list_categories():
    with get_db() as db:
        rows = db.execute(
            """SELECT c.*, COUNT(p.id) AS product_count
               FROM categories c LEFT JOIN products p ON p.category_id = c.id
               GROUP BY c.id ORDER BY c.id"""
        ).fetchall()
    return [Category(id=r["id"], slug=r["slug"], name=r["name"], icon=r["icon"],
                     tagline=r["tagline"], product_count=r["product_count"]) for r in rows]


@app.get("/api/products", response_model=ProductPage)
def list_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    brands: Optional[str] = Query(None, description="Comma separated brands"),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    sort: str = "popularity",
    page: int = 1,
    page_size: int = 24,
):
    where = ["1=1"]
    params = []

    if q:
        where.append("(p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)")
        like = f"%{q}%"
        params += [like, like, like]
    if category:
        where.append("c.slug = ?")
        params.append(category)
    if brands:
        brand_list = [b.strip() for b in brands.split(",") if b.strip()]
        if brand_list:
            where.append(f"p.brand IN ({','.join('?' * len(brand_list))})")
            params += brand_list
    if min_price is not None:
        where.append("p.price >= ?")
        params.append(min_price)
    if max_price is not None:
        where.append("p.price <= ?")
        params.append(max_price)
    if min_rating is not None:
        where.append("p.rating >= ?")
        params.append(min_rating)

    order_map = {
        "popularity": "p.rating_count DESC",
        "price_low": "p.price ASC",
        "price_high": "p.price DESC",
        "rating": "p.rating DESC",
        "discount": "(p.mrp - p.price) / p.mrp DESC",
        "new": "p.id DESC",
    }
    order_by = order_map.get(sort, order_map["popularity"])
    clause = " AND ".join(where)

    with get_db() as db:
        total = db.execute(
            "SELECT COUNT(*) AS c FROM products p JOIN categories c ON c.id = p.category_id "
            f"WHERE {clause}", params
        ).fetchone()["c"]
        rows = db.execute(
            BASE_SELECT + f" WHERE {clause} ORDER BY {order_by} LIMIT ? OFFSET ?",
            params + [page_size, (page - 1) * page_size],
        ).fetchall()

    pages = (total + page_size - 1) // page_size
    return ProductPage(items=[row_to_product(r) for r in rows], total=total,
                       page=page, page_size=page_size, pages=pages)


@app.get("/api/deals", response_model=list[Product])
def deals(limit: int = 12):
    with get_db() as db:
        rows = db.execute(
            BASE_SELECT + " WHERE p.deal = 1 ORDER BY (p.mrp - p.price) / p.mrp DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [row_to_product(r) for r in rows]


@app.get("/api/bestsellers", response_model=list[Product])
def bestsellers(limit: int = 12):
    with get_db() as db:
        rows = db.execute(
            BASE_SELECT + " WHERE p.bestseller = 1 ORDER BY p.rating_count DESC LIMIT ?", (limit,)
        ).fetchall()
    return [row_to_product(r) for r in rows]


@app.get("/api/brands")
def brands():
    with get_db() as db:
        rows = db.execute("SELECT DISTINCT brand FROM products ORDER BY brand").fetchall()
    return [r["brand"] for r in rows]


@app.get("/api/price-range")
def price_range():
    with get_db() as db:
        row = db.execute("SELECT MIN(price) AS lo, MAX(price) AS hi FROM products").fetchone()
    return {"min": row["lo"], "max": row["hi"]}


@app.post("/api/cart/validate", response_model=CartSummary)
def cart_validate(payload: CartValidateRequest):
    return build_cart(payload.items)


def _row_to_order(row) -> Order:
    keys = row.keys()
    return Order(
        id=row["id"], order_no=row["order_no"], customer_name=row["customer"],
        phone=row["phone"] if "phone" in keys else "",
        address=row["address"], payment_method="COD",
        items=[OrderItem(**it) for it in json.loads(row["items"])],
        subtotal=row["subtotal"], delivery_fee=row["delivery"], total=row["total"],
        created_at=row["created_at"], status=row["status"] if "status" in keys else "Order Confirmed",
        lat=row["lat"] if "lat" in keys else None,
        lng=row["lng"] if "lng" in keys else None,
        accuracy=row["accuracy"] if "accuracy" in keys else None,
    )


def _row_to_event(row) -> OrderEvent:
    return OrderEvent(
        id=row["id"], order_no=row["order_no"], status=row["status"], title=row["title"],
        note=row["note"] or "", source=row["source"], created_at=row["created_at"],
    )


def _eta_for(order) -> str:
    """Rough delivery estimate: a confirmed order arrives within 2-4 days."""
    try:
        placed = datetime.fromisoformat(order["created_at"])
    except (ValueError, TypeError):
        placed = datetime.now()
    if order["status"] == "Delivered":
        return "Delivered"
    if order["status"] == "Cancelled":
        return "Cancelled"
    days = 2 + (int(order["order_no"][-1]) % 3)
    return (placed + timedelta(days=days)).strftime("%A, %d %B")


def _whatsapp_message(order) -> str:
    lines = [
        f"Hi {order['customer']},",
        "",
        f"Your Devanand Saw Kirana Store order *{order['order_no']}* is *{order['status']}*.",
        "",
    ]
    for item in json.loads(order["items"]):
        lines.append(
            f"- {item['name']} ({item['unit']}) x {item['qty']} - Rs {item['price'] * item['qty']}"
        )
    lines += [
        "",
        f"Total: *Rs {order['total']:.0f}*",
        f"Deliver to: {order['address']}",
    ]
    return "\n".join(lines)


@app.post("/api/orders", response_model=Order)
def create_order(payload: OrderCreate, authorization: Optional[str] = Header(None)):
    """Places an order. Login is compulsory - every order belongs to a customer account."""
    auth = _bearer(authorization)
    if auth is None:
        raise HTTPException(status_code=401, detail="Please login to place your order")
    if auth[1] != "user":
        raise HTTPException(status_code=403, detail="Please login with a customer account")
    user_id = auth[0]

    summary = build_cart(payload.items)
    if not summary.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    order_no = "RD" + str(random.randint(100000, 999999))
    created_at = datetime.now().isoformat(timespec="seconds")
    items_payload = [
        {"slug": ln.product.slug, "name": ln.product.name, "unit": ln.product.unit,
         "price": ln.product.price, "qty": ln.qty}
        for ln in summary.items
    ]

    with get_db() as db:
        db.execute(
            """INSERT INTO orders
               (order_no, customer, phone, address, lat, lng, accuracy, items, subtotal,
                delivery, total, status, user_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Order Confirmed', ?, ?)""",
            (order_no, payload.customer_name, payload.phone, payload.address,
             payload.lat, payload.lng, payload.accuracy,
             json.dumps(items_payload), summary.subtotal, summary.delivery_fee,
             summary.order_total, user_id, created_at),
        )
        log_event(db, order_no, "Order Confirmed", STATUS_META["Order Confirmed"]["title"],
                  STATUS_META["Order Confirmed"]["note"])
        for ln in summary.items:
            db.execute(
                "UPDATE products SET stock = CASE WHEN stock > ? THEN stock - ? ELSE 0 END"
                " WHERE slug = ?",
                (ln.qty, ln.qty, ln.product.slug),
            )
        # remember the pin on the account so the next order is one tap away
        if payload.lat is not None and payload.lng is not None:
            db.execute("UPDATE users SET address = ?, lat = ?, lng = ? WHERE id = ?",
                       (payload.address, payload.lat, payload.lng, user_id))

    return Order(
        id=0, order_no=order_no, customer_name=payload.customer_name, phone=payload.phone,
        address=payload.address, payment_method=payload.payment_method,
        items=[OrderItem(**it) for it in items_payload],
        subtotal=summary.subtotal, delivery_fee=summary.delivery_fee,
        total=summary.order_total, created_at=created_at,
        lat=payload.lat, lng=payload.lng, accuracy=payload.accuracy,
    )


@app.get("/api/orders/{order_no}", response_model=Order)
def get_order(order_no: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM orders WHERE order_no = ?", (order_no,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return _row_to_order(row)


@app.get("/api/orders/{order_no}/track", response_model=TrackOrder)
def track_order(order_no: str):
    """Order status, its full activity timeline, ETA and a WhatsApp deep link."""
    with get_db() as db:
        row = db.execute("SELECT * FROM orders WHERE order_no = ?", (order_no,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Order not found")
        events = db.execute(
            "SELECT * FROM order_events WHERE order_no = ? ORDER BY id ASC", (order_no,)
        ).fetchall()

    return TrackOrder(
        order=_row_to_order(row),
        events=[_row_to_event(e) for e in events],
        eta=_eta_for(row),
        whatsapp_url=whatsapp_link(row["phone"] or SUPPORT_WHATSAPP, _whatsapp_message(row)),
        support_number=SUPPORT_WHATSAPP,
    )


@app.post("/api/orders/{order_no}/events", response_model=OrderEvent, status_code=201)
def add_order_event(order_no: str, payload: EventCreate,
                    authorization: Optional[str] = Header(None)):
    """Lets a customer add a note to their own order timeline (e.g. 'call me')."""
    auth = _bearer(authorization)
    if auth is None or auth[1] != "user":
        raise HTTPException(status_code=401, detail="Please login to continue")
    with get_db() as db:
        order = db.execute("SELECT * FROM orders WHERE order_no = ?", (order_no,)).fetchone()
        if order is None:
            raise HTTPException(status_code=404, detail="Order not found")
        if order["user_id"] and order["user_id"] != auth[0]:
            raise HTTPException(status_code=403, detail="This order belongs to another account")
        log_event(db, order_no, order["status"], payload.title.strip(), payload.note.strip(), "customer")
        row = db.execute(
            "SELECT * FROM order_events WHERE order_no = ? ORDER BY id DESC LIMIT 1", (order_no,)
        ).fetchone()
    return _row_to_event(row)


@app.get("/api/support/whatsapp")
def support_whatsapp():
    """WhatsApp link to the store's support desk with a pre-filled greeting."""
    message = (
        "Hi Devanand Saw Kirana Store, I need help with my order. "
        "My order number is: "
    )
    return {
        "url": whatsapp_link(SUPPORT_WHATSAPP, message),
        "number": SUPPORT_WHATSAPP,
    }


@app.get("/api/products/suggest", response_model=SuggestResponse)
def suggest(q: str = "", limit: int = 8, authorization: Optional[str] = Header(None)):
    """Type-ahead suggestions: matching products, then categories, then brands."""
    term = (q or "").strip()
    if len(term) < 1:
        return SuggestResponse(query=term, suggestions=[])

    auth = _bearer(authorization)
    user_id = auth[0] if auth and auth[1] == "user" else None
    like = f"%{term}%"

    with get_db() as db:
        # in-stock products first, then best rated / best selling
        products = db.execute(
            BASE_SELECT
            + " WHERE (p.name LIKE ? OR p.brand LIKE ?)"
            + " ORDER BY p.stock = 0, p.bestseller DESC, p.rating DESC LIMIT ?",
            (like, like, limit),
        ).fetchall()
        cats = db.execute(
            "SELECT slug, name, tagline, icon FROM categories"
            " WHERE name LIKE ? OR tagline LIKE ? LIMIT 3",
            (like, like),
        ).fetchall()
        brands = db.execute(
            "SELECT DISTINCT brand FROM products WHERE brand LIKE ? ORDER BY brand LIMIT 3",
            (like,),
        ).fetchall()
        total = db.execute(
            "SELECT COUNT(*) AS c FROM products WHERE name LIKE ? OR brand LIKE ?", (like, like)
        ).fetchone()["c"]
        db.execute(
            "INSERT INTO search_log (query, results, user_id, created_at) VALUES (?, ?, ?, ?)",
            (term, total, user_id, datetime.now().isoformat(timespec="seconds")),
        )

    suggestions = [
        Suggestion(
            type="product", label=r["name"],
            sublabel=f"{r['brand']} · {r['unit']}", slug=r["slug"],
            price=r["price"], mrp=r["mrp"], emoji=r["emoji"], color=r["color"],
            image_url=r["image_url"] if "image_url" in r.keys() else "",
            in_stock=r["stock"] > 0,
        )
        for r in products
    ]
    suggestions += [
        Suggestion(type="category", label=c["name"], sublabel=c["tagline"] or "Category",
                   slug=c["slug"], emoji=c["icon"])
        for c in cats
    ]
    suggestions += [
        Suggestion(type="brand", label=b["brand"], sublabel="Brand")
        for b in brands
    ]
    return SuggestResponse(query=term, suggestions=suggestions[:limit + 4])


@app.get("/api/products/{slug}", response_model=Product)
def product_detail(slug: str):
    with get_db() as db:
        row = fetch_by_slug(db, slug)
    if row is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return row_to_product(row)


@app.get("/api/products/{slug}/related", response_model=list[Product])
def related_products(slug: str, limit: int = 8):
    with get_db() as db:
        row = fetch_by_slug(db, slug)
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        rows = db.execute(
            BASE_SELECT + " WHERE c.slug = ? AND p.slug != ? ORDER BY p.rating DESC LIMIT ?",
            (row["category_slug"], slug, limit),
        ).fetchall()
    return [row_to_product(r) for r in rows]
# ================================================================ ADMIN API
@app.post("/api/admin/login", response_model=TokenResponse)
def admin_login(payload: AdminLoginRequest):
    with get_db() as db:
        row = db.execute("SELECT * FROM admins WHERE username = ?", (payload.username,)).fetchone()
        if row is None or not verify_password(payload.password, row["password"]):
            raise HTTPException(status_code=401, detail="Invalid admin username or password")
    return TokenResponse(token=create_token(row["id"], "admin"), role="admin",
                         username=row["username"])


@app.get("/api/admin/me")
def admin_me(admin_id: int = Depends(current_admin)):
    return {"id": admin_id, "role": "admin"}


def _sniff_image(data: bytes) -> bool:
    """Checks the file's magic bytes so a renamed .exe cannot be stored as a photo."""
    if data.startswith(b"\xff\xd8\xff"):
        return True  # JPEG
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return True  # PNG
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return True  # GIF
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return True  # WebP
    return False


@app.post("/api/admin/upload")
def admin_upload(file: UploadFile = File(...), admin_id: int = Depends(current_admin)):
    """Stores a product photo in the database and returns the URL to save on the product."""
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG, WebP or GIF images are allowed",
        )

    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image is too large - the limit is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )
    # the declared type can lie, so confirm the bytes really are an image
    if not _sniff_image(data):
        raise HTTPException(status_code=400, detail="That file is not a valid image")

    ext = ALLOWED_IMAGE_TYPES[content_type]
    # random name: never trust the client filename for a path on disk
    filename = f"{uuid4().hex}{ext}"
    with get_db() as db:
        db.execute(
            "INSERT INTO images (name, content_type, data, created_at) VALUES (?, ?, ?, ?)",
            (filename, content_type, data, datetime.now().isoformat(timespec="seconds")),
        )

    return {"url": f"/uploads/{filename}", "filename": file.filename, "size": len(data)}


@app.get("/uploads/{name}", include_in_schema=False)
def uploaded_image(name: str):
    """Serves a product photo from the database, falling back to legacy files on disk."""
    with get_db() as db:
        row = db.execute("SELECT content_type, data FROM images WHERE name = ?", (name,)).fetchone()
    if row is not None:
        return Response(content=bytes(row["data"]), media_type=row["content_type"],
                        headers={"Cache-Control": "public, max-age=31536000, immutable"})
    path = os.path.abspath(os.path.join(UPLOAD_DIR, name))
    if path.startswith(os.path.abspath(UPLOAD_DIR) + os.sep) and os.path.isfile(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="Image not found")


@app.get("/api/admin/stats", response_model=AdminStats)
def admin_stats(admin_id: int = Depends(current_admin)):
    with get_db() as db:
        total_products = db.execute("SELECT COUNT(*) AS c FROM products").fetchone()["c"]
        total_orders = db.execute("SELECT COUNT(*) AS c FROM orders").fetchone()["c"]
        total_users = db.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        revenue = db.execute("SELECT COALESCE(SUM(total), 0) AS r FROM orders").fetchone()["r"]
        low = db.execute(
            "SELECT COUNT(*) AS c FROM products WHERE stock > 0 AND stock <= 20"
        ).fetchone()["c"]
        out = db.execute("SELECT COUNT(*) AS c FROM products WHERE stock = 0").fetchone()["c"]
        by_status = {
            r["status"]: r["c"]
            for r in db.execute("SELECT status, COUNT(*) AS c FROM orders GROUP BY status")
        }
        recent = db.execute("SELECT * FROM orders ORDER BY id DESC LIMIT 10").fetchall()
        all_items = db.execute("SELECT items FROM orders").fetchall()

    # tallied in Python so the same code works on SQLite and Postgres
    sales: dict[str, dict] = {}
    for r in all_items:
        for it in json.loads(r["items"]):
            entry = sales.setdefault(it["slug"], {"slug": it["slug"], "name": it["name"],
                                                  "sold": 0, "revenue": 0.0})
            entry["sold"] += it["qty"]
            entry["revenue"] += it["qty"] * it["price"]
    top = sorted(sales.values(), key=lambda t: t["sold"], reverse=True)[:5]

    return AdminStats(
        total_products=total_products, total_orders=total_orders, total_users=total_users,
        total_revenue=round(float(revenue), 2), low_stock_count=low, out_of_stock_count=out,
        orders_by_status=by_status,
        recent_orders=[_row_to_order(r) for r in recent],
        top_products=[
            {"slug": t["slug"], "name": t["name"], "sold": t["sold"] or 0,
             "revenue": round(float(t["revenue"] or 0), 2)}
            for t in top
        ],
    )


@app.get("/api/admin/products", response_model=list[Product])
def admin_list_products(q: Optional[str] = None, admin_id: int = Depends(current_admin)):
    clause, params = "", []
    if q:
        clause = " WHERE p.name LIKE ? OR p.brand LIKE ?"
        params = [f"%{q}%", f"%{q}%"]
    with get_db() as db:
        rows = db.execute(BASE_SELECT + clause + " ORDER BY p.id DESC", params).fetchall()
    return [row_to_product(r) for r in rows]


def _category_id(conn, slug: str) -> int:
    row = conn.execute("SELECT id FROM categories WHERE slug = ?", (slug,)).fetchone()
    if row is None:
        raise HTTPException(status_code=400, detail="Unknown category")
    return row["id"]


@app.post("/api/admin/products", response_model=Product, status_code=201)
def admin_create_product(payload: ProductCreate, admin_id: int = Depends(current_admin)):
    slug = "-".join(payload.name.lower().replace("/", " ").split())[:60]
    with get_db() as db:
        cat_id = _category_id(db, payload.category)
        if db.execute("SELECT 1 FROM products WHERE slug = ?", (slug,)).fetchone():
            slug = f"{slug}-{random.randint(100, 999)}"
        db.execute(
            """INSERT INTO products
               (slug, name, brand, category_id, price, mrp, unit, rating, rating_count, reviews,
                stock, emoji, image_url, color, description, highlights, bestseller, deal)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (slug, payload.name, payload.brand, cat_id, payload.price,
             payload.mrp or payload.price, payload.unit, payload.rating, payload.rating_count,
             payload.stock, payload.emoji, payload.image_url or "", payload.color,
             payload.description,
             json.dumps(payload.highlights), int(payload.bestseller), int(payload.deal)),
        )
        row = fetch_by_slug(db, slug)
    return row_to_product(row)


@app.put("/api/admin/products/{slug}", response_model=Product)
def admin_update_product(slug: str, payload: ProductUpdate, admin_id: int = Depends(current_admin)):
    fields = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    with get_db() as db:
        if db.execute("SELECT 1 FROM products WHERE slug = ?", (slug,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Product not found")
        if "category" in fields:
            fields["category_id"] = _category_id(db, fields.pop("category"))
        if "highlights" in fields:
            fields["highlights"] = json.dumps(fields["highlights"])
        for flag in ("bestseller", "deal"):
            if flag in fields:
                fields[flag] = int(fields[flag])
        if fields:
            sets = ", ".join(f"{k} = ?" for k in fields)
            db.execute(f"UPDATE products SET {sets} WHERE slug = ?", [*fields.values(), slug])
        row = fetch_by_slug(db, slug)
    return row_to_product(row)


@app.delete("/api/admin/products/{slug}")
def admin_delete_product(slug: str, admin_id: int = Depends(current_admin)):
    with get_db() as db:
        cur = db.execute("DELETE FROM products WHERE slug = ?", (slug,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Product not found")
    return {"deleted": slug}


@app.get("/api/admin/orders", response_model=list[Order])
def admin_list_orders(status: Optional[str] = None, admin_id: int = Depends(current_admin)):
    clause, params = "", []
    if status:
        clause = " WHERE status = ?"
        params = [status]
    with get_db() as db:
        rows = db.execute("SELECT * FROM orders" + clause + " ORDER BY id DESC", params).fetchall()
    return [_row_to_order(r) for r in rows]


ORDER_STATUSES = ["Order Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"]


@app.patch("/api/admin/orders/{order_no}", response_model=Order)
def admin_update_order(order_no: str, payload: OrderStatusUpdate,
                       admin_id: int = Depends(current_admin)):
    if payload.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of {ORDER_STATUSES}")
    with get_db() as db:
        cur = db.execute("UPDATE orders SET status = ? WHERE order_no = ?", (payload.status, order_no))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Order not found")
        meta = STATUS_META[payload.status]
        log_event(db, order_no, payload.status, meta["title"], meta["note"], "admin")
        row = db.execute("SELECT * FROM orders WHERE order_no = ?", (order_no,)).fetchone()
    return _row_to_order(row)


@app.get("/api/admin/orders/{order_no}/events", response_model=list[OrderEvent])
def admin_order_events(order_no: str, admin_id: int = Depends(current_admin)):
    with get_db() as db:
        if db.execute("SELECT 1 FROM orders WHERE order_no = ?", (order_no,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Order not found")
        rows = db.execute(
            "SELECT * FROM order_events WHERE order_no = ? ORDER BY id DESC", (order_no,)
        ).fetchall()
    return [_row_to_event(r) for r in rows]


@app.post("/api/admin/orders/{order_no}/events", response_model=OrderEvent, status_code=201)
def admin_add_event(order_no: str, payload: EventCreate, admin_id: int = Depends(current_admin)):
    """Adds a warehouse note to an order timeline (packed, called, out for pickup...)."""
    with get_db() as db:
        order = db.execute("SELECT * FROM orders WHERE order_no = ?", (order_no,)).fetchone()
        if order is None:
            raise HTTPException(status_code=404, detail="Order not found")
        log_event(db, order_no, order["status"], payload.title.strip(),
                  payload.note.strip(), payload.source or "admin")
        row = db.execute(
            "SELECT * FROM order_events WHERE order_no = ? ORDER BY id DESC LIMIT 1", (order_no,)
        ).fetchone()
    return _row_to_event(row)


@app.get("/api/admin/searches")
def admin_searches(admin_id: int = Depends(current_admin)):
    """Recent search terms - helps the store spot what customers are looking for."""
    with get_db() as db:
        rows = db.execute(
            """SELECT query, COUNT(*) AS times, MAX(created_at) AS last_seen, MAX(results) AS results
               FROM search_log GROUP BY query ORDER BY times DESC, last_seen DESC LIMIT 15"""
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/admin/customers", response_model=list[UserOut])
def admin_customers(admin_id: int = Depends(current_admin)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM users ORDER BY id DESC").fetchall()
    return [user_to_out(r) for r in rows]
# ---------------------------------------------------------- single-page app
# When the frontend build is present next to the backend, serve it from here so
# the whole site runs on one origin. That keeps /api relative, avoids CORS and
# means only one PythonAnywhere web app is needed.
FRONTEND_DIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "..", "frontend", "dist",
)
FRONTEND_DIST = os.path.abspath(FRONTEND_DIST)


@app.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str):
    """Serves the built React app, falling back to index.html for client routes."""
    if full_path.startswith("api/") or full_path.startswith("uploads/"):
        raise HTTPException(status_code=404, detail="Not found")

    index = os.path.join(FRONTEND_DIST, "index.html")
    if not os.path.isfile(index):
        raise HTTPException(
            status_code=404,
            detail="Frontend build not found. Run npm run build in frontend/, or use the Vite dev server.",
        )

    # only serve files that actually exist inside dist (blocks ../ traversal)
    candidate = os.path.abspath(os.path.join(FRONTEND_DIST, full_path))
    if candidate.startswith(FRONTEND_DIST + os.sep) and os.path.isfile(candidate):
        return FileResponse(candidate)

    # any other path belongs to the React router, so hand back the SPA shell
    return FileResponse(index)