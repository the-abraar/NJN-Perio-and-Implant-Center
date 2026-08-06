#!/usr/bin/env bash
# Deploys public/ to Firebase Hosting (njn-perio-implant-2026),
# which also serves the connected custom domain njndental.com.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/c/Program Files/nodejs:$PATH"
"/c/Program Files/nodejs/npx.cmd" -y firebase-tools deploy --only hosting --project njn-perio-implant-2026
