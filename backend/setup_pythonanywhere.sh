#!/usr/bin/env bash
# One-shot setup for PythonAnywhere (free plan).
#
# Paste this into a Bash console on PythonAnywhere. It creates the virtualenv,
# installs the backend, builds the frontend, and prints the remaining Web-tab steps.
#
#   bash setup_pythonanywhere.sh
#
set -euo pipefail

USERNAME="hellkum12kumar09"
SITE="$HOME/my_site"
VENV="$HOME/.virtualenvs/rashan"
REPO="${REPO:-https://github.com/$USERNAME/myshop.git}"

echo "==> 1/5  fetching the project into $SITE"
mkdir -p "$SITE"
cd "$SITE"
if [ -d .git ]; then
  git pull
else
  git clone "$REPO" myshop && cd myshop
fi
cd "$SITE/myshop"

echo "==> 2/5  creating the virtualenv at $VENV"
mkvirtualenv --overwrite rashan || mkvirtualenv rashan
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "==> 3/5  building the frontend (Node is available on paid plans only,"
echo "         so upload a prebuilt dist/ if this step fails)"
if command -v node >/dev/null 2>&1; then
  cd frontend
  npm install
  npm run build
  cd ..
else
  echo "  node not found - skipping."
fi

echo "==> 4/5  creating the data directories"
mkdir -p backend/uploads

echo "==> 5/5  checking the app imports cleanly"
cd backend
"$VENV/bin/python" -c "import wsgi; print('wsgi OK')"

cat <<EOF

============================================================
Almost done. Now finish in the PythonAnywhere web dashboard:

1. Web tab  ->  Add a new web app  ->  Manual configuration
2. Source code  : /home/$USERNAME/my_site/myshop/backend/pythonanywhere_wsgi.py
   Working dir  : /home/$USERNAME/my_site/myshop/backend
   Virtualenv   : $VENV
3. Press the green "Reload" button.
4. Your site will be at  https://$USERNAME.pythonanywhere.com

Then set the secrets - Web tab -> Environment variables:
   RASHAN_SECRET      = a long random string  (paste from the command below)
   RASHAN_WHATSAPP    = your WhatsApp number with country code, e.g. 919999999999

   python -c "import secrets; print(secrets.token_urlsafe(48))"
============================================================
EOF