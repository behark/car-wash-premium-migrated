#!/bin/bash

# ================================================================
# Production Deployment Validation Script for Render
# ================================================================
# This script validates the production deployment by checking:
# - Application health and availability
# - Database connectivity
# - External service configurations
# - Security headers
# - Performance metrics

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_URL="${1:-https://your-app-name.onrender.com}"
TIMEOUT=30
RETRY_COUNT=3
HEALTH_ENDPOINT="/api/health"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}🚀 Production Deployment Validation${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Target URL: ${APP_URL}"
echo -e "Timeout: ${TIMEOUT}s"
echo -e "Retries: ${RETRY_COUNT}"
echo ""

# Function to make HTTP requests with retries
make_request() {
    local url="$1"
    local expected_status="${2:-200}"
    local method="${3:-GET}"
    local retry_count=0

    while [ $retry_count -lt $RETRY_COUNT ]; do
        echo -n "  Attempt $((retry_count + 1))... "

        if [ "$method" = "GET" ]; then
            response=$(curl -s -w "%{http_code}|%{time_total}" -m $TIMEOUT "$url" 2>/dev/null || echo "000|0")
        else
            response=$(curl -s -w "%{http_code}|%{time_total}" -X "$method" -m $TIMEOUT "$url" 2>/dev/null || echo "000|0")
        fi

        http_code=$(echo "$response" | cut -d'|' -f1)
        time_total=$(echo "$response" | cut -d'|' -f2)

        if [ "$http_code" = "$expected_status" ]; then
            echo -e "${GREEN}✓ $http_code (${time_total}s)${NC}"
            return 0
        else
            echo -e "${RED}✗ $http_code (${time_total}s)${NC}"
            retry_count=$((retry_count + 1))
            sleep 2
        fi
    done

    return 1
}

# Function to check security headers
check_security_headers() {
    local url="$1"
    echo -e "${BLUE}🛡️  Security Headers Check${NC}"

    headers=$(curl -s -I -m $TIMEOUT "$url" 2>/dev/null || echo "")

    # Required security headers
    declare -A required_headers=(
        ["X-Frame-Options"]="DENY"
        ["X-Content-Type-Options"]="nosniff"
        ["X-XSS-Protection"]="1; mode=block"
        ["Strict-Transport-Security"]="max-age="
        ["Content-Security-Policy"]="default-src"
        ["Referrer-Policy"]="strict-origin"
    )

    for header in "${!required_headers[@]}"; do
        if echo "$headers" | grep -i "$header" | grep -q "${required_headers[$header]}"; then
            echo -e "  ${GREEN}✓ $header${NC}"
        else
            echo -e "  ${RED}✗ $header (missing or incorrect)${NC}"
        fi
    done
}

# Function to validate health endpoint
validate_health() {
    echo -e "${BLUE}🏥 Health Check Validation${NC}"

    health_url="${APP_URL}${HEALTH_ENDPOINT}"
    health_response=$(curl -s -m $TIMEOUT "$health_url" 2>/dev/null || echo "{}")

    # Check if response is valid JSON
    if echo "$health_response" | jq . >/dev/null 2>&1; then
        status=$(echo "$health_response" | jq -r '.status // "unknown"')
        uptime=$(echo "$health_response" | jq -r '.uptime // 0')
        version=$(echo "$health_response" | jq -r '.version // "unknown"')
        environment=$(echo "$health_response" | jq -r '.environment // "unknown"')

        echo -e "  Status: ${GREEN}$status${NC}"
        echo -e "  Uptime: ${uptime}s"
        echo -e "  Version: $version"
        echo -e "  Environment: $environment"

        # Check database status
        db_status=$(echo "$health_response" | jq -r '.checks.database.status // "unknown"')
        if [ "$db_status" = "pass" ]; then
            echo -e "  Database: ${GREEN}✓ Connected${NC}"
        else
            echo -e "  Database: ${RED}✗ $db_status${NC}"
            return 1
        fi

        # Check services status
        services_status=$(echo "$health_response" | jq -r '.checks.services.status // "unknown"')
        if [ "$services_status" = "pass" ]; then
            echo -e "  Services: ${GREEN}✓ Configured${NC}"
        elif [ "$services_status" = "warn" ]; then
            echo -e "  Services: ${YELLOW}⚠ Partially configured${NC}"
        else
            echo -e "  Services: ${RED}✗ $services_status${NC}"
        fi

        # Check memory usage
        memory_percentage=$(echo "$health_response" | jq -r '.system.memory.percentage // 0')
        if [ "$memory_percentage" -lt 80 ]; then
            echo -e "  Memory Usage: ${GREEN}✓ ${memory_percentage}%${NC}"
        elif [ "$memory_percentage" -lt 90 ]; then
            echo -e "  Memory Usage: ${YELLOW}⚠ ${memory_percentage}%${NC}"
        else
            echo -e "  Memory Usage: ${RED}✗ ${memory_percentage}% (High)${NC}"
        fi

    else
        echo -e "  ${RED}✗ Invalid health check response${NC}"
        return 1
    fi
}

# Function to test key endpoints
test_endpoints() {
    echo -e "${BLUE}🌐 Endpoint Testing${NC}"

    declare -A endpoints=(
        ["/"]="200"
        ["/api/health"]="200"
        ["/api/services"]="200"
        ["/api/bookings"]="405"  # Should reject GET without auth
        ["/.env"]="404"          # Should be blocked
        ["/admin"]="302"         # Should redirect to login
    )

    for endpoint in "${!endpoints[@]}"; do
        echo -n "Testing $endpoint: "
        if make_request "${APP_URL}${endpoint}" "${endpoints[$endpoint]}" "GET"; then
            echo -e "    ${GREEN}✓ Expected response${NC}"
        else
            echo -e "    ${RED}✗ Unexpected response${NC}"
        fi
    done
}

# Function to check performance
check_performance() {
    echo -e "${BLUE}⚡ Performance Check${NC}"

    # Test main page load time
    echo -n "  Homepage load time: "
    load_time=$(curl -s -w "%{time_total}" -o /dev/null -m $TIMEOUT "$APP_URL" 2>/dev/null || echo "timeout")

    if [ "$load_time" != "timeout" ]; then
        load_time_ms=$(echo "$load_time * 1000" | bc 2>/dev/null || echo "0")
        if (( $(echo "$load_time < 2.0" | bc -l) )); then
            echo -e "${GREEN}✓ ${load_time}s${NC}"
        elif (( $(echo "$load_time < 5.0" | bc -l) )); then
            echo -e "${YELLOW}⚠ ${load_time}s (Acceptable)${NC}"
        else
            echo -e "${RED}✗ ${load_time}s (Slow)${NC}"
        fi
    else
        echo -e "${RED}✗ Timeout${NC}"
    fi
}

# Function to check SSL/TLS
check_ssl() {
    echo -e "${BLUE}🔒 SSL/TLS Check${NC}"

    if echo "$APP_URL" | grep -q "https://"; then
        domain=$(echo "$APP_URL" | sed 's|https://||' | sed 's|/.*||')

        # Check SSL certificate
        ssl_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")

        if [ -n "$ssl_info" ]; then
            echo -e "  ${GREEN}✓ SSL Certificate Valid${NC}"

            # Check certificate expiry
            not_after=$(echo "$ssl_info" | grep "notAfter" | cut -d= -f2)
            if [ -n "$not_after" ]; then
                echo -e "  Certificate expires: $not_after"
            fi
        else
            echo -e "  ${RED}✗ SSL Certificate Issues${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠ HTTP only (not HTTPS)${NC}"
    fi
}

# Function to generate report
generate_report() {
    echo ""
    echo -e "${BLUE}================================================================${NC}"
    echo -e "${BLUE}📊 Deployment Validation Summary${NC}"
    echo -e "${BLUE}================================================================${NC}"
    echo -e "Application URL: $APP_URL"
    echo -e "Validation Time: $(date)"
    echo ""

    if [ $overall_status -eq 0 ]; then
        echo -e "${GREEN}✅ DEPLOYMENT VALIDATION PASSED${NC}"
        echo -e "${GREEN}Application is ready for production traffic${NC}"
    else
        echo -e "${RED}❌ DEPLOYMENT VALIDATION FAILED${NC}"
        echo -e "${RED}Please review and fix the issues above${NC}"
    fi
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "  1. Update DNS to point to $APP_URL"
    echo -e "  2. Configure monitoring alerts"
    echo -e "  3. Set up backup procedures"
    echo -e "  4. Review security configurations"
    echo -e "  5. Run load testing if needed"
}

# Main validation workflow
main() {
    overall_status=0

    # Basic connectivity test
    echo -e "${BLUE}🔌 Basic Connectivity${NC}"
    if ! make_request "$APP_URL" "200" "GET"; then
        echo -e "${RED}❌ Application is not accessible${NC}"
        exit 1
    fi
    echo ""

    # Run all checks
    validate_health || overall_status=1
    echo ""

    check_security_headers
    echo ""

    test_endpoints || overall_status=1
    echo ""

    check_performance
    echo ""

    check_ssl
    echo ""

    generate_report

    exit $overall_status
}

# Check dependencies
if ! command -v curl >/dev/null 2>&1; then
    echo -e "${RED}Error: curl is required but not installed${NC}"
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    exit 1
fi

# Run main function
main "$@"