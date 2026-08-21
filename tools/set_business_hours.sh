#!/usr/bin/env bash
#
# Update config/businessHours in Firestore.
#
# The booking grid reads this document at runtime and it OVERRIDES the
# defaultConfig fallback in public/script.js. Changing the hours in the repo
# alone does not change what the live site offers -- this script is the other
# half of that change.
#
# Auth: Application Default Credentials. The Firestore REST API needs a
# datastore-scoped token, which the firebase CLI's own login does not expose,
# so this uses gcloud ADC:
#
#     gcloud auth application-default login
#
# A PATCH with an updateMask is used rather than a write, so slotMinutes,
# offDays and anything else on the document are left untouched.
#
# Usage:
#   tools/set_business_hours.sh                 # show the current document
#   tools/set_business_hours.sh 17:00 22:00     # set the hours
#
set -euo pipefail

PROJECT="${FIREBASE_PROJECT:-njn-perio-implant-2026}"
DOC="projects/${PROJECT}/databases/(default)/documents/config/businessHours"
URL="https://firestore.googleapis.com/v1/${DOC}"

# Validate arguments before authenticating, so a typo is caught immediately
# rather than after a browser sign-in.
if [[ $# -gt 0 ]]; then
  START="$1"
  END="${2:?usage: set_business_hours.sh <workStart HH:MM> <workEnd HH:MM>}"
  for t in "$START" "$END"; do
    [[ "$t" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || {
      echo "not a 24-hour HH:MM time: $t" >&2; exit 2; }
  done
  [[ "$START" < "$END" ]] || { echo "workStart must precede workEnd" >&2; exit 2; }
fi

if ! TOKEN="$(gcloud auth application-default print-access-token 2>/dev/null)"; then
  cat >&2 <<'MSG'
No Application Default Credentials.

Run this once, then re-run this script:

    gcloud auth application-default login

Sign in as an account with write access to the Firebase project.
MSG
  exit 1
fi

show() {
  echo "--- config/businessHours ---"
  curl -sS -H "Authorization: Bearer ${TOKEN}" "${URL}" \
    | python3 -c '
import json,sys
d=json.load(sys.stdin)
if "error" in d:
    print("  error:", d["error"].get("message")); sys.exit(1)
for k,v in sorted(d.get("fields",{}).items()):
    kind,val=next(iter(v.items()))
    if kind=="arrayValue":
        val=[next(iter(x.values())) for x in val.get("values",[])]
    print(f"  {k:12} = {val}")
'
}

if [[ $# -eq 0 ]]; then
  show
  exit 0
fi

echo "before:"; show

curl -sS -X PATCH \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"fields\":{\"workStart\":{\"stringValue\":\"${START}\"},\"workEnd\":{\"stringValue\":\"${END}\"}}}" \
  "${URL}?updateMask.fieldPaths=workStart&updateMask.fieldPaths=workEnd" \
  > /dev/null

echo "after:"; show
