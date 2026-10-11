# PythonAnywhere WSGI configuration file.
#
# In the PythonAnywhere "Web" tab set:
#   Source code : /home/hellkum12kumar09/my_site/backend/pythonanywhere_wsgi.py
#   Working dir : /home/hellkum12kumar09/my_site/backend
#   Virtualenv  : /home/hellkum12kumar09/.virtualenvs/rashan
#
# Then press the green "Reload" button.

import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))

# Keep uploaded product photos beside the code so they survive web app reloads.
os.environ.setdefault("RASHAN_DATA_DIR", os.path.join(BASE, "uploads"))

# The backend imports its own "app" package, so the backend dir must be importable.
if BASE not in sys.path:
    sys.path.insert(0, BASE)

from wsgi import application  # noqa: E402  (path setup has to run first)