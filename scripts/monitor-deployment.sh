#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SITE_URL="https://kiiltoloisto.fi"
SITE_ID="9753561d-0777-4b0c-a669-324e3d49b8ee"

echo -e "${BLUE}=== Netlify Deployment Monitor ===${NC}"
echo -e "Site: ${SITE_URL}"
echo -e "Site ID: ${SITE_ID}"
echo ""

# Check 1: HTTP Status
echo -e "${YELLOW}1. Checking HTTP Status...${NC}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "${SITE_URL}" --max-time 10 || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ Site is accessible (HTTP $HTTP_STATUS)${NC}"
elif [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
  echo -e "${YELLOW}⚠ Site is redirecting (HTTP $HTTP_STATUS)${NC}"
  REDIRECT_URL=$(curl -s -I "${SITE_URL}" --max-time 5 | grep -i location | head -1 | cut -d' ' -f2 | tr -d '\r')
  echo -e "  Redirect to: ${REDIRECT_URL}"
elif [ "$HTTP_STATUS" = "403" ]; then
  echo -e "${RED}✗ Access Forbidden (HTTP 403)${NC}"
  echo -e "  Possible causes:"
  echo -e "  - Missing index.html or default page"
  echo -e "  - Incorrect publish directory"
  echo -e "  - Security policy blocking access"
elif [ "$HTTP_STATUS" = "404" ]; then
  echo -e "${RED}✗ Page Not Found (HTTP 404)${NC}"
  echo -e "  The deployment may not have completed correctly"
else
  echo -e "${RED}✗ Site returned HTTP $HTTP_STATUS${NC}"
fi

# Check 2: Latest Deployment Status
echo -e "\n${YELLOW}2. Latest Deployment Status...${NC}"
LATEST_DEPLOY=$(netlify api listSiteDeploys --data='{"site_id":"'${SITE_ID}'"}' 2>/dev/null | \
  python3 -c "import sys, json; d=json.load(sys.stdin)[0]; print(f\"State: {d.get('state')}\\nCreated: {d.get('created_at')[:19]}\\nID: {d.get('id')}\")" 2>/dev/null || echo "Unable to fetch")

echo "$LATEST_DEPLOY"

# Check 3: API Endpoints
echo -e "\n${YELLOW}3. Testing API Endpoints...${NC}"

API_ENDPOINTS=(
  "/api/services"
  "/api/bookings/availability"
  "/.netlify/functions/services-index"
  "/.netlify/functions/bookings-availability"
)

for endpoint in "${API_ENDPOINTS[@]}"; do
  ENDPOINT_URL="${SITE_URL}${endpoint}"
  API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${ENDPOINT_URL}" --max-time 5 || echo "000")

  if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "405" ]; then
    echo -e "${GREEN}✓ ${endpoint} (HTTP $API_STATUS)${NC}"
  else
    echo -e "${RED}✗ ${endpoint} (HTTP $API_STATUS)${NC}"
  fi
done

# Check 4: Environment Variables
echo -e "\n${YELLOW}4. Checking Environment Variables...${NC}"
ENV_CHECK=$(netlify env:list --json 2>/dev/null | python3 -c "
import sys, json
env = json.load(sys.stdin)
required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'NEXT_PUBLIC_SITE_URL']
for var in required:
    if var in env:
        value = env[var]
        if 'URL' in var and var != 'DATABASE_URL':
            print(f'✓ {var}: {value}')
        else:
            print(f'✓ {var}: [SET]')
    else:
        print(f'✗ {var}: [NOT SET]')
" 2>/dev/null || echo "Unable to check environment variables")

echo "$ENV_CHECK"

# Check 5: Build Status
echo -e "\n${YELLOW}5. Recent Build History...${NC}"
BUILD_HISTORY=$(netlify api listSiteDeploys --data='{"site_id":"'${SITE_ID}'"}' 2>/dev/null | \
  python3 -c "
import sys, json
deploys = json.load(sys.stdin)[:5]
for d in deploys:
    state = d.get('state')
    created = d.get('created_at')[:19] if d.get('created_at') else 'Unknown'
    if state == 'ready':
        print(f'✓ {state}: {created}')
    elif state == 'building':
        print(f'⚡ {state}: {created}')
    else:
        print(f'✗ {state}: {created}')
" 2>/dev/null || echo "Unable to fetch build history")

echo "$BUILD_HISTORY"

# Check 6: DNS Status
echo -e "\n${YELLOW}6. DNS Configuration...${NC}"
DNS_CHECK=$(dig +short kiiltoloisto.fi A 2>/dev/null | head -1)
if [ -n "$DNS_CHECK" ]; then
  echo -e "${GREEN}✓ DNS A Record: $DNS_CHECK${NC}"
else
  echo -e "${RED}✗ No DNS A Record found${NC}"
fi

# Summary
echo -e "\n${BLUE}=== Summary ===${NC}"
if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ Site is operational${NC}"
  echo -e "Next steps:"
  echo -e "- Test booking functionality"
  echo -e "- Monitor for any errors in production"
  echo -e "- Set up proper SendGrid API key"
elif [ "$HTTP_STATUS" = "403" ]; then
  echo -e "${RED}✗ Site has 403 Forbidden error${NC}"
  echo -e "Recommended actions:"
  echo -e "1. Check Netlify build logs for errors"
  echo -e "2. Verify publish directory contains index.html"
  echo -e "3. Check for any security policies blocking access"
  echo -e "4. Try rollback to last working deployment"
elif [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
  echo -e "${YELLOW}⚠ Site has redirect issue${NC}"
  echo -e "Recommended actions:"
  echo -e "1. Check netlify.toml redirect rules"
  echo -e "2. Verify domain configuration"
  echo -e "3. Clear browser cache and cookies"
else
  echo -e "${RED}✗ Site is not accessible${NC}"
  echo -e "Recommended actions:"
  echo -e "1. Check deployment status on Netlify dashboard"
  echo -e "2. Review build logs for errors"
  echo -e "3. Verify DNS configuration"
fi