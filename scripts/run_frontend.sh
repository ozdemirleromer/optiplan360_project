#!/usr/bin/env bash
set -e

cd frontend
if [ ! -d "node_modules" ]; then
  npm install
fi
# Prefer npm run dev (vite) if present
if npm run | grep -q "dev"; then
  npm run dev
else
  npm start
fi
