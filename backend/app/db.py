"""Database helpers: SQLite locally, PostgreSQL when DATABASE_URL is set.

No ORM - the app writes plain SQL with ``?`` placeholders and the Postgres
wrapper below translates the few dialect differences on the fly.
"""
import os
import re
import sqlite3
from contextlib import contextmanager

# The database lives next to the backend by default. On hosts like PythonAnywhere
# the code sits in ~/my_site/backend, so RASHAN_DATA_DIR can move it somewhere writable.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.environ.get("RASHAN_DATA_DIR", os.path.join(BACKEND_DIR, "uploads"))
DB_PATH = os.environ.get("RASHAN_DB_PATH", os.path.join(BACKEND_DIR, "grocery.db"))
# Hosts like Render have no persistent disk on the free plan, so a Postgres URL
# here keeps orders, customers and product photos across restarts.
DATABASE_URL = os.environ.get("DATABASE_URL", "")
USE_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS categories (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    slug   TEXT UNIQUE NOT NULL,
    name   TEXT NOT NULL,
    icon   TEXT NOT NULL,
    tagline TEXT
);

CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    brand       TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    price       REAL NOT NULL,
    mrp         REAL NOT NULL,
    unit        TEXT NOT NULL,
    rating      REAL NOT NULL DEFAULT 4.0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    reviews     INTEGER NOT NULL DEFAULT 0,
    stock       INTEGER NOT NULL DEFAULT 50,
    emoji       TEXT NOT NULL DEFAULT '\U0001F35E',
    image_url   TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#fef3c7',
    description TEXT NOT NULL DEFAULT '',
    highlights  TEXT NOT NULL DEFAULT '[]',
    bestseller  INTEGER NOT NULL DEFAULT 0,
    deal        INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no    TEXT UNIQUE NOT NULL,
    customer    TEXT NOT NULL,
    phone       TEXT NOT NULL DEFAULT '',
    address     TEXT NOT NULL,
    lat         REAL,
    lng         REAL,
    accuracy    REAL,
    items       TEXT NOT NULL,
    subtotal    REAL NOT NULL,
    delivery    REAL NOT NULL,
    total       REAL NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Order Confirmed',
    user_id     INTEGER,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    label      TEXT NOT NULL DEFAULT 'Home',
    address    TEXT NOT NULL,
    lat        REAL,
    lng        REAL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no   TEXT NOT NULL,
    status     TEXT NOT NULL,
    title      TEXT NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    source     TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    query      TEXT NOT NULL,
    results    INTEGER NOT NULL DEFAULT 0,
    user_id    INTEGER,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    phone      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    address    TEXT,
    lat        REAL,
    lng        REAL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
    name         TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    data         BLOB NOT NULL,
    created_at   TEXT NOT NULL
);
"""


def _pg_schema() -> str:
    return (SCHEMA.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            .replace(" REAL", " DOUBLE PRECISION")
            .replace(" BLOB", " BYTEA"))


def _pg_sql(sql: str, has_params: bool) -> str:
    # literal % must be doubled before ? becomes the psycopg %s placeholder
    # (only when parameters are sent - otherwise psycopg leaves % untouched);
    # LIKE is case-insensitive in SQLite, so keep that behaviour with ILIKE
    if has_params:
        sql = sql.replace("%", "%%").replace("?", "%s")
    return re.sub(r"LIKE", "ILIKE", sql)


class _PgConnection:
    """Gives a psycopg connection the small slice of the sqlite3 API the app uses."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        cur = self._conn.cursor()
        params = tuple(params)
        # no parameters -> simple protocol, which also allows multi-statement scripts
        cur.execute(_pg_sql(sql, bool(params)), params or None)
        return cur

    def executemany(self, sql, rows):
        cur = self._conn.cursor()
        cur.executemany(_pg_sql(sql, True), [tuple(r) for r in rows])
        return cur

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def connect():
    if USE_POSTGRES:
        import psycopg
        from psycopg.rows import dict_row

        return _PgConnection(psycopg.connect(DATABASE_URL, row_factory=dict_row))
    # the directory may not exist yet on a first run on a fresh host
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    conn = connect()
    try:
        if USE_POSTGRES:
            # the Postgres schema is created fresh with every column already in it
            conn.execute(_pg_schema())
        else:
            conn.executescript(SCHEMA)
            _migrate(conn)
        conn.commit()
    finally:
        conn.close()


def _table_columns(conn, table: str) -> set:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}


def _migrate(conn) -> None:
    """Add columns that were introduced after the database was first created."""
    if "status" not in _table_columns(conn, "orders"):
        conn.execute("ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'Order Confirmed'")
    if "user_id" not in _table_columns(conn, "orders"):
        conn.execute("ALTER TABLE orders ADD COLUMN user_id INTEGER")
    if "phone" not in _table_columns(conn, "orders"):
        conn.execute("ALTER TABLE orders ADD COLUMN phone TEXT NOT NULL DEFAULT ''")
    # geo columns: an exact pin makes the delivery agent's job far easier
    for name, ddl in (("lat", "REAL"), ("lng", "REAL"), ("accuracy", "REAL")):
        if name not in _table_columns(conn, "orders"):
            conn.execute(f"ALTER TABLE orders ADD COLUMN {name} {ddl}")
    for name in ("lat", "lng"):
        if name not in _table_columns(conn, "users"):
            conn.execute(f"ALTER TABLE users ADD COLUMN {name} REAL")
    # uploaded product photo; empty means the emoji placeholder is used instead
    if "image_url" not in _table_columns(conn, "products"):
        conn.execute("ALTER TABLE products ADD COLUMN image_url TEXT NOT NULL DEFAULT ''")