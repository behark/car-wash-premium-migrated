#!/usr/bin/env bash
set -euo pipefail

SITE_URL="${1:-}" # pass full https://... URL
if [[ -z "$SITE_URL" ]]; then
  echo "Usage: $0 https://your-site.netlify.app" >&2
  exit 1
fi

echo "Verifying deployment at $SITE_URL"
paths=( "/" "/fi" "/fi/about" "/fi/services" "/api/health" )

status_fail=0
for p in "${paths[@]}"; do
  url="$SITE_URL$p"
  # -L to follow redirect for root -> /fi
  code=$(curl -sk -o /dev/null -w "%{http_code}" -L "$url") || true
  echo "$code $p"
  if [[ "$p" == "/api/health" ]]; then
    if [[ "$code" != "200" ]]; then status_fail=1; fi
  else
    case "$code" in
      200|301|302) : ;; 
      *) status_fail=1 ;;
    esac
  fi
done

if [[ $status_fail -ne 0 ]]; then
  echo "One or more checks failed." >&2
  exit 2
fi

echo "All checks passed."
