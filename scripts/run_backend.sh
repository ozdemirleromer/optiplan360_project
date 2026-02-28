#!/usr/bin/env bash
set -euo pipefail

# Create and use backend/.venv, install dependencies, then run uvicorn.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
VENV_DIR="${BACKEND_DIR}/.venv"
VENV_PYTHON="${VENV_DIR}/bin/python"

if [ ! -x "${VENV_PYTHON}" ]; then
  pushd "${BACKEND_DIR}" >/dev/null
  python -m venv .venv
  popd >/dev/null
fi

"${VENV_PYTHON}" -m pip install --upgrade pip
"${VENV_PYTHON}" -m pip install -r "${BACKEND_DIR}/requirements.txt"
"${VENV_PYTHON}" -m pip install -r "${BACKEND_DIR}/requirements-dev.txt"

pushd "${BACKEND_DIR}" >/dev/null
"${VENV_PYTHON}" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
popd >/dev/null
