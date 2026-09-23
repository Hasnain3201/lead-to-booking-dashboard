#!/bin/zsh
set -e
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python ]]; then
  print "Please follow the README setup steps first."
  read -r "?Press Return to close."
  exit 1
fi
if [[ ! -f frontend/dist/index.html ]]; then
  if ! command -v npm >/dev/null; then
    print "Node.js 20.19+ or 22.12+ is needed once to build the interface. See the README."
    read -r "?Press Return to close."
    exit 1
  fi
  print "Building the interface for the first time..."
  npm --prefix frontend ci
  npm --prefix frontend run build
fi
exec .venv/bin/python serve.py
