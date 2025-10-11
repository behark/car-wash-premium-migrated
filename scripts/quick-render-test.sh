#!/bin/bash

# 🚀 Quick Render Deployment Test
# Fast test to check if your Render deployment is working

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RENDER_URL=""

# Usage function
usage() {
    echo "Usage: $0 <render-url>"
    echo "  render-url: Your Render service URL (e.g., https://your-app.onrender.com)"
    echo ""
    echo "Examples:"
    echo "  $0 https://car-wash-booking.onrender.com"
    exit 1
}

# Validate input
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: Render URL is required${NC}"
    usage
fi

RENDER_URL="$1"
# Remove trailing slash
RENDER_URL=$(echo "$RENDER_URL" | sed 's/\/$//')

echo -e "${BLUE}🚀 Quick Render Deployment Test${NC}"
echo -e "${BLUE}===============================${NC}"
echo -e "Testing: ${YELLOW}$RENDER_URL${NC}"
echo ""

# Function to test endpoint
test_endpoint() {
    local url="$1"
    local name="$2"
    local expected_status="${3:-200}"

    echo -n "Testing $name... "

    local response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" -o /dev/null "$url" 2>/dev/null || echo "HTTPSTATUS:000;TIME:0")
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local response_time=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)

    if [ "$http_status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (${response_time}s)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $http_status)"
        return 1
    fi
}

# Test basic connectivity
echo -e "${YELLOW}🌐 Basic Tests${NC}"
test_homepage=$(test_endpoint "$RENDER_URL" "Homepage" && echo "pass" || echo "fail")

# Test health endpoint
test_health=$(test_endpoint "$RENDER_URL/api/health" "Health Check" && echo "pass" || echo "fail")

echo ""

# If health check passes, get detailed health info
if [ "$test_health" = "pass" ]; then
    echo -e "${YELLOW}🏥 Health Check Details${NC}"

    health_data=$(curl -s "$RENDER_URL/api/health" 2>/dev/null || echo '{}')

    if echo "$health_data" | jq . >/dev/null 2>&1; then
        # Parse health data
        overall_status=$(echo "$health_data" | jq -r '.status // "unknown"')
        db_status=$(echo "$health_data" | jq -r '.checks.database.status // "unknown"')
        redis_status=$(echo "$health_data" | jq -r '.checks.redis.status // "unknown"')
        services_status=$(echo "$health_data" | jq -r '.checks.services.status // "unknown"')
        uptime=$(echo "$health_data" | jq -r '.uptime // "unknown"')

        # Display results with colors
        case "$overall_status" in
            "healthy") echo -e "Overall Status: ${GREEN}✅ $overall_status${NC}" ;;
            "degraded") echo -e "Overall Status: ${YELLOW}⚠️  $overall_status${NC}" ;;
            "unhealthy") echo -e "Overall Status: ${RED}❌ $overall_status${NC}" ;;
            *) echo -e "Overall Status: ${YELLOW}❓ $overall_status${NC}" ;;
        esac

        case "$db_status" in
            "pass") echo -e "Database: ${GREEN}✅ Connected${NC}" ;;
            "warn") echo -e "Database: ${YELLOW}⚠️  Warning${NC}" ;;
            "fail") echo -e "Database: ${RED}❌ Failed${NC}" ;;
            *) echo -e "Database: ${YELLOW}❓ $db_status${NC}" ;;
        esac

        case "$redis_status" in
            "pass") echo -e "Redis Cache: ${GREEN}✅ Connected${NC}" ;;
            "warn") echo -e "Redis Cache: ${YELLOW}⚠️  Warning${NC}" ;;
            "fail") echo -e "Redis Cache: ${RED}❌ Failed${NC}" ;;
            *) echo -e "Redis Cache: ${YELLOW}❓ $redis_status${NC}" ;;
        esac

        case "$services_status" in
            "pass") echo -e "Services: ${GREEN}✅ Configured${NC}" ;;
            "warn") echo -e "Services: ${YELLOW}⚠️  Partially configured${NC}" ;;
            "fail") echo -e "Services: ${RED}❌ Not configured${NC}" ;;
            *) echo -e "Services: ${YELLOW}❓ $services_status${NC}" ;;
        esac

        echo "Uptime: ${uptime}s"
    else
        echo -e "${RED}❌ Health endpoint returned invalid JSON${NC}"
    fi
else
    echo -e "${RED}❌ Health check failed - skipping detailed analysis${NC}"
fi

echo ""

# Test API endpoints
echo -e "${YELLOW}🔌 API Tests${NC}"
test_services=$(test_endpoint "$RENDER_URL/api/services" "Services API" && echo "pass" || echo "fail")
test_availability=$(test_endpoint "$RENDER_URL/api/bookings/availability" "Availability API" && echo "pass" || echo "fail")

echo ""

# Test static files
echo -e "${YELLOW}📱 Static Files${NC}"
test_manifest=$(test_endpoint "$RENDER_URL/manifest.json" "PWA Manifest" && echo "pass" || echo "fail")
test_sw=$(test_endpoint "$RENDER_URL/sw.js" "Service Worker" && echo "pass" || echo "fail")

echo ""

# Summary
echo -e "${BLUE}📊 Test Summary${NC}"
echo -e "${BLUE}===============${NC}"

tests=("$test_homepage" "$test_health" "$test_services" "$test_availability" "$test_manifest" "$test_sw")
test_names=("Homepage" "Health Check" "Services API" "Availability API" "PWA Manifest" "Service Worker")
passed=0
total=${#tests[@]}

for i in "${!tests[@]}"; do
    if [ "${tests[$i]}" = "pass" ]; then
        echo -e "${test_names[$i]}: ${GREEN}✅ PASS${NC}"
        ((passed++))
    else
        echo -e "${test_names[$i]}: ${RED}❌ FAIL${NC}"
    fi
done

echo ""
echo -e "Results: ${GREEN}$passed${NC}/${total} tests passed"

# Overall result
if [ $passed -eq $total ]; then
    echo -e "${GREEN}🎉 All tests passed! Your Render deployment is working perfectly!${NC}"
    exit 0
elif [ $passed -ge $((total * 2 / 3)) ]; then
    echo -e "${YELLOW}⚠️  Most tests passed, but some issues need attention.${NC}"
    echo -e "💡 Run: ${YELLOW}./scripts/check-render-config.sh -u $RENDER_URL${NC} for detailed analysis"
    exit 1
else
    echo -e "${RED}❌ Multiple issues detected with your deployment.${NC}"
    echo -e "💡 Check your Render service logs and environment variables."
    echo -e "💡 Run: ${YELLOW}./scripts/render-env-checker.sh${NC} to verify configuration"
    exit 1
fi