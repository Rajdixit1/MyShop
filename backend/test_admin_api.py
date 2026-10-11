"""Tests for auth + admin panel APIs.

Run:  python test_admin_api.py      (backend must be running on :8000)
"""
import json
import random
import struct
import urllib.error
import urllib.request
import uuid
import zlib

BASE = "http://127.0.0.1:8000/api"
ADMIN = {"username": "admin", "password": "admin123"}
passed, failed = 0, 0


def png_bytes(width=8, height=8, rgb=(255, 140, 0)):
    """Builds a genuine PNG in memory so the upload tests need no fixture files."""
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xffffffff)

    raw = b"".join(b"\x00" + bytes(rgb) * width for _ in range(height))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))


def upload(data, content_type, filename, token=None):
    """Posts a file to the multipart upload endpoint without extra dependencies."""
    boundary = "----rashantest"
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
            f'filename="{filename}"\r\nContent-Type: {content_type}\r\n\r\n').encode() + data + \
           f"\r\n--{boundary}--\r\n".encode()
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + "/admin/upload", data=body, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:160]


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
        return e.code, e.read().decode()[:160]


def check(label, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {label} {extra}")
    else:
        failed += 1
        print(f"  FAIL  {label} {extra}")


print("client registration + login")
phone = "9" + str(random.randint(100000000, 999999999))
s, reg = call("/auth/register", "POST",
              {"name": "Test Customer", "phone": phone, "password": "test123", "address": "Delhi"})
check("register 201", s == 201 and reg["role"] == "user", f"-> {s}")
user_token = reg.get("token")
s, _ = call("/auth/register", "POST", {"name": "Dup", "phone": phone, "password": "test123"})
check("duplicate phone rejected", s == 409, f"-> {s}")
s, _ = call("/auth/register", "POST", {"name": "X", "phone": "12345", "password": "a"})
check("bad phone rejected", s == 422, f"-> {s}")

s, login = call("/auth/login", "POST", {"phone": phone, "password": "test123"})
check("login ok", s == 200 and login["role"] == "user", f"-> {s}")
s, _ = call("/auth/login", "POST", {"phone": phone, "password": "wrong"})
check("wrong password rejected", s == 401, f"-> {s}")
s, me = call("/auth/me", token=user_token)
check("profile via token", s == 200 and me["phone"] == phone, f"-> {s}")
s, _ = call("/auth/me")
check("profile needs token", s == 401, f"-> {s}")

print("admin login + protection")
s, al = call("/admin/login", "POST", ADMIN)
check("admin login", s == 200 and al["role"] == "admin", f"-> {s}")
admin_token = al.get("token")
s, _ = call("/admin/login", "POST", {"username": "admin", "password": "nope"})
check("bad admin password rejected", s == 401, f"-> {s}")
s, _ = call("/admin/stats")
check("stats need admin token", s == 401, f"-> {s}")
s, _ = call("/admin/stats", token=user_token)
check("customer token cannot access admin", s == 403, f"-> {s}")

print("admin dashboard stats")
s, stats = call("/admin/stats", token=admin_token)
check("stats 200", s == 200 and stats["total_products"] > 0, f"-> {s}")
check("stats has keys", all(k in stats for k in
      ["total_products", "total_orders", "total_revenue", "orders_by_status", "recent_orders"]),
      f"-> products {stats.get('total_products')}, orders {stats.get('total_orders')}")

print("admin product CRUD")
s, created = call("/admin/products", "POST", {
    "name": "Test Sona Masoor Daal", "brand": "TestBrand", "category": "atta-rice-daal",
    "price": 135, "mrp": 170, "unit": "1 kg", "stock": 40, "rating": 4.2,
    "emoji": "\U0001FAD8", "description": "Created by admin test"}, token=admin_token)
check("create product", s == 201 and created["price"] == 135, f"-> {s}")
slug = created.get("slug")
s, listed = call("/admin/products", token=admin_token)
check("list includes new product", any(p["slug"] == slug for p in listed), f"-> {len(listed)} items")
s, updated = call(f"/admin/products/{slug}", "PUT",
                  {"price": 129, "stock": 5, "deal": True}, token=admin_token)
check("update product", s == 200 and updated["price"] == 129 and updated["stock"] == 5, f"-> {s}")
check("discount recalculated", updated["discount_percent"] == 24, f"-> {updated['discount_percent']}%")
s, _ = call("/admin/products/not-a-real-slug", "PUT", {"price": 10}, token=admin_token)
check("update missing product 404", s == 404, f"-> {s}")
s, _ = call("/admin/products", "POST",
            {"name": "X", "brand": "Y", "category": "no-such-cat", "price": 10,
             "unit": "1 kg", "stock": 1}, token=admin_token)
print("admin order management")
s, order = call("/orders", "POST", {
    "customer_name": "Admin Test", "phone": "9876543210", "address": "Delhi 110051",
    "items": [{"slug": "tata-salt-1kg", "qty": 2}]}, token=user_token)
check("order placed with user link", s == 200, f"-> {order.get('order_no')}")
order_no = order.get("order_no")
s, mine = call("/orders/mine", token=user_token)
check("my orders returns it", s == 200 and any(o["order_no"] == order_no for o in mine),
      f"-> {len(mine)} orders")
s, all_orders = call("/admin/orders", token=admin_token)
check("admin sees orders", s == 200 and any(o["order_no"] == order_no for o in all_orders),
      f"-> {len(all_orders)}")
s, shipped = call(f"/admin/orders/{order_no}", "PATCH", {"status": "Shipped"}, token=admin_token)
check("status updated", s == 200 and shipped["status"] == "Shipped", f"-> {s}")
s, _ = call(f"/admin/orders/{order_no}", "PATCH", {"status": "Teleported"}, token=admin_token)
check("invalid status rejected", s == 400, f"-> {s}")
s, filtered = call("/admin/orders?status=Shipped", token=admin_token)
check("filter orders by status", all(o["status"] == "Shipped" for o in filtered), f"-> {len(filtered)}")

print("admin customers + cleanup")
s, customers = call("/admin/customers", token=admin_token)
check("customers listed", s == 200 and any(u["phone"] == phone for u in customers),
      f"-> {len(customers)}")
s, _ = call(f"/admin/products/{slug}", "DELETE", token=admin_token)
check("delete product", s == 200, f"-> {s}")
s, _ = call(f"/admin/products/{slug}", "DELETE", token=admin_token)
check("delete again 404", s == 404, f"-> {s}")

print("product image upload")
image = png_bytes()
s, uploaded = upload(image, "image/png", "atta.png", admin_token)
check("png upload accepted", s == 200 and uploaded["url"].startswith("/uploads/"),
      f"-> {uploaded.get('url')}")
image_url = uploaded.get("url", "")
check("stored file is not the client filename",
      image_url != "/uploads/atta.png", f"-> {image_url}")

s, _ = upload(image, "image/png", "x.png")
check("upload needs an admin token", s == 401, f"-> {s}")
s, _ = upload(image, "image/png", "x.png", "bogus-token")
check("upload rejects a bad token", s == 401, f"-> {s}")

s, _ = upload(b"this is definitely not an image", "image/png", "fake.png", admin_token)
check("fake image rejected by content sniffing", s == 400, f"-> {s}")
s, _ = upload(b"MZ\x90\x00executable", "application/x-msdownload", "virus.exe", admin_token)
check("non-image type rejected", s == 400, f"-> {s}")
s, _ = upload(b"\x89PNG\r\n\x1a\n" + b"0" * (3 * 1024 * 1024 + 10), "image/png", "big.png", admin_token)
check("oversized image rejected", s == 413, f"-> {s}")
s, _ = upload(b"", "image/png", "empty.png", admin_token)
check("empty file rejected", s == 400, f"-> {s}")

# the uploaded file is actually served back over HTTP
with urllib.request.urlopen("http://127.0.0.1:8000" + image_url) as resp:
    served = resp.read()
    served_type = resp.headers.get("Content-Type")
check("uploaded image is served as a static file",
      resp.status == 200 and served == image, f"-> {served_type}")

s, with_img = call("/admin/products", "POST", {
    "name": f"Photo Product {uuid.uuid4().hex[:6]}", "brand": "PhotoBrand",
    "category": "atta-rice-daal", "price": 149, "unit": "1 kg", "stock": 4,
    "image_url": image_url}, token=admin_token)
check("product created with the uploaded image",
      s == 201 and with_img.get("image_url") == image_url, f"-> {with_img.get('image_url')}")
photo_slug = with_img.get("slug")

s, fetched = call(f"/products/{photo_slug}")
check("public product API returns the image",
      s == 200 and fetched.get("image_url") == image_url, f"-> {fetched.get('image_url')}")

s, updated = call(f"/admin/products/{photo_slug}", "PUT", {"image_url": ""}, token=admin_token)
check("image can be removed again", s == 200 and updated["image_url"] == "")
# the emoji is only a fallback, so it must survive on products with no photo
check("products without an image fall back to the emoji",
      bool(updated["emoji"]) and not updated["image_url"])

s, _ = call(f"/admin/products/{photo_slug}", "DELETE", token=admin_token)
check("cleanup photo product", s == 200, f"-> {s}")

s, _ = call("/admin/products", "POST",
            {"name": "Valid Name", "brand": "Y", "category": "no-such-cat", "price": 10,
             "unit": "1 kg", "stock": 1}, token=admin_token)
check("bad category rejected", s == 400, f"-> {s}")

print(f"\n{passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)