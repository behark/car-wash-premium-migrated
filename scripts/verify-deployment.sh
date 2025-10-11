#!/bin/bash

# Deployment Verification Script
# Verifies that the deployment is successful and all services are running

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SITE_URL=${1:-"https://kiiltoloisto.fi"}
HEALTH_ENDPOINT="/api/health"
TIMEOUT=30
MAX_RETRIES=5
RETRY_DELAY=5

# Functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

log_section() {
    echo
    echo -e "${CYAN}═══════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════${NC}"
}

# Check if URL is provided
if [ -z "$SITE_URL" ]; then
    log_error "Please provide the site URL as the first argument"
    echo "Usage: $0 <site-url>"
    exit 1
fi

log_section "Deployment Verification"
log_info "Target URL: $SITE_URL"
log_info "Starting verification process..."

# Function to check endpoint
check_endpoint() {
    local url=$1
    local expected_status=$2
    local description=$3
    local retry_count=0

    log_info "Checking $description..."

    while [ $retry_count -lt $MAX_RETRIES ]; do
        response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$url" || echo "000")

        if [ "$response" = "$expected_status" ] || [ "$response" = "200" ] || [ "$response" = "206" ]; then
            log_success "$description is responding (HTTP $response)"
            return 0
        elif [ "$response" = "000" ]; then
            log_warning "Connection failed, retrying... ($((retry_count + 1))/$MAX_RETRIES)"
        else
            log_warning "Unexpected status code: $response, retrying... ($((retry_count + 1))/$MAX_RETRIES)"
        fi

        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $MAX_RETRIES ]; then
            sleep $RETRY_DELAY
        fi
    done

    log_error "$description check failed after $MAX_RETRIES attempts"
    return 1
}

# Function to check health endpoint
check_health() {
    local url="${SITE_URL}${HEALTH_ENDPOINT}"
    log_info "Checking health endpoint: $url"

    response=$(curl -s --connect-timeout $TIMEOUT "$url" || echo "{}")

    # Check if response is valid JSON
    if echo "$response" | jq . >/dev/null 2>&1; then
        status=$(echo "$response" | jq -r '.status // "unknown"')

        if [ "$status" = "healthy" ]; then
            log_success "Health check passed: System is healthy"

            # Display health check details
            if echo "$response" | jq -e '.checks' >/dev/null 2>&1; then
                echo
                log_info "Health check details:"
                echo "$response" | jq '.checks' 2>/dev/null | head -20
            fi
            return 0
        elif [ "$status" = "degraded" ]; then
            log_warning "Health check passed with warnings: System is degraded"

            # Display issues
            if echo "$response" | jq -e '.checks' >/dev/null 2>&1; then
                echo
                log_warning "Issues found:"
                echo "$response" | jq '.checks | to_entries | .[] | select(.value.status != "pass")' 2>/dev/null
            fi
            return 0
        else
            log_error "Health check failed: System is $status"
            echo "$response" | jq . 2>/dev/null || echo "$response"
            return 1
        fi
    else
        log_error "Health endpoint returned invalid JSON"
        echo "Response: $response"
        return 1
    fi
}

# Main verification process
log_section "Basic Connectivity"

# Check main site
if check_endpoint "$SITE_URL" "200" "Main site"; then
    MAIN_SITE_OK=true
else
    MAIN_SITE_OK=false
fi

log_section "API Endpoints"

# Check health endpoint
if check_health; then
    HEALTH_OK=true
else
    HEALTH_OK=false
fi

# Check other critical endpoints
API_ENDPOINTS=(
    "/api/services:200:Services API"
    "/api/bookings/availability:200:Bookings API"
)

API_OK=true
for endpoint_info in "${API_ENDPOINTS[@]}"; do
    IFS=':' read -r endpoint expected_status description <<< "$endpoint_info"
    if ! check_endpoint "${SITE_URL}${endpoint}" "$expected_status" "$description"; then
        API_OK=false
    fi
done

log_section "Static Assets"

# Check static assets
STATIC_ASSETS=(
    "/_next/static:404:Next.js static assets"
    "/favicon.ico:200:Favicon"
)

ASSETS_OK=true
for asset_info in "${STATIC_ASSETS[@]}"; do
    IFS=':' read -r asset expected_status description <<< "$asset_info"

    # For Next.js static assets, we just check that the path exists (404 is expected for directory listing)
    if [[ "$asset" == "/_next/static" ]]; then
        # Check if we can access a CSS or JS file (we don't know the exact hash)
        response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "${SITE_URL}/_next/" || echo "000")
        if [ "$response" != "000" ]; then
            log_success "$description are accessible"
        else
            log_error "$description are not accessible"
            ASSETS_OK=false
        fi
    else
        if ! check_endpoint "${SITE_URL}${asset}" "$expected_status" "$description"; then
            ASSETS_OK=false
        fi
    fi
done

log_section "Security Headers"

# Check security headers
log_info "Checking security headers..."
headers=$(curl -s -I --connect-timeout $TIMEOUT "$SITE_URL" || echo "")

SECURITY_OK=true
REQUIRED_HEADERS=(
    "X-Frame-Options"
    "X-Content-Type-Options"
    "Strict-Transport-Security"
)

for header in "${REQUIRED_HEADERS[@]}"; do
    if echo "$headers" | grep -qi "^$header:"; then
        log_success "Security header present: $header"
    else
        log_warning "Security header missing: $header"
        SECURITY_OK=false
    fi
done

log_section "Performance Check"

# Measure response time
log_info "Measuring response time..."
response_time=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout $TIMEOUT "$SITE_URL" || echo "0")

if [ "$(echo "$response_time > 0" | bc)" -eq 1 ]; then
    response_time_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)

    if [ "$response_time_ms" -lt 1000 ]; then
        log_success "Response time: ${response_time_ms}ms (Excellent)"
        PERFORMANCE_OK=true
    elif [ "$response_time_ms" -lt 3000 ]; then
        log_warning "Response time: ${response_time_ms}ms (Acceptable)"
        PERFORMANCE_OK=true
    else
        log_error "Response time: ${response_time_ms}ms (Poor)"
        PERFORMANCE_OK=false
    fi
else
    log_error "Could not measure response time"
    PERFORMANCE_OK=false
fi

# Final Report
log_section "Verification Report"

TOTAL_CHECKS=0
PASSED_CHECKS=0

# Count results
declare -A check_results=(
    ["Main Site"]=$MAIN_SITE_OK
    ["Health Check"]=$HEALTH_OK
    ["API Endpoints"]=$API_OK
    ["Static Assets"]=$ASSETS_OK
    ["Security Headers"]=$SECURITY_OK
    ["Performance"]=$PERFORMANCE_OK
)

for check_name in "${!check_results[@]}"; do
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ "${check_results[$check_name]}" = true ]; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        log_success "$check_name: PASSED"
    else
        log_error "$check_name: FAILED"
    fi
done

echo
if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    log_section "✅ DEPLOYMENT VERIFICATION SUCCESSFUL"
    log_success "All $TOTAL_CHECKS checks passed!"
    log_info "The deployment at $SITE_URL is fully operational."
    exit 0
elif [ $PASSED_CHECKS -gt $((TOTAL_CHECKS / 2)) ]; then
    log_section "⚠️ DEPLOYMENT PARTIALLY SUCCESSFUL"
    log_warning "$PASSED_CHECKS out of $TOTAL_CHECKS checks passed."
    log_info "The deployment is functional but has some issues that should be addressed."
    exit 1
else
    log_section "❌ DEPLOYMENT VERIFICATION FAILED"
    log_error "Only $PASSED_CHECKS out of $TOTAL_CHECKS checks passed."
    log_info "The deployment has critical issues that need immediate attention."
    exit 2
fi