# Netlify Functions Integration Guide

## Overview

The booking system has been converted to use **Netlify Functions** to enable API functionality on a statically exported Next.js site.

## What Changed?

### ✅ Created Netlify Functions

The following API routes were converted to Netlify Functions:

1. **`/api/services`** → `netlify/functions/services-index.ts`
   - GET: Fetch all services (with optional `?active=true` filter)

2. **`/api/services/:id`** → `netlify/functions/services-id.ts`
   - GET: Fetch single service by ID

3. **`/api/bookings/availability`** → `netlify/functions/bookings-availability.ts`
   - GET: Check available time slots for a service on a date
   - Query params: `?date=YYYY-MM-DD&serviceId=123`

4. **`/api/bookings/create`** → `netlify/functions/bookings-create.ts`
   - POST: Create new booking
   - Sends confirmation email via SendGrid
   - Stores booking in Supabase database

5. **`/api/payment/create-session`** → `netlify/functions/payment-create-session.ts`
   - POST: Create Stripe checkout session
   - Returns payment URL for customer

6. **`/api/payment/webhook`** → `netlify/functions/payment-webhook.ts`
   - POST: Handle Stripe webhook events
   - Updates booking status when payment completes

### ✅ Updated Configuration Files

**netlify.toml** - Added API route redirects:
```toml
[[redirects]]
  from = "/api/services"
  to = "/.netlify/functions/services-index"
  status = 200
```

**next.config.js** - Restored static export:
```js
output: 'export', // Static export - API routes handled by Netlify Functions
```

**tsconfig.json** - Excluded Netlify Functions from type checking:
```json
"exclude": ["node_modules", "netlify/functions/**/*"]
```

## How It Works

1. **Frontend** makes requests to `/api/*` routes (same as before)
2. **Netlify** redirects those requests to `/.netlify/functions/*`
3. **Serverless Functions** execute and connect to:
   - Supabase database (via Prisma)
   - Stripe payment API
   - SendGrid email API
4. **Response** is sent back to frontend

## Environment Variables Required

Make sure these are set in **Netlify Dashboard** → **Site Settings** → **Environment Variables**:

### Database
- `DATABASE_URL` - Supabase connection string (use session pooler)

### Email
- `SENDGRID_API_KEY` - SendGrid API key
- `SENDER_EMAIL` - From email address

### Payments
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe public key (for frontend)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

### Site
- `NEXT_PUBLIC_SITE_URL` - Your site URL (e.g., https://kiiltoloisto.fi)

## Testing Locally

### 1. Install Netlify CLI
```bash
npm install -g netlify-cli
```

### 2. Run Local Development
```bash
netlify dev
```

This runs both:
- Next.js dev server (frontend)
- Netlify Functions (serverless backend)

### 3. Test Functions Directly
```bash
# Test services endpoint
curl http://localhost:8888/api/services?active=true

# Test availability
curl "http://localhost:8888/api/bookings/availability?date=2025-10-15&serviceId=1"
```

## Deployment

### First Time Setup

1. **Link to Netlify Project**:
```bash
netlify link
```

2. **Set Environment Variables** in Netlify Dashboard

3. **Configure Stripe Webhook**:
   - Go to Stripe Dashboard → Webhooks
   - Add endpoint: `https://kiiltoloisto.fi/api/payment/webhook`
   - Select events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`
   - Copy webhook secret to `STRIPE_WEBHOOK_SECRET` env var

### Deploy

```bash
# Build and deploy
npm run build
netlify deploy --prod
```

Or push to Git - Netlify auto-deploys:
```bash
git add .
git commit -m "Add Netlify Functions for booking system"
git push
```

## Monitoring Functions

### Netlify Dashboard
- **Functions** tab shows:
  - Invocation count
  - Error rate
  - Execution time
  - Logs

### Check Function Logs
```bash
netlify functions:log
```

### View Recent Deployments
```bash
netlify open:site
```

## Troubleshooting

### ❌ Functions not working after deployment

**Check:**
1. Environment variables are set in Netlify Dashboard
2. Database URL uses **session pooler** (not direct connection)
3. Stripe webhook secret matches the one in Stripe Dashboard

### ❌ Database connection errors

**Solution:**
- Use Supabase **Session Pooler** connection string
- Format: `postgres://postgres.xxx:6543/postgres?pgbouncer=true`
- Set in `DATABASE_URL` environment variable

### ❌ CORS errors in browser

**Solution:**
- Functions include CORS headers automatically
- Check browser console for specific error
- Ensure `NEXT_PUBLIC_SITE_URL` is set correctly

### ❌ Build fails on Netlify

**Check:**
1. All dependencies in `package.json`
2. Node version (use `.nvmrc` or set in Netlify)
3. Build command: `npm run build`
4. Publish directory: `out`

## Important Notes

⚠️ **Static Export Limitations:**
- No server-side rendering (SSR)
- No API routes in `/pages/api` (use Netlify Functions instead)
- Images must use `unoptimized: true`

✅ **What Still Works:**
- Static page generation
- Client-side routing
- API calls to Netlify Functions
- Database operations via Functions
- Payments via Stripe
- Email sending via SendGrid

## Next Steps

1. ✅ Test booking flow on deployed site
2. ✅ Verify email confirmations arrive
3. ✅ Test Stripe payment integration
4. ✅ Monitor function execution times
5. ✅ Set up error tracking (Sentry recommended)

## Support

- **Netlify Docs**: https://docs.netlify.com/functions/overview/
- **Next.js Static Export**: https://nextjs.org/docs/app/building-your-application/deploying/static-exports
- **Your Project**: https://app.netlify.com/sites/kiiltoloisto/overview
