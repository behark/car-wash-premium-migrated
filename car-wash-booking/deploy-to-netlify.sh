#!/bin/bash

# Kiilto & Loisto - Automated Netlify Deployment Script
# This script will create a new Netlify site with all environment variables configured

echo "🚀 Starting Kiilto & Loisto Netlify Deployment..."

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "📦 Installing Netlify CLI..."
    npm install -g netlify-cli
fi

# Site name for Netlify (will be kiiltoloisto-fi.netlify.app)
SITE_NAME="kiiltoloisto-fi"

echo "📱 Creating new Netlify site: $SITE_NAME"

# Initialize Netlify site
netlify init --manual

# Link to the site (if it exists)
netlify link --name $SITE_NAME || echo "Site not found, will be created on deploy"

echo "🔧 Setting up environment variables..."

# Set all environment variables
netlify env:set DATABASE_URL "postgresql://postgres.tamqwcfugkbnaqafbybb:Beharkabashi1@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
netlify env:set NEXTAUTH_URL "https://www.kiiltoloisto.fi"
netlify env:set NEXTAUTH_SECRET "WNGfvn2++iKjICRXfaYuBSmm06mBL+1O6Utj3Ln+QG0="
netlify env:set NODE_ENV "production"
netlify env:set SENDER_EMAIL "kroiautocenter@gmail.com"
netlify env:set CONTACT_EMAIL "Info@kiiltoloisto.fi"

echo "📦 Building the project..."
npm run build

echo "🚀 Deploying to Netlify..."
netlify deploy --prod --dir=out --site=$SITE_NAME

echo "🌐 Setting up custom domain..."
netlify domains:add kiiltoloisto.fi
netlify domains:add www.kiiltoloisto.fi

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update your domain DNS settings:"
echo "   - Add CNAME record: www -> kiiltoloisto-fi.netlify.app"
echo "   - Add A record: @ -> 75.2.60.5"
echo "2. Enable HTTPS in Netlify dashboard"
echo "3. Your site will be live at: https://www.kiiltoloisto.fi"
echo ""
echo "🎉 Site URLs:"
echo "   Netlify: https://$SITE_NAME.netlify.app"
echo "   Custom: https://www.kiiltoloisto.fi"