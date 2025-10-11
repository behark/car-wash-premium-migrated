#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/netlify-deploy.sh "Site Name" "prod-domain(optional)"

SITE_NAME=${1:-"Car Wash Booking"}
CUSTOM_DOMAIN=${2:-""}

if ! command -v netlify >/dev/null 2>&1; then
  echo "Installing Netlify CLI..."
  npm install -g netlify-cli
fi

echo "Logging into Netlify (if needed)..."
netlify status >/dev/null 2>&1 || netlify login

echo "Creating site '${SITE_NAME}' (or using existing)..."
# Use Netlify API to list sites (JSON) and find by name
SITE_ID=$(netlify api listSites 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const a=JSON.parse(s);const f=(Array.isArray(a)?a:[]).find(x=>x.name==='${SITE_NAME}');console.log(f?f.id:'')}catch(e){console.error(e.message);process.exit(0)}})")
if [ -z "$SITE_ID" ]; then
  # Create site via API to get JSON reliably
  CREATE_PAYLOAD=$(printf '{"name":"%s"}' "${SITE_NAME}")
  SITE_ID=$(netlify api createSite --data "$CREATE_PAYLOAD" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.id||j.site_id||'')}catch(e){console.error(e.message)}})")
  if [ -z "$SITE_ID" ]; then
    echo "Failed to create site via API. Please run 'netlify init' to create/link." >&2
    exit 1
  fi
  echo "Created site with id: $SITE_ID"
else
  echo "Using existing site id: $SITE_ID"
fi

echo "Linking local folder to Netlify site..."
netlify link --id "$SITE_ID"

echo "Pushing env vars..."
# Read local .env.local or .env if present
ENV_FILE=".env.local"
[ -f .env.local ] || ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  # Export NEXT_PUBLIC_* and server vars
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | xargs) || true
fi

# Required envs (set defaults if unset)
: "${DATABASE_URL:=file:./prisma/dev.db}"
: "${NEXTAUTH_URL:=http://localhost:3000}"

# Set envs on Netlify
netlify env:set DATABASE_URL "$DATABASE_URL"
netlify env:set NEXTAUTH_URL "$NEXTAUTH_URL"
[ -n "${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-}" ] && netlify env:set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" || true
[ -n "${NEXT_PUBLIC_HERO_IMAGE:-}" ] && netlify env:set NEXT_PUBLIC_HERO_IMAGE "$NEXT_PUBLIC_HERO_IMAGE" || true
[ -n "${NEXTAUTH_SECRET:-}" ] && netlify env:set NEXTAUTH_SECRET "$NEXTAUTH_SECRET" || true
[ -n "${SENDGRID_API_KEY:-}" ] && netlify env:set SENDGRID_API_KEY "$SENDGRID_API_KEY" || true
[ -n "${TWILIO_ACCOUNT_SID:-}" ] && netlify env:set TWILIO_ACCOUNT_SID "$TWILIO_ACCOUNT_SID" || true
[ -n "${TWILIO_AUTH_TOKEN:-}" ] && netlify env:set TWILIO_AUTH_TOKEN "$TWILIO_AUTH_TOKEN" || true
[ -n "${TWILIO_FROM:-}" ] && netlify env:set TWILIO_FROM "$TWILIO_FROM" || true
[ -n "${STRIPE_SECRET_KEY:-}" ] && netlify env:set STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY" || true

echo "Ensuring Netlify Next.js plugin is configured..."
[ -f netlify.toml ] || cat > netlify.toml <<'EOF'
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
EOF

echo "Building project via Netlify (enables Next runtime)..."
npm ci || npm install
netlify build

if [ -n "$CUSTOM_DOMAIN" ]; then
  echo "Setting custom domain: $CUSTOM_DOMAIN"
  # Prefer CLI domains:add; ignore errors if domain exists or requires DNS verification
  netlify domains:add "$CUSTOM_DOMAIN" --site "$SITE_ID" || true
fi

echo "Deploying to production from .netlify output..."
netlify deploy --dir .netlify --prod --message "Automated deploy"

echo "Done. Site URL:"
netlify open:site --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.url||'See Netlify dashboard');}catch(e){console.log('See Netlify dashboard')}})"