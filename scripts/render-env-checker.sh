#!/bin/bash

# 🔧 Render Environment Variables Checker
# Helps verify which environment variables are properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Render Environment Variables Checker${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

echo -e "${YELLOW}📋 This script will help you verify your Render environment variables.${NC}"
echo -e "${YELLOW}For each variable, we'll show you what should be configured.${NC}"
echo ""

# Function to check if user wants to continue
confirm_check() {
    local var_name="$1"
    local description="$2"
    local example="$3"
    local required="$4"

    echo -e "${BLUE}Variable: ${YELLOW}$var_name${NC}"
    echo -e "Description: $description"
    echo -e "Example: ${YELLOW}$example${NC}"
    if [ "$required" = "true" ]; then
        echo -e "Required: ${RED}YES${NC} (Application won't work without this)"
    else
        echo -e "Required: ${YELLOW}OPTIONAL${NC}"
    fi
    echo ""
}

echo -e "${GREEN}🚀 REQUIRED ENVIRONMENT VARIABLES${NC}"
echo -e "${GREEN}=================================${NC}"
echo ""

# Core Application Variables
echo -e "${BLUE}🔑 Core Application Settings${NC}"
echo ""

confirm_check "NODE_ENV" "Application environment" "production" "true"
confirm_check "NEXTAUTH_SECRET" "Authentication secret (32+ characters)" "generated-with-openssl-rand-base64-32" "true"
confirm_check "NEXTAUTH_URL" "Your Render service URL" "https://your-app-name.onrender.com" "true"
confirm_check "NEXT_PUBLIC_SITE_URL" "Public site URL (same as NEXTAUTH_URL)" "https://your-app-name.onrender.com" "true"
confirm_check "NEXT_TELEMETRY_DISABLED" "Disable Next.js telemetry" "1" "true"

echo ""
echo -e "${BLUE}💳 Payment Processing (Stripe)${NC}"
echo ""

confirm_check "STRIPE_SECRET_KEY" "Stripe secret key (LIVE for production)" "sk_live_..." "true"
confirm_check "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "Stripe publishable key (LIVE for production)" "pk_live_..." "true"
confirm_check "STRIPE_WEBHOOK_SECRET" "Stripe webhook secret" "whsec_..." "true"

echo ""
echo -e "${BLUE}📧 Email Service (SendGrid)${NC}"
echo ""

confirm_check "SENDGRID_API_KEY" "SendGrid API key" "SG...." "true"
confirm_check "SENDER_EMAIL" "Verified sender email address" "noreply@yourdomain.com" "true"

echo ""
echo -e "${BLUE}🗄️ Database & Cache (Auto-configured by Render)${NC}"
echo ""

confirm_check "DATABASE_URL" "PostgreSQL connection string (auto-set by Render)" "postgresql://user:pass@host:port/db" "true"
confirm_check "REDIS_URL" "Redis connection string (auto-set by Render)" "redis://user:pass@host:port" "false"

echo ""
echo -e "${GREEN}⚙️ OPTIONAL ENVIRONMENT VARIABLES${NC}"
echo -e "${GREEN}=================================${NC}"
echo ""

echo -e "${BLUE}🔒 Security & Performance${NC}"
echo ""

confirm_check "CORS_ALLOWED_ORIGINS" "Allowed CORS origins" "https://your-app-name.onrender.com,https://yourdomain.com" "false"
confirm_check "DATABASE_POOL_SIZE" "Database connection pool size" "10" "false"
confirm_check "DB_MAX_CONNECTIONS" "Maximum database connections" "20" "false"
confirm_check "REDIS_DEFAULT_TTL" "Redis cache TTL in seconds" "3600" "false"

echo ""
echo -e "${BLUE}📊 Monitoring & Analytics${NC}"
echo ""

confirm_check "SENTRY_DSN" "Sentry error monitoring DSN" "https://your-dsn@sentry.io/project-id" "false"
confirm_check "NEXT_PUBLIC_GA_ID" "Google Analytics ID" "G-XXXXXXXXXX" "false"

echo ""
echo -e "${BLUE}🏢 Business Configuration${NC}"
echo ""

confirm_check "BUSINESS_NAME" "Your business name" "Kiilto Loisto Autopesula" "false"
confirm_check "ADMIN_EMAIL" "Admin email for notifications" "admin@yourdomain.com" "false"

echo ""
echo -e "${YELLOW}📝 HOW TO SET THESE IN RENDER:${NC}"
echo ""
echo "1. Go to your Render Dashboard"
echo "2. Click on your Web Service"
echo "3. Go to the 'Environment' tab"
echo "4. Click 'Add Environment Variable'"
echo "5. Enter the variable name and value"
echo "6. Click 'Save Changes'"
echo "7. Render will automatically redeploy your service"
echo ""

echo -e "${YELLOW}🔐 SECURITY TIPS:${NC}"
echo ""
echo "• Use LIVE Stripe keys for production (sk_live_, pk_live_)"
echo "• Generate NEXTAUTH_SECRET with: openssl rand -base64 32"
echo "• Keep all secrets secure and never commit them to code"
echo "• Verify your sender email in SendGrid"
echo "• Use your actual Render URL (not localhost)"
echo ""

echo -e "${YELLOW}🧪 TESTING YOUR CONFIGURATION:${NC}"
echo ""
echo "After setting up your environment variables:"
echo ""
echo "1. Wait for Render to redeploy (2-5 minutes)"
echo "2. Test your health endpoint:"
echo "   curl https://your-app-name.onrender.com/api/health"
echo ""
echo "3. Run the verification script:"
echo "   ./scripts/check-render-config.sh -u https://your-app-name.onrender.com"
echo ""
echo "4. Check for any errors in Render logs:"
echo "   Dashboard → Your Service → Logs tab"
echo ""

echo -e "${GREEN}✅ You're ready to configure your Render environment variables!${NC}"
echo ""
echo -e "${BLUE}Need help? Check the deployment guide:${NC}"
echo "📖 RENDER_DEPLOYMENT_GUIDE.md"
echo "📋 DEPLOYMENT_CHECKLIST.md"
echo ""