# Architecture Overview

## Technology Stack
- **Frontend:** Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js with bcrypt
- **External Services:** SendGrid (email), Twilio (SMS), Stripe (payments)
- **Deployment:** Netlify/Vercel with serverless functions

## Project Structure
```
car-wash-booking/
├── docs/                 # Consolidated documentation
├── prisma/              # Database schema and migrations
├── public/              # Static assets
├── src/
│   ├── app/            # Next.js 13+ app router
│   ├── components/     # Reusable React components
│   ├── lib/           # Utility libraries and configurations
│   ├── pages/         # Legacy pages (if any)
│   └── styles/        # Global styles
├── tests/             # Test suites
└── scripts/           # Build and deployment scripts
```

## Key Features

### Core Functionality
- **Booking System**: Multi-service booking with availability checking
- **Admin Dashboard**: Complete management interface
- **Payment Processing**: Stripe integration ready
- **Notifications**: Email and SMS confirmations
- **Multi-language**: Finnish/English support

### Technical Features
- **Performance**: Optimized with caching and image optimization
- **Security**: Input validation, authentication, audit logging
- **Testing**: Jest unit tests, Playwright e2e tests
- **Monitoring**: Sentry error tracking, performance metrics
- **PWA**: Progressive Web App capabilities

## Database Schema

### Core Entities
- **Services**: Car wash service types with pricing and duration
- **Bookings**: Customer reservations with status tracking
- **Users**: Admin users with role-based access
- **Testimonials**: Customer reviews with approval workflow
- **Settings**: Site configuration and business settings

## API Design

### Public Endpoints
- `GET /api/services` - List available services
- `POST /api/bookings` - Create new booking
- `POST /api/testimonials` - Submit review

### Admin Endpoints (Protected)
- `GET /api/admin/bookings` - List all bookings
- `PUT /api/admin/bookings/[id]` - Update booking status
- CRUD operations for services, testimonials, settings

## Security Model
- NextAuth.js session management
- Bcrypt password hashing
- Input validation with Zod
- Environment variable protection
- CSRF protection
- Rate limiting on API endpoints