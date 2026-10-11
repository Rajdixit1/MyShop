"""Authentication helpers: password hashing (PBKDF2) and bearer tokens.

Tokens are HMAC-signed strings (user_id:role:expiry) so no session store is needed.
"""

import base64
import hashlib
import hmac
import os
import time

SECRET = os.environ.get("RASHAN_SECRET", "rashan-dukaan-demo-secret-key").encode()
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days
_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"{_ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        iterations, salt_b64, digest_b64 = stored.split("$")
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iterations))
    return hmac.compare_digest(actual, expected)


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def create_token(user_id: int, role: str) -> str:
    payload = f"{user_id}:{role}:{int(time.time()) + TOKEN_TTL_SECONDS}"
    body = _b64e(payload.encode())
    signature = _b64e(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
    return f"{body}.{signature}"


def decode_token(token: str) -> tuple[int, str] | None:
    """Returns (user_id, role) or None when the token is invalid/expired."""
    try:
        body, signature = token.split(".")
    except ValueError:
        return None
    expected = _b64e(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        raw = _b64d(body).decode()
        user_id, role, expiry = raw.split(":")
        if int(expiry) < time.time():
            return None
        return int(user_id), role
    except (ValueError, UnicodeDecodeError):
        return None