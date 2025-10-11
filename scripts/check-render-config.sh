#!/bin/bash

# 🔍 Render Configuration Verification Script
# Checks your Render deployment configuration and identifies issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RENDER_URL=""
VERBOSE=false

# Usage function
usage() {
    echo "Usage: $0 -u <render-url> [-v]"
    echo "  -u: Your Render service URL (e.g., https://your-app.onrender.com)"
    echo "  -v: Verbose output"
    echo ""
    echo "Examples:"
    echo "  $0 -u https://car-wash-booking.onrender.com"
    echo "  $0 -u https://car-wash-booking.onrender.com -v"
    exit 1
}

# Parse command line arguments
while getopts "u:vh" opt; do
    case $opt in
        u) RENDER_URL="$OPTARG" ;;
        v) VERBOSE=true ;;
        h) usage ;;
        *) usage ;;
    esac
done

# Validate required parameters
if [ -z "$RENDER_URL" ]; then
    echo -e "${RED}❌ Error: Render URL is required${NC}"
    usage
fi

# Remove trailing slash
RENDER_URL=$(echo "$RENDER_URL" | sed 's/\/$//')

# Header
echo -e "${BLUE}🔍 Render Configuration Verification${NC}"
echo -e "${BLUE}====================================${NC}"
echo -e "Target URL: ${YELLOW}$RENDER_URL${NC}"
echo ""

# Function to check HTTP status
check_endpoint() {
    local url="$1"
    local expected_status="$2"
    local description="$3"

    echo -n "Checking $description... "

    if [ "$VERBOSE" = true ]; then
        echo ""
        echo "  URL: $url"
    fi

    # Use curl to check the endpoint
    local response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" -o /tmp/curl_response "$url" 2>/dev/null || echo "HTTPSTATUS:000;TIME:0")
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local response_time=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)

    if [ "$http_status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (${http_status}, ${response_time}s)"
        if [ "$VERBOSE" = true ] && [ -f /tmp/curl_response ]; then
            echo "  Response preview:"
            head -c 200 /tmp/curl_response | sed 's/^/    /'
            echo ""
        fi
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Status: ${http_status}, Expected: ${expected_status})"
        if [ -f /tmp/curl_response ]; then
            echo "  Error details:"
            head -c 500 /tmp/curl_response | sed 's/^/    /'
            echo ""
        fi
        return 1
    fi
}

# Function to check JSON endpoint
check_json_endpoint() {
    local url="$1"
    local description="$2"
    local required_fields="$3"

    echo -n "Checking $description... "

    if [ "$VERBOSE" = true ]; then
        echo ""
        echo "  URL: $url"
    fi

    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url" 2>/dev/null || echo '{"error":"network_error"}HTTPSTATUS:000')
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local json_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')

    if [ "$http_status" = "200" ]; then
        # Check if response is valid JSON
        if echo "$json_body" | jq . >/dev/null 2>&1; then
            # Check required fields if provided
            if [ -n "$required_fields" ]; then
                local missing_fields=""
                for field in $required_fields; do
                    if ! echo "$json_body" | jq -e ".$field" >/dev/null 2>&1; then
                        missing_fields="$missing_fields $field"
                    fi
                done

                if [ -n "$missing_fields" ]; then
                    echo -e "${YELLOW}⚠️  WARN${NC} (Missing fields:$missing_fields)"
                    return 1
                else
                    echo -e "${GREEN}✅ PASS${NC}"
                    if [ "$VERBOSE" = true ]; then
                        echo "  Response:"
                        echo "$json_body" | jq . | sed 's/^/    /'
                    fi
                    return 0
                fi
            else
                echo -e "${GREEN}✅ PASS${NC}"
                if [ "$VERBOSE" = true ]; then
                    echo "  Response:"
                    echo "$json_body" | jq . | sed 's/^/    /'
                fi
                return 0
            fi
        else
            echo -e "${RED}❌ FAIL${NC} (Invalid JSON response)"
            return 1
        fi
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $http_status)"
        return 1
    fi
}

# Start verification
echo -e "${BLUE}📋 Running Configuration Checks${NC}"
echo ""

# Track results
total_checks=0
passed_checks=0

# 1. Basic connectivity
echo -e "${YELLOW}🌐 Basic Connectivity${NC}"
((total_checks++))
if check_endpoint "$RENDER_URL" "200" "Homepage"; then
    ((passed_checks++))
fi
echo ""

# 2. Health check endpoint
echo -e "${YELLOW}🏥 Health Check Endpoint${NC}"
((total_checks++))
if check_json_endpoint "$RENDER_URL/api/health" "Health endpoint" "status timestamp checks"; then
    ((passed_checks++))

    # Additional health check analysis
    health_response=$(curl -s "$RENDER_URL/api/health" 2>/dev/null || echo '{}')
    if echo "$health_response" | jq . >/dev/null 2>&1; then
        echo "📊 Health Check Details:"

        # Overall status
        status=$(echo "$health_response" | jq -r '.status // "unknown"')
        case "$status" in
            "healthy") echo -e "  Overall Status: ${GREEN}✅ $status${NC}" ;;
            "degraded") echo -e "  Overall Status: ${YELLOW}⚠️  $status${NC}" ;;
            "unhealthy") echo -e "  Overall Status: ${RED}❌ $status${NC}" ;;
            *) echo -e "  Overall Status: ${YELLOW}❓ $status${NC}" ;;
        esac

        # Database check
        db_status=$(echo "$health_response" | jq -r '.checks.database.status // "unknown"')
        case "$db_status" in
            "pass") echo -e "  Database: ${GREEN}✅ $db_status${NC}" ;;
            "warn") echo -e "  Database: ${YELLOW}⚠️  $db_status${NC}" ;;
            "fail") echo -e "  Database: ${RED}❌ $db_status${NC}" ;;
            *) echo -e "  Database: ${YELLOW}❓ $db_status${NC}" ;;
        esac

        # Redis check
        redis_status=$(echo "$health_response" | jq -r '.checks.redis.status // "unknown"')
        case "$redis_status" in
            "pass") echo -e "  Redis Cache: ${GREEN}✅ $redis_status${NC}" ;;
            "warn") echo -e "  Redis Cache: ${YELLOW}⚠️  $redis_status${NC}" ;;
            "fail") echo -e "  Redis Cache: ${RED}❌ $redis_status${NC}" ;;
            *) echo -e "  Redis Cache: ${YELLOW}❓ $redis_status${NC}" ;;
        esac

        # Services check
        services_status=$(echo "$health_response" | jq -r '.checks.services.status // "unknown"')
        case "$services_status" in
            "pass") echo -e "  Services Config: ${GREEN}✅ $services_status${NC}" ;;
            "warn") echo -e "  Services Config: ${YELLOW}⚠️  $services_status${NC}" ;;
            "fail") echo -e "  Services Config: ${RED}❌ $services_status${NC}" ;;
            *) echo -e "  Services Config: ${YELLOW}❓ $services_status${NC}" ;;
        esac

        # System info
        uptime=$(echo "$health_response" | jq -r '.uptime // "unknown"')
        memory_used=$(echo "$health_response" | jq -r '.system.memory.used // "unknown"')
        memory_percentage=$(echo "$health_response" | jq -r '.system.memory.percentage // "unknown"')

        echo "  Uptime: ${uptime}s"
        echo "  Memory Usage: ${memory_used}MB (${memory_percentage}%)"
    fi
fi
echo ""

# 3. API endpoints
echo -e "${YELLOW}🔌 Critical API Endpoints${NC}"

# Services endpoint
((total_checks++))
if check_json_endpoint "$RENDER_URL/api/services" "Services API" ""; then
    ((passed_checks++))
fi

# Booking availability endpoint
((total_checks++))
if check_endpoint "$RENDER_URL/api/bookings/availability" "200" "Booking availability API"; then
    ((passed_checks++))
fi

echo ""

# 4. Static assets and PWA
echo -e "${YELLOW}📱 PWA and Static Assets${NC}"

# Manifest
((total_checks++))
if check_endpoint "$RENDER_URL/manifest.json" "200" "PWA Manifest"; then
    ((passed_checks++))
fi

# Service Worker
((total_checks++))
if check_endpoint "$RENDER_URL/sw.js" "200" "Service Worker"; then
    ((passed_checks++))
fi

echo ""

# 5. Security headers check
echo -e "${YELLOW}🔒 Security Headers${NC}"
echo -n "Checking security headers... "

security_response=$(curl -s -I "$RENDER_URL" 2>/dev/null || echo "")
security_score=0
total_security_checks=6

# Check for important security headers
if echo "$security_response" | grep -qi "strict-transport-security"; then
    ((security_score++))
    [ "$VERBOSE" = true ] && echo "  ✅ HSTS header present"
fi

if echo "$security_response" | grep -qi "content-security-policy"; then
    ((security_score++))
    [ "$VERBOSE" = true ] && echo "  ✅ CSP header present"
fi

if echo "$security_response" | grep -qi "x-frame-options"; then
    ((security_score++))
    [ "$VERBOSE" = true ] && echo "  ✅ X-Frame-Options header present"
fi

if echo "$security_response" | grep -qi "x-content-type-options"; then
    ((security_score++))
    [ "$VERBOSE" = true ] && echo "  ✅ X-Content-Type-Options header present"
fi

if echo "$security_response" | grep -qi "referrer-policy"; then
    ((security_score++))
    [ "$VERBOSE" = true ] && echo "  ✅ Referrer-Policy header present"
fi

if echo "$security_response" | grep -qi "permissions-policy"; then
    ((security_score++))
    [ "$VERBOSE" = true ] && echo "  ✅ Permissions-Policy header present"
fi

if [ $security_score -ge 4 ]; then
    echo -e "${GREEN}✅ PASS${NC} ($security_score/$total_security_checks headers)"
    ((passed_checks++))
else
    echo -e "${YELLOW}⚠️  WARN${NC} ($security_score/$total_security_checks headers)"
fi

((total_checks++))
echo ""

# 6. Performance check
echo -e "${YELLOW}⚡ Performance Check${NC}"
echo -n "Measuring response time... "

start_time=$(date +%s.%N)
curl -s "$RENDER_URL" >/dev/null 2>&1
end_time=$(date +%s.%N)
response_time=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "unknown")

if [ "$response_time" != "unknown" ]; then
    response_time_ms=$(echo "$response_time * 1000" | bc 2>/dev/null || echo "unknown")
    if [ "$response_time_ms" != "unknown" ]; then
        response_time_int=$(echo "$response_time_ms" | cut -d. -f1)
        if [ "$response_time_int" -lt 3000 ]; then
            echo -e "${GREEN}✅ EXCELLENT${NC} (${response_time_int}ms)"
            ((passed_checks++))
        elif [ "$response_time_int" -lt 5000 ]; then
            echo -e "${YELLOW}⚠️  ACCEPTABLE${NC} (${response_time_int}ms)"
            ((passed_checks++))
        else
            echo -e "${RED}❌ SLOW${NC} (${response_time_int}ms)"
        fi
    else
        echo -e "${YELLOW}❓ Unable to measure${NC}"
    fi
else
    echo -e "${YELLOW}❓ Unable to measure${NC}"
fi

((total_checks++))
echo ""

# Summary
echo -e "${BLUE}📊 Verification Summary${NC}"
echo -e "${BLUE}======================${NC}"
echo -e "Total Checks: $total_checks"
echo -e "Passed: ${GREEN}$passed_checks${NC}"
echo -e "Failed: ${RED}$((total_checks - passed_checks))${NC}"

success_rate=$(echo "scale=1; $passed_checks * 100 / $total_checks" | bc 2>/dev/null || echo "unknown")

if [ "$success_rate" != "unknown" ]; then
    success_rate_int=$(echo "$success_rate" | cut -d. -f1)
    if [ "$success_rate_int" -ge 90 ]; then
        echo -e "Success Rate: ${GREEN}${success_rate}%${NC} 🎉"
        echo -e "\n${GREEN}🎉 Excellent! Your Render deployment is working well!${NC}"
    elif [ "$success_rate_int" -ge 70 ]; then
        echo -e "Success Rate: ${YELLOW}${success_rate}%${NC} ⚠️"
        echo -e "\n${YELLOW}⚠️  Good, but some issues need attention.${NC}"
    else
        echo -e "Success Rate: ${RED}${success_rate}%${NC} ❌"
        echo -e "\n${RED}❌ Multiple issues detected. Please review the failures above.${NC}"
    fi
else
    echo -e "Success Rate: ${YELLOW}Unknown${NC}"
fi

echo ""
echo -e "${BLUE}💡 Next Steps:${NC}"
echo "1. If health check fails, verify environment variables in Render"
echo "2. If API endpoints fail, check Render service logs"
echo "3. If security headers are missing, verify middleware configuration"
echo "4. For performance issues, check Render plan and database performance"
echo ""
echo -e "For detailed troubleshooting, run: ${YELLOW}./scripts/validate-production-deployment.sh $RENDER_URL${NC}"

# Cleanup
rm -f /tmp/curl_response

exit 0