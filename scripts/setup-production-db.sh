#!/bin/bash

# Setup Production Database Script
# This script helps migrate from SQLite to PostgreSQL for production deployment

echo "🚀 Setting up production database for car wash booking app..."

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found. Please create it first with your production environment variables."
    exit 1
fi

# Load production environment variables
export $(cat .env.production | grep -v '#' | xargs)

# Validate DATABASE_URL
if [[ -z "$DATABASE_URL" ]]; then
    echo "❌ DATABASE_URL not set in .env.production"
    exit 1
fi

if [[ $DATABASE_URL != postgresql* ]]; then
    echo "❌ DATABASE_URL should start with 'postgresql://' for PostgreSQL"
    exit 1
fi

echo "✅ Found PostgreSQL DATABASE_URL"

# Generate Prisma client
echo "📦 Generating Prisma client..."
npm run prisma:generate

# Run database migrations
echo "🔄 Running database migrations..."
npm run prisma:migrate:prod

# Optional: Seed the database (uncomment if you want to seed production)
# echo "🌱 Seeding database..."
# npm run prisma:seed

echo "✅ Production database setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set these environment variables in Netlify:"
echo "   - DATABASE_URL"
echo "   - NEXTAUTH_URL"
echo "   - NEXTAUTH_SECRET"
echo "   - SENDGRID_API_KEY (optional)"
echo "   - TWILIO_ACCOUNT_SID (optional)"
echo "   - TWILIO_AUTH_TOKEN (optional)"
echo "   - STRIPE_SECRET_KEY (optional)"
echo "   - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (optional)"
echo ""
echo "2. Deploy to Netlify:"
echo "   npm run deploy:netlify"