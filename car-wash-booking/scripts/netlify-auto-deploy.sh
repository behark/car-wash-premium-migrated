#!/bin/bash

# Netlify Auto-Deploy Script with Environment Variable Management
# This script sets up and deploys the car wash booking system to Netlify

set -e

echo "🚀 Starting Netlify Auto-Deploy Setup..."

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "📦 Installing Netlify CLI..."
    npm install -g netlify-cli
fi

# Login to Netlify (if not already logged in)
if ! netlify status &> /dev/null; then
    echo "🔑 Please login to Netlify..."
    netlify login
fi

# Your Netlify site ID
SITE_ID="ac4384a0-5e6c-4f20-9d26-073934d6d8db"

echo "🔧 Setting up site with ID: $SITE_ID"

# Link to existing site
netlify link --id $SITE_ID

# Generate secure secrets
echo "🔐 Generating secure secrets..."
NEXTAUTH_SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-20)

echo "Generated secrets:"
echo "NEXTAUTH_SECRET: $NEXTAUTH_SECRET"
echo "ADMIN_PASSWORD: $ADMIN_PASSWORD"

# Set environment variables that we can set automatically
echo "📝 Setting up environment variables..."

netlify env:set NEXTAUTH_SECRET "$NEXTAUTH_SECRET"
netlify env:set ADMIN_PASSWORD "$ADMIN_PASSWORD"
netlify env:set NODE_ENV "production"
netlify env:set LOG_LEVEL "INFO"

# Set default admin email (user can change this)
netlify env:set ADMIN_EMAIL "admin@carwash-booking.netlify.app"

echo "✅ Auto-configured environment variables:"
echo "- NEXTAUTH_SECRET (secure 64-char secret)"
echo "- ADMIN_PASSWORD (secure 20-char password)"
echo "- NODE_ENV (production)"
echo "- LOG_LEVEL (INFO)"
echo "- ADMIN_EMAIL (default - you can change this)"

echo ""
echo "⚠️  MANUAL CONFIGURATION STILL NEEDED:"
echo ""
echo "🗄️  1. DATABASE (Supabase - 5 minutes):"
echo "   - Go to https://supabase.com"
echo "   - Create new project"
echo "   - Copy connection string"
echo "   - Run: netlify env:set DATABASE_URL 'your-connection-string'"
echo ""
echo "📧 2. EMAIL (SendGrid - 5 minutes):"
echo "   - Go to https://sendgrid.com"
echo "   - Create API key"
echo "   - Run: netlify env:set SENDGRID_API_KEY 'SG.your-key'"
echo "   - Run: netlify env:set SENDER_EMAIL 'noreply@yourdomain.com'"
echo ""
echo "📱 3. SMS (Twilio - 5 minutes):"
echo "   - Go to https://twilio.com"
echo "   - Get credentials"
echo "   - Run: netlify env:set TWILIO_ACCOUNT_SID 'ACyour-sid'"
echo "   - Run: netlify env:set TWILIO_AUTH_TOKEN 'your-token'"
echo "   - Run: netlify env:set TWILIO_FROM '+1234567890'"
echo ""

# Create a quick setup guide file
cat > QUICK_SETUP.md << EOF
# 🚀 Quick Setup Guide

Your Netlify site is linked and partially configured!

## ✅ Already Configured:
- NEXTAUTH_SECRET: $NEXTAUTH_SECRET
- ADMIN_PASSWORD: $ADMIN_PASSWORD
- Basic environment settings

## 🔧 Complete These Steps:

### 1. Database (5 min)
\`\`\`bash
# Go to supabase.com, create project, then:
netlify env:set DATABASE_URL "postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
\`\`\`

### 2. Email (5 min)
\`\`\`bash
# Go to sendgrid.com, create API key, then:
netlify env:set SENDGRID_API_KEY "SG.your-api-key"
netlify env:set SENDER_EMAIL "noreply@yourdomain.com"
\`\`\`

### 3. SMS (5 min)
\`\`\`bash
# Go to twilio.com, get credentials, then:
netlify env:set TWILIO_ACCOUNT_SID "ACyour-account-sid"
netlify env:set TWILIO_AUTH_TOKEN "your-auth-token"
netlify env:set TWILIO_FROM "+1234567890"
\`\`\`

### 4. Deploy
\`\`\`bash
netlify deploy --prod
\`\`\`

### 5. Initialize Database
After deployment, visit: https://your-site.netlify.app/api/setup (POST request)

## 🎉 Your Admin Credentials:
- Email: admin@carwash-booking.netlify.app (change with env var)
- Password: $ADMIN_PASSWORD
EOF

echo "📋 Quick setup guide created: QUICK_SETUP.md"
echo ""

# Ask if user wants to deploy now
read -p "🚀 Would you like to deploy now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🏗️  Building and deploying..."
    netlify deploy --prod

    SITE_URL=$(netlify status --json | jq -r '.site_url')
    echo ""
    echo "🎉 Deployment complete!"
    echo "🌐 Site URL: $SITE_URL"
    echo "⚙️  Config check: $SITE_URL/api/config"
    echo "🛠️  Setup endpoint: $SITE_URL/api/setup"
    echo ""
    echo "📝 Next steps:"
    echo "1. Complete the 3 external service setups (15 min total)"
    echo "2. Visit $SITE_URL/api/setup to initialize database"
    echo "3. Test booking flow"
else
    echo "📋 Setup prepared! Run 'netlify deploy --prod' when ready."
fi

echo ""
echo "🔑 Save these credentials securely:"
echo "Admin Password: $ADMIN_PASSWORD"
echo "NextAuth Secret: $NEXTAUTH_SECRET"