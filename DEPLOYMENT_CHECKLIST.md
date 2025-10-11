# 🚀 Render Deployment Checklist

## Pre-Deployment Setup

### Repository Preparation
- [ ] Code pushed to GitHub repository
- [ ] All production files are committed:
  - [ ] `Dockerfile`
  - [ ] `render.yaml`
  - [ ] `server.js`
  - [ ] Production configs in `src/lib/`
  - [ ] Health check endpoint
  - [ ] Validation scripts

### External Services Setup
- [ ] **Stripe Account**
  - [ ] Live API keys obtained
  - [ ] Webhook endpoint configured
  - [ ] Test payments verified
- [ ] **SendGrid Account**
  - [ ] API key generated
  - [ ] Sender email verified
  - [ ] Domain authentication (optional)
- [ ] **Sentry Account** (Optional)
  - [ ] Project created
  - [ ] DSN obtained
- [ ] **Google Analytics** (Optional)
  - [ ] Property created
  - [ ] Tracking ID obtained

## Render Infrastructure Setup

### Database (PostgreSQL)
- [ ] PostgreSQL service created
- [ ] Plan selected (Starter recommended)
- [ ] Region selected
- [ ] Connection string available

### Cache (Redis)
- [ ] Redis service created
- [ ] Plan selected (Starter recommended)
- [ ] Same region as database
- [ ] Max memory policy: `allkeys-lru`

### Web Service
- [ ] Web service created
- [ ] Repository connected
- [ ] Build method: Docker
- [ ] Health check path: `/api/health`
- [ ] Auto-deploy enabled

## Environment Variables Configuration

### Core Application (Required)
- [ ] `NODE_ENV=production`
- [ ] `NEXTAUTH_URL=https://your-app-name.onrender.com`
- [ ] `NEXTAUTH_SECRET=` (32+ character secret)
- [ ] `NEXT_PUBLIC_SITE_URL=https://your-app-name.onrender.com`
- [ ] `NEXT_TELEMETRY_DISABLED=1`

### Database & Cache (Auto-configured)
- [ ] `DATABASE_URL` (linked from PostgreSQL service)
- [ ] `REDIS_URL` (linked from Redis service)

### Payment Processing (Required)
- [ ] `STRIPE_SECRET_KEY=sk_live_...`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...`

### Email Services (Required)
- [ ] `SENDGRID_API_KEY=SG....`
- [ ] `SENDER_EMAIL=noreply@yourdomain.com`

### Security & Performance
- [ ] `CORS_ALLOWED_ORIGINS=https://your-app-name.onrender.com`
- [ ] `DATABASE_POOL_SIZE=10`
- [ ] `DB_MAX_CONNECTIONS=20`
- [ ] `REDIS_DEFAULT_TTL=3600`

### Optional Services
- [ ] `SENTRY_DSN=` (Error monitoring)
- [ ] `NEXT_PUBLIC_GA_ID=` (Analytics)
- [ ] `ADMIN_EMAIL=` (Admin notifications)

## Deployment Process

### Initial Deployment
- [ ] Trigger deployment from Render dashboard
- [ ] Monitor build logs for errors
- [ ] Wait for successful completion (5-10 minutes)
- [ ] Verify no build failures

### Database Setup
- [ ] Prisma migrations applied automatically
- [ ] Database seeded with initial data
- [ ] Services and business hours created
- [ ] Admin user created

## Post-Deployment Validation

### Automated Validation
```bash
# Run validation script
chmod +x scripts/validate-production-deployment.sh
./scripts/validate-production-deployment.sh https://your-app-name.onrender.com
```

### Manual Checks
- [ ] **Health Check**: `https://your-app-name.onrender.com/api/health`
  - [ ] Status: "healthy"
  - [ ] Database: "pass"
  - [ ] Redis: "pass"
  - [ ] Services: "pass"

- [ ] **Homepage**: Main page loads correctly
- [ ] **Services**: Service grid displays
- [ ] **Booking Form**: Booking interface works
- [ ] **Real-time Features**: WebSocket connection active

### Security Validation
- [ ] HTTPS certificate active
- [ ] Security headers present:
  - [ ] HSTS
  - [ ] Content-Security-Policy
  - [ ] X-Frame-Options: DENY
  - [ ] X-Content-Type-Options: nosniff
- [ ] CORS policy working correctly

### Performance Checks
- [ ] Page load time < 3 seconds
- [ ] Health check response < 1 second
- [ ] Memory usage < 80%
- [ ] No JavaScript errors in console

## Stripe Webhook Configuration

### Webhook Setup
- [ ] Go to Stripe Dashboard → Webhooks
- [ ] Add endpoint: `https://your-app-name.onrender.com/api/stripe/webhook`
- [ ] Select events:
  - [ ] `payment_intent.succeeded`
  - [ ] `payment_intent.payment_failed`
  - [ ] `checkout.session.completed`
- [ ] Copy webhook secret to environment variables
- [ ] Test webhook delivery

## Monitoring Setup

### Production Monitoring
- [ ] Run monitoring script:
```bash
chmod +x scripts/monitor-production.sh
./scripts/monitor-production.sh -u https://your-app-name.onrender.com
```

### Render Dashboard Monitoring
- [ ] CPU usage monitoring
- [ ] Memory usage monitoring
- [ ] Error rate monitoring
- [ ] Response time monitoring

### Alert Configuration
- [ ] Email alerts for downtime
- [ ] Webhook alerts (if configured)
- [ ] Health check monitoring

## Business Configuration

### Service Configuration
- [ ] Verify all services are loaded
- [ ] Check pricing and descriptions
- [ ] Validate service images
- [ ] Test booking flow for each service

### Business Hours
- [ ] Monday-Friday hours correct
- [ ] Saturday hours correct
- [ ] Sunday (closed) configured
- [ ] Break times configured

### Email Templates
- [ ] Booking confirmation emails
- [ ] Payment confirmation emails
- [ ] Reminder emails
- [ ] Cancellation emails

## Testing Checklist

### User Flow Testing
- [ ] **Service Selection**: Browse services
- [ ] **Date Selection**: Pick booking date
- [ ] **Time Selection**: Choose available slot
- [ ] **Customer Details**: Fill contact information
- [ ] **Payment**: Complete Stripe checkout
- [ ] **Confirmation**: Receive booking confirmation

### Real-time Features
- [ ] Multiple users see live availability
- [ ] Booking holds work correctly
- [ ] Conflicts are detected
- [ ] Updates broadcast to all users

### Email Notifications
- [ ] Booking confirmation sent
- [ ] Payment confirmation sent
- [ ] Admin notifications work
- [ ] Test email deliverability

## Final Go-Live Steps

### DNS Configuration (If using custom domain)
- [ ] Domain verified in Render
- [ ] DNS records updated
- [ ] SSL certificate generated
- [ ] WWW redirect configured

### Production Switch
- [ ] Switch Stripe to live mode
- [ ] Update API keys to live versions
- [ ] Test live payment processing
- [ ] Verify webhook endpoints

### Launch Preparation
- [ ] All testing completed
- [ ] Documentation updated
- [ ] Team trained on admin features
- [ ] Backup procedures documented
- [ ] Monitoring alerts active

## Success Criteria

✅ **Deployment is successful when all these are true:**

- [ ] Health endpoint returns "healthy"
- [ ] No errors in application logs
- [ ] All external services connected
- [ ] Real-time features working
- [ ] Payment processing functional
- [ ] Email notifications working
- [ ] Security headers active
- [ ] Performance within acceptable limits
- [ ] Monitoring systems active

---

## 🎉 Congratulations!

Your car wash booking system is now live in production with:

- ✅ **High Availability**: Health checks and monitoring
- ✅ **Security**: HTTPS, security headers, CORS protection
- ✅ **Performance**: Optimized builds, Redis caching, CDN
- ✅ **Real-time**: WebSocket-powered live updates
- ✅ **Reliability**: Database backups, error monitoring
- ✅ **Scalability**: Auto-scaling, connection pooling

**Your application is ready to handle production traffic!**