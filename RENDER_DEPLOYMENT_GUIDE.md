# 🚀 Complete Render Deployment Guide

## Car Wash Booking System - Production Deployment

This guide will walk you through deploying your car wash booking system to Render with full production features including PostgreSQL database, Redis cache, real-time WebSocket features, and comprehensive monitoring.

---

## 📋 Prerequisites

Before starting the deployment, ensure you have:

- [ ] A Render account (free tier available)
- [ ] Your application code pushed to a GitHub repository
- [ ] Stripe account for payment processing
- [ ] SendGrid account for email notifications
- [ ] (Optional) Sentry account for error monitoring

---

## 🔧 Step 1: Environment Variables Setup

### Required Environment Variables

Add these to your Render service's Environment Variables section:

```bash
# Core Application
NODE_ENV=production
NEXTAUTH_URL=https://your-app-name.onrender.com
NEXTAUTH_SECRET=your-super-secure-32-character-secret-key
NEXT_PUBLIC_SITE_URL=https://your-app-name.onrender.com
NEXT_TELEMETRY_DISABLED=1

# Payment Processing (Stripe)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email Notifications (SendGrid)
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDER_EMAIL=noreply@yourdomain.com

# Database (Auto-populated by Render)
DATABASE_URL=${DATABASE_URL}

# Redis Cache (Auto-populated by Render)
REDIS_URL=${REDIS_URL}

# Security
CORS_ALLOWED_ORIGINS=https://your-app-name.onrender.com

# Optional: Monitoring and Analytics
SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### How to Generate Secrets

```bash
# NEXTAUTH_SECRET (32+ characters)
openssl rand -base64 32

# Or use this command to generate a random string
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🗄️ Step 2: Database Setup (PostgreSQL)

### Option A: Using render.yaml (Recommended)

1. Copy the `render.yaml` file to your repository root
2. Push to GitHub
3. Go to Render Dashboard → "New" → "Blueprint"
4. Connect your repository
5. Render will automatically create the database

### Option B: Manual Setup

1. Go to Render Dashboard
2. Click "New" → "PostgreSQL"
3. Configure:
   - **Name**: `car-wash-db`
   - **Plan**: `Starter` (or `Free` for testing)
   - **Region**: Choose closest to your users
4. Note the connection string for later

---

## 🔄 Step 3: Redis Cache Setup

### Using Render's Redis Add-on

1. Go to Render Dashboard
2. Click "New" → "Redis"
3. Configure:
   - **Name**: `car-wash-redis`
   - **Plan**: `Starter` (or `Free` for testing)
   - **Region**: Same as your database
   - **Max Memory Policy**: `allkeys-lru`

---

## 🌐 Step 4: Web Service Deployment

### Create Web Service

1. Go to Render Dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:

```yaml
Name: car-wash-booking
Runtime: Docker
Region: oregon (or your preferred region)
Branch: main
Build Command: # Handled by Dockerfile
Start Command: # Handled by Dockerfile
```

### Advanced Settings

```yaml
Auto-Deploy: Yes
Health Check Path: /api/health
```

---

## ⚙️ Step 5: Environment Variables Configuration

In your Render service dashboard, go to Environment tab and add:

### Copy from render-production.env

Use the `render-production.env` file as a template. Replace all placeholder values with your actual credentials:

1. **Required Variables** (must be set for app to work):
   - `NEXTAUTH_SECRET`
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `SENDGRID_API_KEY`
   - `SENDER_EMAIL`

2. **Auto-Generated Variables** (set by Render):
   - `DATABASE_URL`
   - `REDIS_URL`

3. **Update URLs** (replace with your actual Render service URL):
   - `NEXTAUTH_URL`
   - `NEXT_PUBLIC_SITE_URL`
   - `CORS_ALLOWED_ORIGINS`

---

## 🚀 Step 6: Deploy Your Application

### Deploy Steps

1. **Push your code** to GitHub (if not already done)
2. **Trigger deployment** in Render Dashboard
3. **Monitor logs** for any issues
4. **Wait for deployment** to complete (5-10 minutes)

### Expected Deployment Process

```
🔨 Building Docker image...
📦 Installing dependencies...
🔧 Generating Prisma client...
🏗️  Building Next.js application...
🐳 Creating container...
🗄️  Running database migrations...
🌱 Seeding database...
🚀 Starting application...
```

---

## ✅ Step 7: Post-Deployment Validation

### Automatic Validation

Run the validation script:

```bash
chmod +x scripts/validate-production-deployment.sh
./scripts/validate-production-deployment.sh https://your-app-name.onrender.com
```

### Manual Checks

1. **Health Check**: Visit `https://your-app-name.onrender.com/api/health`
2. **Homepage**: Verify the main page loads
3. **Database**: Check if services are displayed
4. **Real-time Features**: Test booking availability updates
5. **Payment Flow**: Test Stripe integration (use test mode first)

### Expected Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 120,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "pass",
      "message": "Database connection successful"
    },
    "redis": {
      "status": "pass",
      "message": "Redis connection successful"
    },
    "services": {
      "status": "pass",
      "message": "All essential services configured"
    }
  }
}
```

---

## 🔒 Step 8: Security Configuration

### SSL/TLS

Render automatically provides SSL certificates. Your app will be available at:
- `https://your-app-name.onrender.com`

### Security Headers

Our middleware automatically adds:
- HSTS (HTTP Strict Transport Security)
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- And more...

### CORS Configuration

Update `CORS_ALLOWED_ORIGINS` to include your custom domain if you have one:

```bash
CORS_ALLOWED_ORIGINS=https://your-app-name.onrender.com,https://yourdomain.com
```

---

## 📊 Step 9: Monitoring Setup

### Built-in Monitoring

The application includes:
- **Health checks** at `/api/health`
- **Performance monitoring** via Sentry (if configured)
- **Real-time metrics** for memory, uptime, and response times

### Production Monitoring

Run continuous monitoring:

```bash
# On your local machine or monitoring server
chmod +x scripts/monitor-production.sh
./scripts/monitor-production.sh -u https://your-app-name.onrender.com
```

### Render Dashboard Monitoring

Monitor in Render Dashboard:
- CPU usage
- Memory usage
- Network traffic
- Error rates
- Response times

---

## 🔄 Step 10: Stripe Webhook Configuration

### Configure Stripe Webhooks

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-app-name.onrender.com/api/stripe/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

---

## 📧 Step 11: Email Configuration

### SendGrid Setup

1. Verify your sender email in SendGrid
2. Add your domain for better deliverability
3. Configure SPF and DKIM records
4. Test email sending through `/api/test-email` (if available)

---

## 🎯 Step 12: Performance Optimization

### Recommended Settings

```bash
# Database Connection Pool
DATABASE_POOL_SIZE=10
DB_MAX_CONNECTIONS=20
DATABASE_CONNECTION_TIMEOUT=30000

# Redis Cache
REDIS_DEFAULT_TTL=3600
REDIS_ENABLE_COMPRESSION=true

# Application
LOYALTY_PROGRAM_ENABLED=true
REAL_TIME_UPDATES_ENABLED=true
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Check DATABASE_URL format
DATABASE_URL=postgresql://user:password@hostname:port/database_name

# Verify Prisma can connect
npx prisma db pull
```

#### 2. Redis Connection Issues

```bash
# Verify Redis URL
REDIS_URL=redis://username:password@hostname:port

# Check Redis connectivity in health endpoint
curl https://your-app-name.onrender.com/api/health
```

#### 3. WebSocket Connection Problems

```bash
# Verify CORS settings
CORS_ALLOWED_ORIGINS=https://your-app-name.onrender.com

# Check browser console for WebSocket errors
# Fallback to polling if WebSocket fails
```

#### 4. Build Failures

```bash
# Common fixes:
# 1. Ensure all dependencies are in package.json
# 2. Check TypeScript compilation errors
# 3. Verify Prisma schema is valid
# 4. Check Docker build logs in Render
```

### Getting Help

1. **Check Render logs**: Service → Logs tab
2. **Health endpoint**: `/api/health` for system status
3. **Application logs**: Check console for errors
4. **Validation script**: Run deployment validation

---

## 🎉 Success Indicators

Your deployment is successful when:

- [ ] Health check returns `"status": "healthy"`
- [ ] Homepage loads without errors
- [ ] Database seeding completed
- [ ] Redis cache is connected
- [ ] WebSocket real-time features work
- [ ] Email notifications are sent
- [ ] Payment processing works (test mode)
- [ ] All security headers are present
- [ ] SSL certificate is active

---

## 📈 Next Steps

After successful deployment:

1. **Custom Domain**: Add your domain in Render settings
2. **DNS Configuration**: Point your domain to Render
3. **Production Testing**: Thoroughly test all features
4. **Monitoring Setup**: Configure alerts and notifications
5. **Backup Strategy**: Set up database backups
6. **Performance Tuning**: Monitor and optimize based on usage

---

## 📞 Support

If you encounter issues:

1. Check the validation script output
2. Review Render service logs
3. Verify all environment variables are set
4. Test the health endpoint
5. Check individual service configurations

For additional support, refer to:
- Render Documentation: https://render.com/docs
- Application health endpoint: `/api/health`
- Monitoring script: `scripts/monitor-production.sh`

---

**🎯 You're now ready for production! Your car wash booking system is deployed with enterprise-grade reliability, security, and monitoring.**