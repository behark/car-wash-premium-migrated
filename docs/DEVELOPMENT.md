# Development Guide

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Git

### Setup
```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Configure database
# Edit .env with your DATABASE_URL

# 4. Setup database
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed

# 5. Start development server
npm run dev
```

Visit `http://localhost:3000`

## Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm start              # Start production server

# Database
npx prisma studio      # Open database GUI
npx prisma migrate dev # Create new migration
npx prisma db seed     # Seed database

# Testing
npm test              # Run unit tests
npm run test:e2e      # Run e2e tests
npm run test:coverage # Test coverage

# Code Quality
npm run lint          # ESLint check
npm run type-check    # TypeScript check
```

## Optional Services Configuration

### Email (SendGrid)
```env
SENDGRID_API_KEY="SG.your_api_key"
```
- **Required for**: Booking confirmations, admin notifications
- **Fallback**: Bookings work without email, just no notifications
- **Setup**: Create account at sendgrid.com

### SMS (Twilio)
```env
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="your_token"
TWILIO_FROM="+1234567890"
```
- **Required for**: SMS booking confirmations
- **Fallback**: Email notifications used instead
- **Setup**: Create account at twilio.com

### Maps (Google Maps)
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your_api_key"
```
- **Required for**: Location map display
- **Fallback**: Address shown as text
- **Setup**: Enable Maps JavaScript API in Google Cloud Console

### Payments (Stripe)
```env
STRIPE_SECRET_KEY="sk_test_xxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxx"
```
- **Required for**: Online payments (currently prepared but not active)
- **Fallback**: Manual payment handling
- **Setup**: Create account at stripe.com

## Admin Access
- **Default login**: admin@example.com / admin123
- **Dashboard**: `/admin/login`
- **Change password**: Through admin settings after first login

## Testing Strategy

### Local Testing
```bash
# Test booking flow
node scripts/test-booking-flow.js

# Test API endpoints
node scripts/test-api-endpoints.js

# Test complete system
node scripts/test-complete-flow.js
```

### Database Testing
```bash
# Reset to clean state
npx prisma migrate reset --force

# Reseed with test data
npx prisma db seed
```

## Troubleshooting

### Common Issues
1. **Port already in use**: Change port with `PORT=3001 npm run dev`
2. **Database connection failed**: Check DATABASE_URL and PostgreSQL service
3. **Build errors**: Clear cache with `rm -rf .next node_modules && npm install`
4. **TypeScript errors**: Run `npm run type-check` for detailed errors

### Debug Mode
```env
# Add to .env for detailed logging
NEXTAUTH_DEBUG=true
DEBUG="prisma:*"
NODE_ENV=development
```