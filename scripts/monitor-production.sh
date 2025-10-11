#!/bin/bash

# ================================================================
# Production Monitoring Script for Render Deployment
# ================================================================
# Continuous monitoring script that can be run via cron job or
# monitoring service to track application health and performance

set -e

# Configuration
APP_URL="${RENDER_EXTERNAL_URL:-https://your-app-name.onrender.com}"
HEALTH_ENDPOINT="/api/health"
LOG_FILE="/tmp/app-monitor.log"
ALERT_WEBHOOK="${MONITORING_WEBHOOK_URL:-}"
ALERT_EMAIL="${ADMIN_EMAIL:-}"
CHECK_INTERVAL="${MONITOR_INTERVAL:-60}"  # seconds
MAX_FAILURES="${MAX_FAILURES:-3}"

# Thresholds
MAX_RESPONSE_TIME=5.0
MAX_MEMORY_PERCENT=85
MIN_UPTIME=300  # 5 minutes

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# State tracking
FAILURE_COUNT=0
LAST_STATUS="unknown"

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Send alert function
send_alert() {
    local alert_type="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Send webhook alert if configured
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -s -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"type\": \"$alert_type\",
                \"message\": \"$message\",
                \"timestamp\": \"$timestamp\",
                \"service\": \"car-wash-booking\",
                \"url\": \"$APP_URL\"
            }" >/dev/null 2>&1 || log "ERROR" "Failed to send webhook alert"
    fi

    # Send email alert if configured (using sendmail)
    if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "[$alert_type] Car Wash Booking System Alert" "$ALERT_EMAIL" >/dev/null 2>&1 || \
            log "ERROR" "Failed to send email alert"
    fi

    log "$alert_type" "$message"
}

# Health check function
check_health() {
    local start_time=$(date +%s.%N)
    local health_url="${APP_URL}${HEALTH_ENDPOINT}"

    # Make health check request
    response=$(curl -s -w "%{http_code}|%{time_total}" -m 30 "$health_url" 2>/dev/null || echo "000|timeout")
    http_code=$(echo "$response" | tail -1 | cut -d'|' -f1)
    response_time=$(echo "$response" | tail -1 | cut -d'|' -f2)
    response_body=$(echo "$response" | head -n -1)

    local end_time=$(date +%s.%N)
    local total_time=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "0")

    # Check HTTP status
    if [ "$http_code" != "200" ]; then
        return 1
    fi

    # Check response time
    if [ "$response_time" != "timeout" ]; then
        if (( $(echo "$response_time > $MAX_RESPONSE_TIME" | bc -l 2>/dev/null || echo 0) )); then
            log "WARN" "Slow response time: ${response_time}s (threshold: ${MAX_RESPONSE_TIME}s)"
        fi
    else
        log "ERROR" "Health check timeout"
        return 1
    fi

    # Parse health check response
    if echo "$response_body" | jq . >/dev/null 2>&1; then
        local status=$(echo "$response_body" | jq -r '.status // "unknown"')
        local uptime=$(echo "$response_body" | jq -r '.uptime // 0')
        local memory_percent=$(echo "$response_body" | jq -r '.system.memory.percentage // 0')
        local db_status=$(echo "$response_body" | jq -r '.checks.database.status // "unknown"')

        # Check overall status
        if [ "$status" != "healthy" ]; then
            log "ERROR" "Application status: $status"
            return 1
        fi

        # Check database
        if [ "$db_status" != "pass" ]; then
            log "ERROR" "Database check failed: $db_status"
            return 1
        fi

        # Check memory usage
        if (( $(echo "$memory_percent > $MAX_MEMORY_PERCENT" | bc -l 2>/dev/null || echo 0) )); then
            log "WARN" "High memory usage: ${memory_percent}% (threshold: ${MAX_MEMORY_PERCENT}%)"
        fi

        # Check uptime (detect recent restarts)
        if (( $(echo "$uptime < $MIN_UPTIME" | bc -l 2>/dev/null || echo 0) )); then
            log "INFO" "Recent restart detected - uptime: ${uptime}s"
        fi

        # Log successful check
        log "INFO" "Health check passed - Status: $status, Memory: ${memory_percent}%, Response: ${response_time}s"
        return 0
    else
        log "ERROR" "Invalid health check response format"
        return 1
    fi
}

# SSL certificate check
check_ssl_expiry() {
    if echo "$APP_URL" | grep -q "https://"; then
        local domain=$(echo "$APP_URL" | sed 's|https://||' | sed 's|/.*||')

        # Get certificate expiry date
        local cert_end_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | \
                             openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

        if [ -n "$cert_end_date" ]; then
            local cert_end_epoch=$(date -d "$cert_end_date" +%s 2>/dev/null || echo "0")
            local current_epoch=$(date +%s)
            local days_until_expiry=$(( (cert_end_epoch - current_epoch) / 86400 ))

            if [ $days_until_expiry -lt 30 ]; then
                if [ $days_until_expiry -lt 7 ]; then
                    send_alert "CRITICAL" "SSL certificate expires in $days_until_expiry days!"
                else
                    send_alert "WARN" "SSL certificate expires in $days_until_expiry days"
                fi
            fi
        fi
    fi
}

# Disk space check (if running on the server)
check_disk_space() {
    if [ -d "/app" ]; then
        local disk_usage=$(df /app | tail -1 | awk '{print $5}' | sed 's/%//')
        if [ "$disk_usage" -gt 85 ]; then
            send_alert "WARN" "High disk usage: ${disk_usage}%"
        fi
    fi
}

# Check for suspicious activity
check_security() {
    # Check for too many failed requests (simplified check)
    if [ -f "/var/log/nginx/access.log" ]; then
        local failed_requests=$(tail -1000 /var/log/nginx/access.log | grep -E "40[1-4]|50[0-5]" | wc -l)
        if [ "$failed_requests" -gt 100 ]; then
            send_alert "WARN" "High number of failed requests detected: $failed_requests"
        fi
    fi
}

# Main monitoring loop
monitor() {
    log "INFO" "Starting monitoring - URL: $APP_URL, Interval: ${CHECK_INTERVAL}s"

    while true; do
        # Perform health check
        if check_health; then
            # Reset failure count on success
            if [ $FAILURE_COUNT -gt 0 ]; then
                send_alert "INFO" "Service recovered after $FAILURE_COUNT failures"
                FAILURE_COUNT=0
            fi
            LAST_STATUS="healthy"
        else
            # Increment failure count
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
            log "ERROR" "Health check failed (failure #$FAILURE_COUNT)"

            # Send alert if threshold exceeded
            if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
                send_alert "CRITICAL" "Service down! $FAILURE_COUNT consecutive failures detected"
            fi
            LAST_STATUS="unhealthy"
        fi

        # Additional checks (less frequent)
        if [ $(($(date +%s) % 300)) -eq 0 ]; then  # Every 5 minutes
            check_ssl_expiry
            check_disk_space
            check_security
        fi

        # Wait for next check
        sleep "$CHECK_INTERVAL"
    done
}

# One-time check mode
check_once() {
    log "INFO" "Performing one-time health check"

    if check_health; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        exit 0
    else
        echo -e "${RED}❌ Health check failed${NC}"
        exit 1
    fi
}

# Status report
status_report() {
    echo -e "${BLUE}📊 Current Status Report${NC}"
    echo "========================="
    echo "App URL: $APP_URL"
    echo "Last Status: $LAST_STATUS"
    echo "Failure Count: $FAILURE_COUNT"
    echo "Log File: $LOG_FILE"
    echo ""

    if [ -f "$LOG_FILE" ]; then
        echo "Recent Log Entries:"
        tail -10 "$LOG_FILE"
    fi
}

# Usage information
usage() {
    echo "Usage: $0 [OPTIONS] [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  monitor     Start continuous monitoring (default)"
    echo "  check       Perform one-time health check"
    echo "  status      Show current status report"
    echo ""
    echo "Options:"
    echo "  -u URL      Application URL (default: $APP_URL)"
    echo "  -i INTERVAL Check interval in seconds (default: $CHECK_INTERVAL)"
    echo "  -f COUNT    Max failures before alert (default: $MAX_FAILURES)"
    echo "  -h          Show this help"
    echo ""
    echo "Environment Variables:"
    echo "  RENDER_EXTERNAL_URL     Application URL"
    echo "  MONITORING_WEBHOOK_URL  Webhook for alerts"
    echo "  ADMIN_EMAIL            Email for alerts"
    echo "  MONITOR_INTERVAL       Check interval"
    echo "  MAX_FAILURES           Failure threshold"
}

# Parse command line arguments
while getopts "u:i:f:h" opt; do
    case $opt in
        u) APP_URL="$OPTARG" ;;
        i) CHECK_INTERVAL="$OPTARG" ;;
        f) MAX_FAILURES="$OPTARG" ;;
        h) usage; exit 0 ;;
        \?) echo "Invalid option -$OPTARG" >&2; exit 1 ;;
    esac
done

shift $((OPTIND-1))

# Execute command
case "${1:-monitor}" in
    monitor)
        monitor
        ;;
    check)
        check_once
        ;;
    status)
        status_report
        ;;
    *)
        echo "Unknown command: $1"
        usage
        exit 1
        ;;
esac