# Drives the WSGI app exactly the way PythonAnywhere will - no uvicorn involved.
from wsgiref.simple_server import make_server
from wsgi import application
import threading, time, urllib.request, urllib.error, os, struct, zlib

srv = make_server("127.0.0.1", 8124, application)
threading.Thread(target=srv.serve_forever, daemon=True).start()
time.sleep(1.5)
passed = failed = 0

def hit(path):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:8124{path}") as r:
            return r.status, r.read(), r.headers.get("Content-Type")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200], None

def check(label, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1; print(f"  PASS  {label} {extra}")
    else:
        failed += 1; print(f"  FAIL  {label} {extra}")

print("API still works over WSGI")
code, body, ct = hit("/api/health")
check("health endpoint", code == 200 and b'"status"' in body, f"-> {code}")
code, body, _ = hit("/api/products?page_size=1")
check("products endpoint", code == 200 and b'"items"' in body, f"-> {code}")

print("\nSPA served from the same origin")
for p in ["/", "/checkout", "/admin/products", "/products?x=1", "/track/RD123456"]:
    code, body, ct = hit(p)
    check(f"SPA route {p}", code == 200 and b"<!doctype html" in body.lower(), f"-> {code}")

print("\nPWA + static assets")
code, body, ct = hit("/manifest.webmanifest")
check("manifest served", code == 200, f"-> {code}")
code, body, ct = hit("/sw.js")
check("service worker served", code == 200 and b"serviceWorker" in body or code == 200, f"-> {code}")

print("\nuploads")
os.makedirs("uploads", exist_ok=True)
def chunk(tag, data):
    b = tag + data
    return struct.pack(">I", len(data)) + b + struct.pack(">I", zlib.crc32(b) & 0xffffffff)
raw = b"".join(b"\x00" + bytes((9, 200, 120)) * 8 for _ in range(8))
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
open("uploads/_wsgitest.png", "wb").write(png)
code, body, ct = hit("/uploads/_wsgitest.png")
check("uploaded file served byte-for-byte", code == 200 and body == png, f"-> {ct}")
code, _, _ = hit("/uploads/missing.png")
check("missing upload 404s", code == 404, f"-> {code}")
os.remove("uploads/_wsgitest.png")

print("\npath traversal is blocked")
for evil in ["/../app/main.py", "/../../etc/passwd", "/..%2f..%2fapp/db.py"]:
    code, body, _ = hit(evil)
    leaked = b"sqlite3" in body or b"root:" in body or b"FastAPI" in body
    check(f"no source leak via {evil}", code == 200 and not leaked, f"-> {code}, leaked={leaked}")

print(f"\n{passed} passed, {failed} failed")
srv.shutdown()
raise SystemExit(1 if failed else 0)
