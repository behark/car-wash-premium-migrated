# Netlify Environment Variables

## Required Environment Variables for Deployment

Copy and paste these environment variables into your Netlify dashboard:

**Site Settings > Environment Variables > Import Environment Variables**

```env
# Database Configuration
DATABASE_URL=postgresql://postgres.tamqwcfugkbnaqafbybb:123b123behar123@aws-1-eu-central-1.pooler.supabase.com:6543/postgres

# Application Environment
NODE_ENV=production

# Frontend URL (update after deployment)
FRONTEND_URL=https://your-netlify-domain.netlify.app

# Authentication (if using NextAuth)
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=https://your-netlify-domain.netlify.app

# Database Pool Settings
DB_MAX_CONNECTIONS=10
DB_POOL_TIMEOUT=10
DB_CONNECT_TIMEOUT=10

# Monitoring Settings
ENABLE_DB_MONITORING=true
SLOW_QUERY_THRESHOLD=1000
MAX_QUERY_HISTORY=100
```

## Optional Environment Variables

Add these if you have the corresponding services configured:

```env
# Email Service (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDER_EMAIL=noreply@your-domain.com

# Stripe Payments
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Twilio SMS
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# AWS S3 (if using file uploads)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_BUCKET_NAME=your-s3-bucket-name
AWS_REGION=us-east-1

# Error Tracking (Sentry)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Analytics (PostHog)
NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

## Netlify Build Settings

**Build Command:** `npm run build`
**Publish Directory:** `.next`
**Node Version:** `18.x`

## Important Notes

1. **Never commit** these values to your repository
2. **Update FRONTEND_URL** after getting your Netlify domain
3. **Update NEXTAUTH_URL** to match your Netlify domain
4. **Generate a strong NEXTAUTH_SECRET** using: `openssl rand -base64 32`

## Next Steps

1. Deploy to Netlify from your GitHub repository
2. Add environment variables in Netlify dashboard
3. Update URLs to match your deployed domain
4. Test the deployment