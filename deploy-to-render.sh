#!/bin/bash
# Render Deployment Script
# This script helps prepare the project for Render deployment

set -e

echo "🚀 Preparing KiiltoLoisto Autopesu for Render deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --include=dev

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npx prisma generate

# Build the application
echo "🔨 Building Next.js application..."
npm run build

# Test the build
echo "🧪 Testing the built application..."
if [ -d ".next" ]; then
    echo "✅ Build successful! .next directory created."
else
    echo "❌ Build failed! .next directory not found."
    exit 1
fi

echo ""
echo "🎉 Project ready for Render deployment!"
echo ""
echo "Next steps:"
echo "1. Push this code to your GitHub repository"
echo "2. Connect your repository to Render"
echo "3. Use the render.yaml file for automatic configuration"
echo "4. Set up required environment variables in Render dashboard:"
echo "   - STRIPE_SECRET_KEY"
echo "   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
echo "   - STRIPE_WEBHOOK_SECRET"
echo "   - SENDGRID_API_KEY"
echo "   - SENDER_EMAIL"
echo ""
echo "Optional environment variables:"
echo "   - SENTRY_DSN"
echo "   - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
echo "   - NEXT_PUBLIC_GA_ID"
echo ""
echo "📖 See RENDER_DEPLOYMENT_GUIDE.md for detailed instructions."