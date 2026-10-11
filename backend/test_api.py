"""Simple end-to-end API smoke test using only stdlib urllib.

Run:  python test_api.py        (backend server must be running on :8000)
"""
import json
import random
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api"
passed, failed = 0, 0


def call(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]


def check(label, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {label} {extra}")
    else:
        failed += 1
        print(f"  FAIL  {label} {extra}")


print("health / categories")
s, d = call("/health")
check("health 200", s == 200 and d["status"] == "ok", f"-> {s}")
s, cats = call("/categories")
check("categories", s == 200 and len(cats) == 12, f"-> {s}, {len(cats)} categories")

print("products list, filters, sort, paging")
s, page = call("/products?page_size=8")
check("list default", s == 200 and len(page["items"]) == 8 and page["total"] == 75,
      f"-> {s}, total={page['total']}")
s, p2 = call("/products?page=2&page_size=8")
check("page 2 differs", s == 200 and p2["items"][0]["slug"] != page["items"][0]["slug"])
s, sr = call("/products?q=daal")
check("search 'daal'", s == 200 and sr["total"] >= 3, f"-> {sr['total']} hits")
s, cat = call("/products?category=atta-rice-daal")
check("category filter", s == 200 and all(i["category"] == "atta-rice-daal" for i in cat["items"]),
      f"-> {cat['total']} items")
s, low = call("/products?sort=price_low&page_size=5")
prices = [i["price"] for i in low["items"]]
check("sort price_low", s == 200 and prices == sorted(prices), f"-> {prices}")
s, br = call("/products?brands=Amul")
check("brand filter", s == 200 and all(i["brand"] == "Amul" for i in br["items"]), f"-> {br['total']}")
s, rp = call("/products?min_price=100&max_price=300")
check("price range", s == 200 and all(100 <= i["price"] <= 300 for i in rp["items"]), f"-> {rp['total']}")
s, rr = call("/products?min_rating=4.5")
check("min rating", s == 200 and all(i["rating"] >= 4.5 for i in rr["items"]), f"-> {rr['total']}")

print("product detail / related / deals / bestsellers")
s, d1 = call("/products/rice-basmati-5kg")
check("detail 200", s == 200 and d1["slug"] == "rice-basmati-5kg", f"-> {s}")
check("discount calc", d1["discount_percent"] == 24 and d1["savings"] == 171.0,
      f"-> {d1['discount_percent']}% / Rs {d1['savings']}")
s, _ = call("/products/no-such-product")
check("detail 404", s == 404, f"-> {s}")
s, rel = call("/products/rice-basmati-5kg/related?limit=5")
check("related", s == 200 and len(rel) == 5 and all(r["category"] == d1["category"] for r in rel),
      f"-> {s}, {len(rel)} items")
s, dl = call("/deals?limit=6")
check("deals", s == 200 and len(dl) == 6 and all(i["deal"] for i in dl), f"-> {s}")
s, bs = call("/bestsellers?limit=6")
check("bestsellers", s == 200 and all(i["bestseller"] for i in bs), f"-> {s}")
s, bl = call("/brands")
s, pr = call("/price-range")
check("brands + range", s == 200 and bl and pr["min"] <= pr["max"], f"-> {len(bl)} brands, {pr}")

print("cart validation (server-side pricing)")
body = {"items": [{"slug": "rice-basmati-5kg", "qty": 2}, {"slug": "daal-toor-1kg", "qty": 3}]}
s, cart = call("/cart/validate", "POST", body)
expected = 549 * 2 + 185 * 3
check("cart totals", s == 200 and cart["subtotal"] == expected and cart["delivery_fee"] == 0.0,
      f"-> subtotal {cart['subtotal']} delivery {cart['delivery_fee']} total {cart['order_total']}")
check("cart item_count", cart["item_count"] == 5 and len(cart["items"]) == 2)
s, small = call("/cart/validate", "POST", {"items": [{"slug": "tata-salt-1kg", "qty": 1}]})
check("small cart pays delivery", small["delivery_fee"] == 29.0, f"-> {small['delivery_fee']}")
s, over = call("/cart/validate", "POST", {"items": [{"slug": "sarson-oil-1l", "qty": 20}]})
check("stock clamp + issue", len(over["issues"]) == 1 and over["items"][0]["qty"] == 18,
      f"-> {over['issues']}")

print("orders (login is compulsory)")
buyer_phone = "9" + str(random.randint(100000000, 999999999))
s, reg = call("/auth/register", "POST",
              {"name": "Sunil Kumar", "phone": buyer_phone, "password": "test123"})
user_token = reg["token"]

order_body = {
    "customer_name": "Sunil Kumar", "phone": buyer_phone,
    "address": "House 12, Gandhi Nagar, Delhi - 110051",
    "payment_method": "COD",
    "items": [{"slug": "aashirvaad-atta-5kg", "qty": 1}, {"slug": "tata-chai-250g", "qty": 1}],
}

# a signed-out shopper must not be able to place an order
s, body = call("/orders", "POST", order_body)
check("guest order rejected with 401", s == 401, f"-> {s}")

s, order = call("/orders", "POST", order_body, token=user_token)
check("order created when logged in", s == 200 and order["order_no"].startswith("RD"),
      f"-> {order.get('order_no')}")
s, got = call(f"/orders/{order['order_no']}")
check("order fetch", s == 200 and len(got["items"]) == 2, f"-> {s}")
s, _ = call("/orders/RD000000")
check("order 404", s == 404, f"-> {s}")
s, _ = call("/orders", "POST", {**order_body, "items": []}, token=user_token)
check("empty cart rejected", s == 400, f"-> {s}")
s, _ = call("/orders", "POST", {"customer_name": "X", "phone": "123456",
                                "address": "some address",
                                "items": [{"slug": "tata-salt-1kg", "qty": 1}]}, token=user_token)
check("invalid name rejected by schema", s == 422, f"-> {s}")

# an admin token is not a customer token
s, adm = call("/admin/login", "POST", {"username": "admin", "password": "admin123"})
s, _ = call("/orders", "POST", order_body, token=adm["token"])
check("admin token cannot place a customer order", s == 403, f"-> {s}")

print(f"\n{passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)