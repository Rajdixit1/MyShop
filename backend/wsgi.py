"""WSGI entry point for hosts that only support WSGI (PythonAnywhere free tier).

Uvicorn serves the ASGI app directly during development, but a WSGI host needs a
WSGI callable. a2wsgi's ASGIMiddleware adapts the ASGI app so the whole FastAPI
surface - routes, file uploads, static files - keeps working unchanged.

Note the direction: ASGIMiddleware turns an *ASGI* app into a *WSGI* one, which is
what we need here. (WSGIMiddleware is the opposite and would not work.)

PythonAnywhere's WSGI config file should import `application` from here.
"""
from a2wsgi import ASGIMiddleware

from app.main import app, on_startup

# a2wsgi does not run ASGI startup events, so create tables (including ones
# added in newer versions, like the product photo table) and seed data here.
on_startup()

# Served by the host's WSGI handler.
application = ASGIMiddleware(app)