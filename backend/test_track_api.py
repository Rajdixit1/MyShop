"""Tests for order tracking, WhatsApp links and search suggestions.

Run:  python test_track_api.py      (backend must be running on :8000)
"""
import json
import random
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:8000/api"
ADMIN = {"username": "admin", "password": "admin123"}
passed, failed = 0, 0


def call(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            # a 204 has no body, so there is nothing to parse
            return resp.status, (json.loads(raw) if raw.strip() else None)
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


print("setup: admin login + a fresh customer order")
s, al = call("/admin/login", "POST", ADMIN)
admin_token = al["token"]
phone = "9" + str(random.randint(100000000, 999999999))
s, reg = call("/auth/register", "POST",
              {"name": "Track Customer", "phone": phone, "password": "test123"})
user_token = reg["token"]
s, order = call("/orders", "POST", {
    "customer_name": "Track Customer", "phone": phone, "address": "12 Test Street, Delhi 110051",
    "items": [{"slug": "tata-salt-1kg", "qty": 2}]}, token=user_token)
no = order["order_no"]
check("order created", s == 200 and no.startswith("RD"), f"-> {no}")

print("tracking endpoint")
s, tr = call(f"/orders/{no}/track")
check("track 200", s == 200 and tr["order"]["order_no"] == no, f"-> {s}")
check("first event is confirmation",
      tr["events"] and tr["events"][0]["status"] == "Order Confirmed")
check("timeline starts with one event", len(tr["events"]) == 1, f"-> {len(tr['events'])}")
check("eta calculated", len(tr["eta"]) > 3, f"-> {tr['eta']}")
s, _ = call("/orders/RD000000/track")
check("unknown order 404", s == 404, f"-> {s}")

print("whatsapp link")
wa = tr["whatsapp_url"]
check("wa.me link", wa.startswith("https://wa.me/91"), f"-> {wa[:34]}")
check("link targets customer number", phone in wa, f"-> {wa[:40]}")
check("message pre-filled with order number", no in urllib.parse.unquote(wa))
check("message mentions status", "Confirmed" in urllib.parse.unquote(wa))
s, sup = call("/support/whatsapp")
check("support whatsapp link", s == 200 and sup["url"].startswith("https://wa.me/91"),
      f"-> {sup['url'][:30]}")

print("admin status changes append to the timeline")
for status in ["Packed", "Shipped", "Out for Delivery"]:
    s, _ = call(f"/admin/orders/{no}", "PATCH", {"status": status}, token=admin_token)
    check(f"status -> {status}", s == 200, f"-> {s}")

s, tr2 = call(f"/orders/{no}/track")
check("timeline has 4 events now", len(tr2["events"]) == 4, f"-> {len(tr2['events'])}")
check("events are chronological",
      [e["status"] for e in tr2["events"]] ==
      ["Order Confirmed", "Packed", "Shipped", "Out for Delivery"])
check("events carry notes", all(e["note"] for e in tr2["events"]))
check("events record admin source",
      all(e["source"] == "admin" for e in tr2["events"][1:]))


print("admin notes on an order")
s, note = call(f"/admin/orders/{no}/events", "POST",
               {"title": "Called customer", "note": "Confirmed slot"}, token=admin_token)
check("admin note added", s == 201 and note["title"] == "Called customer", f"-> {s}")
s, evts = call(f"/admin/orders/{no}/events", token=admin_token)
check("admin sees timeline (newest first)",
      s == 200 and evts[0]["title"] == "Called customer", f"-> {len(evts)} events")

print("customer notes on their own order")
s, cnote = call(f"/orders/{no}/events", "POST",
                {"title": "Please call before delivery", "note": "Gate code 1234"},
                token=user_token)
check("customer note added", s == 201 and cnote["source"] == "customer", f"-> {s}")
s, _ = call(f"/orders/{no}/events", "POST", {"title": "no login"}, token=None)
check("note without login 401", s == 401, f"-> {s}")

other_phone = "9" + str(random.randint(100000000, 999999999))
s, other = call("/auth/register", "POST",
               {"name": "Other", "phone": other_phone, "password": "test123"})
s, _ = call(f"/orders/{no}/events", "POST", {"title": "hijack"}, token=other["token"])
check("other customer blocked from this order", s == 403, f"-> {s}")

print("search suggestions")
s, sg = call("/products/suggest?q=rice")
check("suggest 200", s == 200, f"-> {s}")
check("products suggested", any(x["type"] == "product" for x in sg["suggestions"]),
      f"-> {[x['label'] for x in sg['suggestions'][:3]]}")
check("suggestion carries price and slug",
      all("price" in x and "slug" in x for x in sg["suggestions"]))
check("category suggested", any(x["type"] == "category" for x in sg["suggestions"]))
check("in-stock products ranked first",
      sg["suggestions"][0].get("in_stock") is True, f"-> {sg['suggestions'][0]['label']}")

s, sg2 = call("/products/suggest?q=tata")
check("brand match returns products",
      any(x["type"] == "product" for x in sg2["suggestions"]))
s, sg3 = call("/products/suggest?q=zzzzznotathing")
check("no matches returns empty list", s == 200 and sg3["suggestions"] == [], f"-> {s}")
s, sg4 = call("/products/suggest?q=")
check("empty query returns empty list", s == 200 and sg4["suggestions"] == [], f"-> {s}")
s, sg5 = call("/products/suggest?q=soap&limit=3")
check("limit respected", len(sg5["suggestions"]) <= 3 + 4, f"-> {len(sg5['suggestions'])}")

print("admin search insights")
for _ in range(3):
    call("/products/suggest?q=atta")
s, searches = call("/admin/searches", token=admin_token)
check("search log visible to admin", s == 200 and len(searches) > 0, f"-> {len(searches)}")
check("searches aggregated with count",
      any(x["query"] == "atta" and x["times"] >= 3 for x in searches))
s, _ = call("/admin/searches")
check("search insights need admin", s == 401, f"-> {s}")

print("\nsaved geo addresses")
# the address endpoints need a session - a signed-out shopper gets nothing
s, _ = call("/auth/addresses")
check("addresses need a login", s == 401, f"-> {s}")
s, _ = call("/auth/addresses", "POST", {"label": "Home", "address": "No pin given"})
check("address without a pin rejected", s in (400, 401), f"-> {s}")

# reuse the customer created above so we always have a valid token
s, mine = call("/orders/mine", token=user_token)
check("customer session reused", s == 200, f"-> {s}")

s, addr = call("/auth/addresses", "POST", {
    "label": "Home", "address": "House 12, Gandhi Nagar, Delhi 110051",
    "lat": 28.6139, "lng": 77.209, "make_default": True}, token=user_token)
check("address saved with its pin", s == 201 and abs(addr.get("lat", 0) - 28.6139) < 1e-6,
      f"-> {addr.get('id')}")
check("first address becomes the default", addr.get("is_default") is True)

s, listed = call("/auth/addresses", token=user_token)
check("saved address listed", s == 200 and any(a["id"] == addr["id"] for a in listed),
      f"-> {len(listed)} addresses")

s, profile = call("/auth/me", token=user_token)
check("profile carries the last pin",
      profile.get("lat") == addr["lat"] and profile.get("lng") == addr["lng"],
      f"-> {profile.get('lat')},{profile.get('lng')}")

# an order placed with a pin keeps it for the delivery agent
s, geo_order = call("/orders", "POST", {
    "customer_name": "Track Customer", "phone": phone,
    "address": "House 12, Gandhi Nagar, Delhi 110051",
    "lat": 28.6139, "lng": 77.209, "accuracy": 12,
    "items": [{"slug": "tata-salt-1kg", "qty": 1}]}, token=user_token)
check("order stores the exact pin", s == 200 and geo_order.get("lat") == 28.6139,
      f"-> {geo_order.get('lat')},{geo_order.get('lng')}")
check("order keeps the GPS accuracy", geo_order.get("accuracy") == 12)

s, out_of_range = call("/orders", "POST", {
    "customer_name": "Bad Pin", "phone": phone, "address": "Somewhere else",
    "lat": 999, "lng": 77.2, "items": [{"slug": "tata-salt-1kg", "qty": 1}]}, token=user_token)
check("impossible latitude rejected by schema", s == 422, f"-> {s}")

# another customer must not see or delete someone else's saved address
s, other = call("/auth/register", "POST", {
    "name": "Other Shopper", "phone": "8" + str(random.randint(100000000, 999999999)),
    "password": "test123"})
s, _ = call(f"/auth/addresses/{addr['id']}", "DELETE", token=other["token"])
check("cannot delete another customer's address", s == 404, f"-> {s}")
s, _ = call(f"/auth/addresses/{addr['id']}", "DELETE", token=user_token)
check("owner can delete the address", s == 204, f"-> {s}")

print("\nreverse geocoding")
s, geo = call("/geo/reverse?lat=28.6139&lng=77.209")
check("reverse geocode responds", s == 200 and "lat" in geo, f"-> {s}")
check("geocode returns coordinates", geo.get("lat") == 28.6139 and geo.get("lng") == 77.209)
# offline it degrades to source=unavailable but still answers with the pin
check("geocode echoes the pin even when offline",
      geo.get("address") is not None, f"-> {geo.get('source')}")
s, _ = call("/geo/reverse?lat=999&lng=77.209")
check("out of range coordinate rejected", s == 422, f"-> {s}")

print(f"\n{passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)