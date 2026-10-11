"""Verifies the RASHAN_ADMIN_PASSWORD override used on public deployments.

Boots a throwaway server on its own database and confirms the configured
password works while the demo one from the README is refused.

Run:  python test_admin_password.py
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

PORT = "8231"
BASE = f"http://127.0.0.1:{PORT}/api"
STRONG = "Str0ng-Deploy-Pass"

passed, failed = 0, 0


def check(label, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {label} {extra}")
    else:
        failed += 1
        print(f"  FAIL  {label} {extra}")


def login(password):
    body = json.dumps({"username": "admin", "password": password}).encode()
    req = urllib.request.Request(f"{BASE}/admin/login", data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return None


tmp = tempfile.mkdtemp()
env = dict(os.environ,
           RASHAN_DB_PATH=os.path.join(tmp, "grocery.db"),
           RASHAN_DATA_DIR=os.path.join(tmp, "uploads"),
           RASHAN_ADMIN_PASSWORD=STRONG)

server = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", PORT],
    env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)

try:
    for _ in range(60):
        if login("probe") is not None:
            break
        time.sleep(0.5)

    check("server started with the override", login("probe") in (200, 401))
    check("configured password works", login(STRONG) == 200, f"-> {login(STRONG)}")
    check("demo password from the README is refused", login("admin123") == 401,
          f"-> {login('admin123')}")
finally:
    server.terminate()
    try:
        server.wait(timeout=10)
    except Exception:
        server.kill()

print(f"\n{passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)