# Production Database Setup Guide

This guide will help you migrate your car wash booking application from SQLite to PostgreSQL for production deployment on Netlify.

## Prerequisites

1. **Supabase Account** (recommended free PostgreSQL hosting)
   - Sign up at https://supabase.com
   - Create a new project
   - Note down your project reference and password

2. **Netlify Account**
   - Your app should already be connected to Netlify

## Step 1: Create PostgreSQL Database (Supabase)

1. Go to https://app.supabase.com/projects
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `car-wash-booking-prod`
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be created (2-3 minutes)

## Step 2: Get Database Connection String

1. In your Supabase dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection string** → **Nodejs**
3. Copy the connection string that looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the password you set when creating the project

## Step 3: Configure Environment Variables

### For Local Testing
1. Update `.env.local` with your PostgreSQL URL:
   ```bash
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
   ```

### For Netlify Production
1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add these variables:

#### Required Variables
```bash
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
NEXTAUTH_URL="https://your-app-name.netlify.app"
NEXTAUTH_SECRET="your-super-secret-jwt-token-for-production"
NODE_ENV="production"
```

#### Optional Variables (if you're using these services)
```bash
SENDGRID_API_KEY="SG.[YOUR-SENDGRID-API-KEY]"
SENDER_EMAIL="noreply@yourdomain.com"
TWILIO_ACCOUNT_SID="AC[YOUR-TWILIO-SID]"
TWILIO_AUTH_TOKEN="[YOUR-TWILIO-AUTH-TOKEN]"
TWILIO_PHONE_NUMBER="+[YOUR-TWILIO-PHONE]"
STRIPE_SECRET_KEY="sk_live_[YOUR-STRIPE-LIVE-KEY]"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="[YOUR-GOOGLE-MAPS-API-KEY]"
```

## Step 4: Run Database Migrations

### Local Setup (Test First)
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate:prod

# Optional: Seed the database
npm run prisma:seed
```

### Production Setup Script
Run the automated setup script:
```bash
./scripts/setup-production-db.sh
```

## Step 5: Deploy to Netlify

```bash
npm run deploy:netlify
```

## Verification Steps

1. **Check Database**: Log into Supabase dashboard and verify tables were created
2. **Test App**: Visit your Netlify URL and test basic functionality
3. **Check Logs**: Monitor Netlify function logs for any database connection issues

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL is correctly formatted
- Check Supabase project is running (not paused)
- Ensure IP restrictions allow Netlify's IPs (usually not needed for Supabase)

### Migration Errors
- Check Prisma schema is valid for PostgreSQL
- Ensure no SQLite-specific syntax remains
- Verify all environment variables are set

### Build Failures
- Ensure `npm run prisma:generate` runs successfully
- Check that all dependencies are installed
- Verify Node.js version compatibility

## Environment Variable Summary

Copy these to your Netlify environment variables (replace bracketed values):

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
NEXTAUTH_URL=https://[YOUR-APP-NAME].netlify.app
NEXTAUTH_SECRET=[RANDOM-SECRET-STRING]
NODE_ENV=production
```

## Security Notes

- Never commit `.env.production` to git
- Use strong, unique passwords for production
- Rotate secrets regularly
- Monitor database access logs
- Consider enabling Row Level Security in Supabase for additional protection