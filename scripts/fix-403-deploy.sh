#!/bin/bash

# Fix 403 Error and Deploy to Netlify
# This script addresses the 403 Forbidden error on kiiltoloisto.fi

set -e

echo "🚀 Starting fix for 403 error on kiiltoloisto.fi"
echo "================================================"

# Step 1: Clean build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf .next out node_modules/.cache

# Step 2: Install dependencies (if needed)
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci || npm install
fi

# Step 3: Generate Prisma client
echo "🗃️ Generating Prisma client..."
npx prisma generate

# Step 4: Build the project
echo "🔨 Building Next.js project..."
npm run build

# Step 5: Check build output
if [ -d ".next" ]; then
    echo "✅ Build successful - .next directory created"
else
    echo "❌ Build failed - .next directory not found"
    exit 1
fi

# Step 6: Deploy to Netlify
echo "🚀 Deploying to Netlify..."
netlify deploy --prod --dir=.next --site=9753561d-0777-4b0c-a669-324e3d49b8ee || {
    echo "❌ Deployment failed"
    echo "Please ensure you have the Netlify CLI installed and logged in"
    echo "Run: npm install -g netlify-cli && netlify login"
    exit 1
}

echo "================================================"
echo "✅ Deployment complete!"
echo "🌐 Visit https://kiiltoloisto.fi to verify the fix"
echo ""
echo "⚡ Next steps to verify:"
echo "1. Check if homepage loads without 403 error"
echo "2. Test booking page at /booking"
echo "3. Verify API endpoints still work"
echo "4. Run performance tests"