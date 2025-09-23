# Deployment Guide

## 🚀 Overview

Complete deployment guide for the KiiltoLoisto Car Wash Booking System on Netlify with secure production configuration.

## 📋 Prerequisites

### Required Accounts & Services
- [Netlify](https://netlify.com) account with Pro plan (for advanced security features)
- [PostgreSQL](https://supabase.com) database (Supabase recommended)
- [Stripe](https://stripe.com) account for payments
- [SendGrid](https://sendgrid.com) account for emails
- [Twilio](https://twilio.com) account for SMS (optional)
- [Google reCAPTCHA](https://www.google.com/recaptcha) v3 keys
- [Sentry](https://sentry.io) account for monitoring
- [GitHub](https://github.com) repository with Actions enabled

### Development Tools
- Node.js 18+ and npm
- Git
- Prisma CLI (`npm install -g prisma`)

## 🔧 Initial Setup

### 1. Repository Preparation

```bash
# Clone the repository
git clone <your-repo-url>
cd car-wash-booking

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
```

### 2. Database Setup

#### Option A: Supabase (Recommended)
1. Create new project at [supabase.com](https://supabase.com)
2. Copy PostgreSQL connection string from Settings > Database
3. Note: Format should be `postgresql://postgres:[password]@[host]:[port]/postgres`

#### Option B: Self-hosted PostgreSQL
```bash
# Create database
createdb carwash_production

# Set connection string
export DATABASE_URL="postgresql://username:password@localhost:5432/carwash_production"
```

### 3. Environment Variables Setup

Create production environment file:

```bash
# Copy template
cp .env.production.template .env.local

# Edit with your values
nano .env.local
```

#### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"

# Authentication (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET="your-32-character-secret-here"
NEXTAUTH_URL="https://your-domain.netlify.app"

# Email Service (SendGrid)
SENDGRID_API_KEY="SG.your-sendgrid-api-key"
FROM_EMAIL="noreply@kiiltoloisto.fi"

# SMS Service (Twilio - Optional)
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"

# Payment (Stripe)
STRIPE_PUBLISHABLE_KEY="pk_live_your-stripe-publishable-key"
STRIPE_SECRET_KEY="sk_live_your-stripe-secret-key"
STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret"

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="your-site-key"
RECAPTCHA_SECRET_KEY="your-secret-key"

# Monitoring (Sentry)
NEXT_PUBLIC_SENTRY_DSN="https://your-sentry-dsn"
SENTRY_TRACES_SAMPLE_RATE="0.1"

# Security
CORS_ALLOWED_ORIGINS="https://kiiltoloisto.fi,https://www.kiiltoloisto.fi"
ENABLE_RATE_LIMITING="true"
ENABLE_CSRF="true"

# Backup (generate with: openssl rand -hex 32)
BACKUP_ENCRYPTION_KEY="your-64-character-hex-key"
BACKUP_STORAGE_TYPE="s3"
S3_BACKUP_BUCKET="car-wash-backups"
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"

# Monitoring Webhook
MONITORING_WEBHOOK_URL="https://your-monitoring-service.com/webhook"
```

## 🗄️ Database Migration

### 1. Run Migrations

```bash
# Deploy database schema
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

### 2. Verify Database

```bash
# Open Prisma Studio to verify
npx prisma studio
```

Expected tables:
- Service (with your 4 services)
- User (admin user)
- Booking, TimeSlot, BusinessHours, etc.

## 🌐 Netlify Deployment

### 1. Create Netlify Site

#### Via Netlify Dashboard
1. Go to [app.netlify.com](https://app.netlify.com)
2. Click "New site from Git"
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `out`
   - **Node version**: `18`

#### Via Netlify CLI (Alternative)
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Create new site
netlify init

# Deploy
netlify deploy --prod
```

### 2. Configure Environment Variables

In Netlify Dashboard:
1. Go to Site Settings > Environment Variables
2. Add all variables from your `.env.local`
3. Ensure sensitive keys are marked as "sensitive"

### 3. Configure Build Settings

Ensure these build settings in Netlify:

```toml
# netlify.toml is already configured in the repo
[build]
  command = "npm run build"
  publish = "out"

[build.environment]
  NODE_VERSION = "18"
  NPM_FLAGS = "--production=false"
```

### 4. Custom Domain Setup (Optional)

1. **Add Custom Domain**:
   - Site Settings > Domain Management
   - Add domain: `kiiltoloisto.fi`

2. **Configure DNS**:
   ```
   # Add CNAME record at your DNS provider
   Type: CNAME
   Name: www
   Value: your-site-name.netlify.app

   # Add A record for apex domain
   Type: A
   Name: @
   Value: 75.2.60.5 (Netlify Load Balancer)
   ```

3. **Enable HTTPS**:
   - Domain Settings > HTTPS
   - Force HTTPS redirect

## 🔄 CI/CD Pipeline Setup

### 1. GitHub Secrets

Add these secrets to your GitHub repository (Settings > Secrets and Variables > Actions):

```bash
# Database
DATABASE_URL

# Authentication
NEXTAUTH_SECRET

# Services
SENDGRID_API_KEY
STRIPE_SECRET_KEY
RECAPTCHA_SECRET_KEY
SENTRY_DSN

# Backup
BACKUP_ENCRYPTION_KEY
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_BACKUP_BUCKET

# Netlify
NETLIFY_AUTH_TOKEN
NETLIFY_SITE_ID

# Production
PRODUCTION_URL="https://kiiltoloisto.fi"

# Monitoring
MONITORING_WEBHOOK_URL
CODECOV_TOKEN
SNYK_TOKEN
```

### 2. Pipeline Verification

The GitHub Actions pipeline (`.github/workflows/deploy.yml`) will:

1. **Security Scan**: npm audit + Snyk
2. **Quality Check**: ESLint, TypeScript, Prettier
3. **Testing**: Unit tests with PostgreSQL
4. **Build**: Next.js static export
5. **Deploy**: Automatic Netlify deployment
6. **Verify**: Lighthouse + security headers check
7. **Backup**: Database backup after deployment

## 🧪 Testing Deployment

### 1. Pre-deployment Tests

```bash
# Lint and type check
npm run lint
npx tsc --noEmit

# Run tests
npm test

# Build locally
npm run build

# Test locally
npm start
```

### 2. Smoke Tests

After deployment, verify these endpoints:

```bash
# Homepage
curl -f https://kiiltoloisto.fi/

# Booking page
curl -f https://kiiltoloisto.fi/booking

# API health check
curl -f https://kiiltoloisto.fi/api/health

# Admin login
curl -f https://kiiltoloisto.fi/admin/login
```

### 3. Security Verification

```bash
# Check security headers
curl -I https://kiiltoloisto.fi/

# Verify HSTS
curl -I https://kiiltoloisto.fi/ | grep -i strict-transport-security

# Check CSP
curl -I https://kiiltoloisto.fi/ | grep -i content-security-policy
```

## 🔒 Post-Deployment Security

### 1. Enable Security Features

- **Netlify Security**: Analytics, Form spam filtering
- **Domain Protection**: Enable domain lock in DNS provider
- **Monitoring**: Configure Sentry alerts
- **Backup Schedule**: Verify daily backups are running

### 2. Security Monitoring Setup

Configure these Sentry alerts:
- Payment processing failures
- Authentication errors > 10/hour
- API rate limiting violations
- Database connection failures
- Performance degradation (LCP > 2.5s)

### 3. Backup Verification

```bash
# Test backup creation
curl -X POST https://kiiltoloisto.fi/api/admin/backup \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# List backups
curl https://kiiltoloisto.fi/api/admin/backups \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 📊 Performance Optimization

### 1. Image Optimization

Ensure all images are optimized:
```bash
# Use Next.js Image component
import Image from 'next/image'

# Compress images
npm install -g imagemin-cli
imagemin public/images/* --out-dir=public/images/optimized
```

### 2. Bundle Analysis

```bash
# Analyze bundle size
npm run build:analyze

# Check for large dependencies
npx webpack-bundle-analyzer .next/static/chunks/pages/*.js
```

### 3. Lighthouse Score Targets

Aim for these Lighthouse scores:
- **Performance**: >90
- **Accessibility**: >95
- **Best Practices**: >95
- **SEO**: >95

## 🚨 Troubleshooting

### Common Deployment Issues

#### Build Failures

```bash
# Clear Next.js cache
rm -rf .next

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Database Connection Issues

```bash
# Test database connection
npx prisma db pull

# Reset database
npx prisma migrate reset
npx prisma db seed
```

#### Environment Variable Issues

1. Check Netlify site settings
2. Verify variable names match exactly
3. Ensure no trailing spaces or quotes
4. Check for special characters that need escaping

### Performance Issues

#### Slow Loading
- Check bundle size with `npm run build:analyze`
- Optimize images with Next.js Image component
- Enable Netlify's caching and compression

#### Database Slow Queries
- Check Prisma query performance
- Add database indexes for frequent queries
- Monitor with Sentry performance tracking

### Security Issues

#### CORS Errors
```bash
# Check CORS configuration in middleware.ts
# Verify CORS_ALLOWED_ORIGINS environment variable
```

#### CSP Violations
```bash
# Check browser console for CSP errors
# Update CSP policy in netlify.toml if needed
```

## 📞 Support & Maintenance

### Daily Checks
- [ ] Review Sentry errors
- [ ] Check backup completion logs
- [ ] Monitor site performance metrics

### Weekly Maintenance
- [ ] Review security logs
- [ ] Check dependency updates
- [ ] Verify backup integrity

### Monthly Tasks
- [ ] Security vulnerability scan
- [ ] Performance optimization review
- [ ] Backup restoration test
- [ ] Update documentation

### Emergency Contacts
- **Primary**: devops@kiiltoloisto.fi
- **Backup**: admin@kiiltoloisto.fi
- **Emergency**: +358-xxx-xxx-xxxx

### Service Status Pages
- [Netlify Status](https://www.netlifystatus.com/)
- [Stripe Status](https://status.stripe.com/)
- [SendGrid Status](https://status.sendgrid.com/)
- [Supabase Status](https://status.supabase.com/)

---

*Last Updated: January 2025*
*Version: 1.0.0*

## 📚 Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Netlify Documentation](https://docs.netlify.com/)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [Stripe Integration Guide](https://stripe.com/docs/payments/quickstart)