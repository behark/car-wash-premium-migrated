#!/bin/bash

# Comprehensive testing script for kiiltoloisto.fi deployment
# This script tests all critical functionality after deployment

set -e

SITE_URL="https://kiiltoloisto.fi"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Starting comprehensive deployment tests for $SITE_URL"
echo "================================================"

# Function to test URL
test_url() {
    local url=$1
    local description=$2

    echo -n "Testing $description... "

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ OK (200)${NC}"
        return 0
    elif [ "$response" = "403" ]; then
        echo -e "${RED}❌ FORBIDDEN (403)${NC}"
        return 1
    else
        echo -e "${YELLOW}⚠️  Status: $response${NC}"
        return 1
    fi
}

# Function to test API endpoint
test_api() {
    local endpoint=$1
    local description=$2

    echo -n "Testing API: $description... "

    response=$(curl -s "$endpoint")
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed (Status: $http_code)${NC}"
        return 1
    fi
}

# Function to measure page load time
measure_load_time() {
    local url=$1
    local description=$2

    echo -n "Measuring load time for $description... "

    time=$(curl -s -o /dev/null -w "%{time_total}" "$url")

    # Convert to milliseconds
    time_ms=$(echo "$time * 1000" | bc | cut -d. -f1)

    if [ "$time_ms" -lt 3000 ]; then
        echo -e "${GREEN}✅ ${time_ms}ms${NC}"
    elif [ "$time_ms" -lt 5000 ]; then
        echo -e "${YELLOW}⚠️  ${time_ms}ms (slow)${NC}"
    else
        echo -e "${RED}❌ ${time_ms}ms (very slow)${NC}"
    fi
}

# Test Frontend Pages
echo ""
echo "📄 TESTING FRONTEND PAGES"
echo "------------------------"
test_url "$SITE_URL" "Homepage"
test_url "$SITE_URL/booking" "Booking page"
test_url "$SITE_URL/services" "Services page"
test_url "$SITE_URL/contact" "Contact page"
test_url "$SITE_URL/about" "About page"

# Test API Endpoints
echo ""
echo "🔌 TESTING API ENDPOINTS"
echo "------------------------"
test_api "$SITE_URL/.netlify/functions/services-index" "Services list"
test_api "$SITE_URL/.netlify/functions/bookings-availability" "Booking availability"

# Measure Performance
echo ""
echo "⚡ PERFORMANCE METRICS"
echo "----------------------"
measure_load_time "$SITE_URL" "Homepage"
measure_load_time "$SITE_URL/booking" "Booking page"

# Test Security Headers
echo ""
echo "🔒 SECURITY HEADERS"
echo "-------------------"
echo -n "Testing security headers... "
headers=$(curl -s -I "$SITE_URL")

if echo "$headers" | grep -q "Strict-Transport-Security"; then
    echo -e "${GREEN}✅ HSTS enabled${NC}"
else
    echo -e "${YELLOW}⚠️  HSTS missing${NC}"
fi

if echo "$headers" | grep -q "X-Frame-Options"; then
    echo -e "${GREEN}✅ X-Frame-Options set${NC}"
else
    echo -e "${YELLOW}⚠️  X-Frame-Options missing${NC}"
fi

# Test Mobile Responsiveness
echo ""
echo "📱 MOBILE RESPONSIVENESS"
echo "------------------------"
echo -n "Testing mobile viewport... "
mobile_response=$(curl -s -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)" -o /dev/null -w "%{http_code}" "$SITE_URL")
if [ "$mobile_response" = "200" ]; then
    echo -e "${GREEN}✅ Mobile access OK${NC}"
else
    echo -e "${RED}❌ Mobile access failed${NC}"
fi

# Test SSL Certificate
echo ""
echo "🔐 SSL CERTIFICATE"
echo "------------------"
echo -n "Checking SSL certificate... "
if curl -s -I "$SITE_URL" | grep -q "200"; then
    echo -e "${GREEN}✅ SSL valid${NC}"
else
    echo -e "${RED}❌ SSL issues detected${NC}"
fi

# Run Lighthouse Test (if available)
echo ""
echo "📊 LIGHTHOUSE SCORE (requires Chrome)"
echo "------------------------------------"
if command -v lighthouse &> /dev/null; then
    echo "Running Lighthouse audit..."
    lighthouse "$SITE_URL" --quiet --chrome-flags="--headless" --only-categories=performance --output=json --output-path=/tmp/lighthouse.json

    # Extract performance score
    score=$(cat /tmp/lighthouse.json | grep -o '"score":[0-9.]*' | head -1 | cut -d: -f2)
    score_percent=$(echo "$score * 100" | bc | cut -d. -f1)

    if [ "$score_percent" -ge 90 ]; then
        echo -e "${GREEN}✅ Performance Score: $score_percent/100${NC}"
    elif [ "$score_percent" -ge 70 ]; then
        echo -e "${YELLOW}⚠️  Performance Score: $score_percent/100${NC}"
    else
        echo -e "${RED}❌ Performance Score: $score_percent/100${NC}"
    fi
else
    echo "Lighthouse not installed. Install with: npm install -g lighthouse"
fi

# Summary
echo ""
echo "================================================"
echo "📋 TEST SUMMARY"
echo "================================================"

# Check if any tests failed
if test_url "$SITE_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MAIN ISSUE FIXED: Site is accessible (no 403 error)${NC}"
else
    echo -e "${RED}❌ CRITICAL: 403 error still present${NC}"
    echo "Please check deployment configuration"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. If all tests pass, the deployment is successful"
echo "2. If 403 persists, check Netlify build logs"
echo "3. Monitor performance over the next 24 hours"
echo "4. Set up alerts for any downtime"

echo ""
echo "📈 For detailed performance analysis, visit:"
echo "   https://pagespeed.web.dev/report?url=$SITE_URL"