#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SITE_NAME="kiiltoloisto-fi"
SITE_ID="9753561d-0777-4b0c-a669-324e3d49b8ee"
DOMAIN="kiiltoloisto.fi"
WWW_DOMAIN="www.kiiltoloisto.fi"

echo -e "${GREEN}=== Netlify Deployment Fix Script ===${NC}"
echo -e "Site: ${SITE_NAME}"
echo -e "Domain: ${DOMAIN}"
echo -e "Site ID: ${SITE_ID}"
echo ""

# Step 1: Check Netlify CLI
echo -e "${YELLOW}Step 1: Checking Netlify CLI...${NC}"
if ! command -v netlify >/dev/null 2>&1; then
  echo "Installing Netlify CLI..."
  npm install -g netlify-cli
else
  echo "Netlify CLI is installed"
fi

# Step 2: Check authentication
echo -e "${YELLOW}Step 2: Checking Netlify authentication...${NC}"
if ! netlify status >/dev/null 2>&1; then
  echo "Please log in to Netlify..."
  netlify login
else
  echo "Already authenticated with Netlify"
fi

# Step 3: Install Netlify Next.js plugin
echo -e "${YELLOW}Step 3: Installing Netlify Next.js plugin...${NC}"
npm install --save-dev @netlify/plugin-nextjs

# Step 4: Fix netlify.toml configuration
echo -e "${YELLOW}Step 4: Updating netlify.toml configuration...${NC}"
cat > netlify.toml <<'EOF'
# Netlify Production Configuration
# Car Wash Booking System

[build]
  command = "npm install && npm run build"
  publish = ".next"
  functions = "netlify/functions"

[build.environment]
  NEXT_TELEMETRY_DISABLED = "1"
  NODE_VERSION = "18"

# Include the Next.js plugin
[[plugins]]
  package = "@netlify/plugin-nextjs"

# Environment URL configuration
[context.production.environment]
  NEXTAUTH_URL = "https://kiiltoloisto.fi"
  NEXT_PUBLIC_SITE_URL = "https://kiiltoloisto.fi"

[context.deploy-preview.environment]
  NEXTAUTH_URL = "${DEPLOY_PREVIEW_URL}"
  NEXT_PUBLIC_SITE_URL = "${DEPLOY_PREVIEW_URL}"

[context.branch-deploy.environment]
  NEXTAUTH_URL = "${DEPLOY_URL}"
  NEXT_PUBLIC_SITE_URL = "${DEPLOY_URL}"

# ==========================================
# SECURITY HEADERS
# ==========================================

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"

    # Simplified CSP for initial deployment
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://js.stripe.com https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"

# API Headers
[[headers]]
  for = "/api/*"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
    X-Robots-Tag = "noindex, nofollow"

# Static Assets
[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# ==========================================
# REDIRECTS & REWRITES
# ==========================================

# Remove trailing slashes
[[redirects]]
  from = "/*/"
  to = "/:splat"
  status = 301

# Redirect www to non-www
[[redirects]]
  from = "https://www.kiiltoloisto.fi/*"
  to = "https://kiiltoloisto.fi/:splat"
  status = 301
  force = true

# API Routes to Netlify Functions
[[redirects]]
  from = "/api/services"
  to = "/.netlify/functions/services-index"
  status = 200
  force = true

[[redirects]]
  from = "/api/services/:id"
  to = "/.netlify/functions/services-id"
  status = 200
  force = true

[[redirects]]
  from = "/api/bookings/availability"
  to = "/.netlify/functions/bookings-availability"
  status = 200
  force = true

[[redirects]]
  from = "/api/bookings/create"
  to = "/.netlify/functions/bookings-create"
  status = 200
  force = true

[[redirects]]
  from = "/api/bookings/:id"
  to = "/.netlify/functions/bookings-id"
  status = 200
  force = true

[[redirects]]
  from = "/api/payment/create-session"
  to = "/.netlify/functions/payment-create-session"
  status = 200
  force = true

[[redirects]]
  from = "/api/payment/webhook"
  to = "/.netlify/functions/payment-webhook"
  status = 200
  force = true

# ==========================================
# FUNCTIONS CONFIGURATION
# ==========================================

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[functions."*"]
  timeout = 10

# ==========================================
# FORMS
# ==========================================

[forms]
  honeypot = "_gotcha"
EOF

echo "netlify.toml updated successfully"

# Step 5: Link the site
echo -e "${YELLOW}Step 5: Linking to Netlify site...${NC}"
netlify link --id "${SITE_ID}" || echo "Site already linked"

# Step 6: Set environment variables
echo -e "${YELLOW}Step 6: Setting environment variables...${NC}"

# Core variables
netlify env:set NEXTAUTH_URL "https://kiiltoloisto.fi" --scope builds deploys functions runtime
netlify env:set NEXT_PUBLIC_SITE_URL "https://kiiltoloisto.fi" --scope builds deploys functions runtime

# Get existing environment variables
echo "Fetching existing environment variables..."
ENV_VARS=$(netlify env:list --json 2>/dev/null || echo "{}")

# Check if critical variables are set
if echo "$ENV_VARS" | grep -q "DATABASE_URL"; then
  echo "DATABASE_URL is already set"
else
  echo -e "${RED}WARNING: DATABASE_URL is not set. Please set it manually.${NC}"
fi

if echo "$ENV_VARS" | grep -q "NEXTAUTH_SECRET"; then
  echo "NEXTAUTH_SECRET is already set"
else
  echo -e "${RED}WARNING: NEXTAUTH_SECRET is not set. Generating one...${NC}"
  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  netlify env:set NEXTAUTH_SECRET "$NEXTAUTH_SECRET" --scope builds deploys functions runtime
  echo "NEXTAUTH_SECRET generated and set"
fi

# Step 7: Build the project locally
echo -e "${YELLOW}Step 7: Building project locally...${NC}"
npm install
npm run build

# Step 8: Deploy to Netlify
echo -e "${YELLOW}Step 8: Deploying to Netlify...${NC}"

# Create a production deployment
netlify deploy --prod --dir=.next --message="Fix 403 error - Production deployment with correct configuration"

# Step 9: Get deployment status
echo -e "${YELLOW}Step 9: Checking deployment status...${NC}"
DEPLOY_URL=$(netlify status --json 2>/dev/null | grep -o '"url":"[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ -n "$DEPLOY_URL" ]; then
  echo -e "${GREEN}Deployment URL: ${DEPLOY_URL}${NC}"

  # Check if site is accessible
  echo "Testing site accessibility..."
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "$DEPLOY_URL" --max-time 10)

  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Site is accessible (HTTP $HTTP_STATUS)${NC}"
  else
    echo -e "${RED}✗ Site returned HTTP $HTTP_STATUS${NC}"
  fi
else
  echo -e "${YELLOW}Could not determine deployment URL${NC}"
fi

# Step 10: Set up domains
echo -e "${YELLOW}Step 10: Configuring domains...${NC}"
netlify domains:add "$DOMAIN" || echo "Domain already configured"
netlify domains:add "$WWW_DOMAIN" || echo "WWW domain already configured"

echo -e "${GREEN}=== Deployment Fix Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Verify DNS settings point to Netlify"
echo "2. Check https://${DOMAIN}"
echo "3. Test booking functionality"
echo "4. Monitor Netlify dashboard for any errors"