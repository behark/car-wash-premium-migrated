#!/bin/bash

# Production deployment script for Car Wash Booking System
# This script sets up and deploys the application in production mode

set -e

echo "🚀 Starting production deployment..."

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production file not found!"
    echo "Please create .env.production with your production environment variables."
    echo "Use .env.example as a template."
    exit 1
fi

# Validate required environment variables
required_vars=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET"
    "NEXTAUTH_URL"
    "ADMIN_EMAIL"
    "ADMIN_PASSWORD"
    "SENDGRID_API_KEY"
    "SENDER_EMAIL"
    "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN"
    "TWILIO_FROM"
)

echo "🔍 Validating environment variables..."
source .env.production

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env.production"
        exit 1
    fi
done

# Validate database URL format for production
if [[ "$DATABASE_URL" == *"file:"* ]]; then
    echo "❌ Error: SQLite database detected. Production requires PostgreSQL."
    echo "Please update DATABASE_URL to use PostgreSQL."
    exit 1
fi

echo "✅ Environment validation passed"

# Build and start services
echo "🔧 Building application..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache

echo "🗄️ Starting database..."
docker-compose -f docker-compose.prod.yml up -d db

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
timeout=60
while ! docker-compose -f docker-compose.prod.yml exec -T db pg_isready -U ${POSTGRES_USER:-postgres} > /dev/null 2>&1; do
    if [ $timeout -eq 0 ]; then
        echo "❌ Error: Database failed to start within 60 seconds"
        exit 1
    fi
    echo "Waiting for database... ($timeout seconds remaining)"
    sleep 1
    ((timeout--))
done

echo "✅ Database is ready"

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# Seed the database
echo "🌱 Seeding database..."
docker-compose -f docker-compose.prod.yml run --rm app npm run prisma:seed

# Start all services
echo "🚀 Starting all services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for application to be ready
echo "⏳ Waiting for application to be ready..."
timeout=120
while ! curl -f http://localhost:3000/api/health > /dev/null 2>&1; do
    if [ $timeout -eq 0 ]; then
        echo "❌ Error: Application failed to start within 120 seconds"
        echo "Check logs: docker-compose -f docker-compose.prod.yml logs app"
        exit 1
    fi
    echo "Waiting for application... ($timeout seconds remaining)"
    sleep 1
    ((timeout--))
done

echo "✅ Application is ready"

# Run health checks
echo "🏥 Running health checks..."
if curl -f http://localhost:3000/api/health; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    exit 1
fi

echo ""
echo "🎉 Production deployment completed successfully!"
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.prod.yml ps
echo ""
echo "🌐 Application URL: http://localhost:3000"
echo "📋 Admin Panel: http://localhost:3000/admin/bookings"
echo ""
echo "📝 Next Steps:"
echo "1. Configure your domain and SSL certificates"
echo "2. Update NEXTAUTH_URL in .env.production to your domain"
echo "3. Set up monitoring and backup procedures"
echo "4. Test the booking flow end-to-end"
echo ""
echo "📚 Useful Commands:"
echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  Stop services: docker-compose -f docker-compose.prod.yml down"
echo "  Update: ./scripts/deploy-production.sh"