#!/bin/zsh
set -e
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python ]]; then
  print "Please follow the README setup steps first."
  read -r "?Press Return to close."
  exit 1
fi
exec .venv/bin/python -m streamlit run app.py
