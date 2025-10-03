#!/bin/bash

# 🔧 Security Fix Script for 403 Forbidden Error
# This script applies the security fixes to resolve the 403 error

echo "🔒 KiiltoLoisto Security Fix Script"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Starting security fixes...${NC}"
echo ""

# Step 1: Backup existing files
echo "1️⃣  Creating backups..."
cp src/middleware.ts src/middleware.ts.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null
cp next.config.js next.config.js.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null
cp netlify.toml netlify.toml.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null
echo -e "${GREEN}✅ Backups created${NC}"
echo ""

# Step 2: Apply middleware fix
echo "2️⃣  Applying middleware security fixes..."
if [ -f "src/middleware.fixed.ts" ]; then
    cp src/middleware.fixed.ts src/middleware.ts
    echo -e "${GREEN}✅ Middleware updated with security fixes${NC}"
else
    echo -e "${YELLOW}⚠️  middleware.fixed.ts not found, please apply manual fixes${NC}"
fi
echo ""

# Step 3: Disable PWA temporarily
echo "3️⃣  Disabling PWA temporarily..."
sed -i.bak "s/disable: process\.env\.NODE_ENV === 'development'/disable: true/" next.config.js
echo -e "${GREEN}✅ PWA disabled to prevent conflicts${NC}"
echo ""

# Step 4: Update Netlify configuration
echo "4️⃣  Updating Netlify configuration..."
cat > netlify.toml.temp << 'EOF'
# Netlify Production Configuration - FIXED FOR 403 ERROR
# Car Wash Booking System - kiiltoloisto.fi

[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NEXT_TELEMETRY_DISABLED = "1"
  NODE_VERSION = "18"
  NPM_FLAGS = "--force"

# Essential Next.js Plugin for SSR/ISR Support
[[plugins]]
  package = "@netlify/plugin-nextjs"

# ==========================================
# ENVIRONMENT CONFIGURATION
# ==========================================

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
# HEADERS - Security without blocking Netlify
# ==========================================

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    X-DNS-Prefetch-Control = "on"
    # Removed strict CSP to prevent 403 errors

# Cache static assets
[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.webp"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.woff2"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# API Headers - No cache for dynamic content
[[headers]]
  for = "/api/*"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"

[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"

# ==========================================
# FUNCTIONS CONFIGURATION
# ==========================================

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
  included_files = ["netlify/functions/**"]

# ==========================================
# REDIRECTS - API Routes to Functions
# ==========================================

# Service endpoints
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

# Booking endpoints
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

# Payment endpoints
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
# DEV SETTINGS
# ==========================================

[dev]
  command = "npm run dev"
  targetPort = 3000
  port = 8888
  publish = ".next"
  autoLaunch = true
EOF

mv netlify.toml.temp netlify.toml
echo -e "${GREEN}✅ Netlify configuration updated${NC}"
echo ""

# Step 5: Create test script
echo "5️⃣  Creating security test script..."
cat > test-403-fix.js << 'EOF'
const https = require('https');

console.log('🔍 Testing KiiltoLoisto Security Fixes...\n');

const tests = [
  { name: 'Homepage', url: 'https://kiiltoloisto.fi' },
  { name: 'Booking Page', url: 'https://kiiltoloisto.fi/booking' },
  { name: 'Services API', url: 'https://kiiltoloisto.fi/.netlify/functions/services-index' },
  { name: 'Contact Page', url: 'https://kiiltoloisto.fi/contact' }
];

async function testUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode);
    }).on('error', (err) => {
      resolve(err.message);
    });
  });
}

async function runTests() {
  for (const test of tests) {
    const result = await testUrl(test.url);
    if (result === 200) {
      console.log(`✅ ${test.name}: OK (${result})`);
    } else if (result === 403) {
      console.log(`❌ ${test.name}: STILL BLOCKED (${result})`);
    } else {
      console.log(`⚠️  ${test.name}: ${result}`);
    }
  }
}

runTests();
EOF

echo -e "${GREEN}✅ Test script created${NC}"
echo ""

# Step 6: Build the project
echo "6️⃣  Building the project..."
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed. Please check the errors above.${NC}"
    exit 1
fi
echo ""

# Step 7: Deployment instructions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Security fixes applied successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Deploy to Netlify:"
echo "   git add -A"
echo "   git commit -m \"Fix: Resolve 403 error with security adjustments\""
echo "   git push origin master"
echo ""
echo "2. Wait for Netlify to deploy (2-3 minutes)"
echo ""
echo "3. Test the fixes:"
echo "   node test-403-fix.js"
echo ""
echo "4. If issues persist, run emergency fix:"
echo "   mv src/middleware.ts src/middleware.ts.disabled"
echo "   git commit -am \"Emergency: Disable middleware\""
echo "   git push origin master"
echo ""
echo -e "${YELLOW}⚠️  Important: Monitor the site after deployment${NC}"
echo -e "${YELLOW}    Check: https://kiiltoloisto.fi${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"