#!/bin/bash

# Car Wash Booking System - Quick Start Script
# This script sets up the development environment automatically

set -e

echo "🚗 Car Wash Booking System - Quick Start Setup"
echo "==============================================="

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup environment file
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "⚙️ Creating .env from .env.example..."
        cp .env.example .env
        echo "📝 Please edit .env file with your database URL and other settings"
    else
        echo "⚙️ Creating basic .env file..."
        cat > .env << EOF
# Database (Update with your PostgreSQL URL)
DATABASE_URL="postgresql://user:password@localhost:5432/carwash"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# Optional Services (uncomment and configure as needed)
# SENDGRID_API_KEY="SG.your_api_key"
# TWILIO_ACCOUNT_SID="ACxxxxx"
# TWILIO_AUTH_TOKEN="your_token"
# TWILIO_FROM="+1234567890"
# NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your_google_maps_key"
# STRIPE_SECRET_KEY="sk_test_xxx"
EOF
        echo "✅ Basic .env file created"
    fi
else
    echo "✅ .env file already exists"
fi

# Check if DATABASE_URL is configured
if grep -q "postgresql://user:password" .env 2>/dev/null; then
    echo "⚠️  Please update DATABASE_URL in .env with your actual database credentials"
    echo "   Example: postgresql://username:password@localhost:5432/database_name"
fi

# Setup database (if configured)
echo "🗄️ Setting up database..."
if npx prisma db execute --command="SELECT 1" &>/dev/null; then
    echo "✅ Database connection successful"

    echo "🔄 Running database migrations..."
    npx prisma migrate dev --name init

    echo "🔧 Generating Prisma client..."
    npx prisma generate

    echo "🌱 Seeding database with sample data..."
    npx prisma db seed

    echo "✅ Database setup complete"
else
    echo "⚠️  Database connection failed. Please:"
    echo "   1. Make sure PostgreSQL is running"
    echo "   2. Update DATABASE_URL in .env file"
    echo "   3. Run: npx prisma migrate dev --name init"
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo ""
echo "1. Update .env file with your database URL and service credentials"
echo "2. Start development server: npm run dev"
echo "3. Visit: http://localhost:3000"
echo "4. Admin login: admin@example.com / admin123"
echo ""
echo "📚 Documentation available in docs/ folder"
echo "🛠️  Development guide: docs/DEVELOPMENT.md"
echo "🚀 Deployment guide: docs/DEPLOYMENT.md"
echo ""
echo "Happy coding! 🚀"