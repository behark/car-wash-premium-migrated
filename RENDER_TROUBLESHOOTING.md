# 🛠️ Render Deployment Troubleshooting Guide

This guide helps you diagnose and fix common issues with your Render deployment.

---

## 🚀 Quick Start - Run These Commands

**First, test your deployment:**
```bash
# Quick test (replace with your actual URL)
./scripts/quick-render-test.sh https://your-app-name.onrender.com

# Detailed verification
./scripts/check-render-config.sh -u https://your-app-name.onrender.com

# Environment variables checklist
./scripts/render-env-checker.sh
```

---

## 🔥 Common Issues & Solutions

### 1. **Health Check Failing** ❌

**Symptoms:**
- Health endpoint returns 500 error
- "Database connection failed" message
- "Service unavailable" errors

**Solutions:**

#### A. Check Environment Variables
```bash
# In Render Dashboard → Your Service → Environment tab
# Verify these are set correctly:

✅ NODE_ENV=production
✅ DATABASE_URL=(auto-set by Render)
✅ NEXTAUTH_SECRET=(32+ characters)
✅ NEXTAUTH_URL=https://your-app-name.onrender.com
```

#### B. Database Connection Issues
1. Go to Render Dashboard → Databases
2. Verify PostgreSQL service is running
3. Check DATABASE_URL is linked to your web service
4. Test connection:
   ```bash
   # In Render shell (or locally with the connection string)
   psql $DATABASE_URL -c "SELECT 1;"
   ```

#### C. Prisma Migration Issues
```bash
# Check Render logs for migration errors
# Common fix: Redeploy to run migrations again
```

---

### 2. **Application Won't Start** 🚫

**Symptoms:**
- Build succeeds but app crashes on startup
- "Port already in use" errors
- "Cannot find module" errors

**Solutions:**

#### A. Check Dockerfile and Build Process
```bash
# Verify these files exist and are correct:
✅ Dockerfile (multi-stage build)
✅ server.js (custom server)
✅ next.config.js (standalone output)
```

#### B. Check Port Configuration
```bash
# In Render environment variables:
PORT=3000  # Should be set automatically

# In your code, ensure you're using:
const port = process.env.PORT || 3000
```

#### C. Dependencies Issues
```bash
# Common fixes:
# 1. Delete package-lock.json and node_modules, run npm install
# 2. Ensure all dependencies are in package.json (not devDependencies)
# 3. Check for Node.js version compatibility
```

---

### 3. **Payment Integration Not Working** 💳

**Symptoms:**
- Stripe checkout fails
- "Invalid API key" errors
- Webhooks not receiving events

**Solutions:**

#### A. Verify Stripe Configuration
```bash
# Check these environment variables:
✅ STRIPE_SECRET_KEY=sk_live_... (for production)
✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
✅ STRIPE_WEBHOOK_SECRET=whsec_...

# ⚠️ Make sure you're using LIVE keys for production!
```

#### B. Configure Stripe Webhooks
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-app-name.onrender.com/api/payment/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

#### C. Test Payment Flow
```bash
# Test in Stripe Dashboard:
# 1. Use test mode first
# 2. Test with test card: 4242 4242 4242 4242
# 3. Check webhook delivery in Stripe Dashboard
```

---

### 4. **Email Notifications Not Sending** 📧

**Symptoms:**
- No booking confirmation emails
- SendGrid errors in logs
- "Unauthorized" email errors

**Solutions:**

#### A. Verify SendGrid Setup
```bash
# Check environment variables:
✅ SENDGRID_API_KEY=SG....
✅ SENDER_EMAIL=noreply@yourdomain.com

# Verify in SendGrid Dashboard:
✅ API key has "Mail Send" permissions
✅ Sender email is verified
✅ Domain authentication (optional but recommended)
```

#### B. Test Email Sending
```bash
# Test endpoint (if available):
curl -X POST https://your-app-name.onrender.com/api/test-email

# Check SendGrid Activity in dashboard
```

---

### 5. **Real-time Features Not Working** 🔄

**Symptoms:**
- Live booking updates not showing
- WebSocket connection errors
- "Connection refused" in browser console

**Solutions:**

#### A. Check WebSocket Configuration
```bash
# Verify these in environment:
✅ NEXT_PUBLIC_WS_URL=wss://your-app-name.onrender.com
✅ Real-time features enabled in settings

# Check browser console for WebSocket errors
```

#### B. CORS Configuration
```bash
# Update CORS settings:
CORS_ALLOWED_ORIGINS=https://your-app-name.onrender.com,https://yourdomain.com

# Check browser network tab for CORS errors
```

---

### 6. **Performance Issues** ⚡

**Symptoms:**
- Slow response times (>5 seconds)
- High memory usage
- Database timeouts

**Solutions:**

#### A. Database Optimization
```bash
# Add these environment variables:
DATABASE_POOL_SIZE=10
DB_MAX_CONNECTIONS=20
DATABASE_CONNECTION_TIMEOUT=30000
DB_POOL_TIMEOUT=10000
```

#### B. Redis Cache Setup
```bash
# Ensure Redis is configured:
✅ Redis service created in Render
✅ REDIS_URL linked to web service
✅ REDIS_DEFAULT_TTL=3600
```

#### C. Render Plan Upgrade
```bash
# Consider upgrading if:
# - Memory usage consistently >80%
# - CPU usage consistently >70%
# - Multiple concurrent users experiencing slowness
```

---

### 7. **Security Issues** 🔒

**Symptoms:**
- Missing security headers
- CORS errors
- "Unsafe inline" CSP errors

**Solutions:**

#### A. Verify Security Headers
```bash
# Test security headers:
curl -I https://your-app-name.onrender.com

# Should include:
✅ Strict-Transport-Security
✅ Content-Security-Policy
✅ X-Frame-Options: DENY
✅ X-Content-Type-Options: nosniff
```

#### B. Update CSP for Third-party Services
```javascript
// In next.config.js, update CSP if needed:
"script-src 'self' 'unsafe-inline' https://js.stripe.com"
"connect-src 'self' https://api.stripe.com wss://*"
```

---

## 🕵️ Debugging Steps

### Step 1: Check Render Service Status
1. Go to Render Dashboard
2. Check service status (should be "Live")
3. Look for any failed deployments

### Step 2: Review Logs
1. In Render Dashboard → Your Service → Logs
2. Look for error messages:
   - Database connection errors
   - Missing environment variables
   - Port binding issues
   - Dependency errors

### Step 3: Test Endpoints Manually
```bash
# Test health check
curl https://your-app-name.onrender.com/api/health

# Test services API
curl https://your-app-name.onrender.com/api/services

# Check response codes and error messages
```

### Step 4: Environment Variables Audit
```bash
# Run the environment checker:
./scripts/render-env-checker.sh

# Verify all required variables are set
# Check for typos in variable names
# Ensure values are correct format
```

---

## 🚨 Emergency Recovery

### If Your Site Is Down:

#### 1. Quick Recovery Steps
```bash
# 1. Check Render service status
# 2. Look at recent deployments
# 3. Check for any recent env var changes
# 4. Rollback to last working deployment if needed
```

#### 2. Rollback Deployment
1. In Render Dashboard → Your Service
2. Go to "Deploys" tab
3. Find last successful deployment
4. Click "Redeploy"

#### 3. Restore Database (if needed)
```bash
# If database is corrupted:
# 1. Check Render database backups
# 2. Restore from backup if available
# 3. Re-run migrations: npx prisma migrate deploy
# 4. Re-seed database: npx prisma db seed
```

---

## 📞 Getting Additional Help

### 1. Render Support Resources
- [Render Docs](https://render.com/docs)
- [Render Community](https://community.render.com)
- [Render Status Page](https://status.render.com)

### 2. Application-Specific Resources
```bash
# Check application health:
https://your-app-name.onrender.com/api/health

# Run verification scripts:
./scripts/validate-production-deployment.sh
./scripts/monitor-production.sh
```

### 3. Common Log Locations
```bash
# Render service logs: Dashboard → Service → Logs
# Database logs: Dashboard → Database → Logs
# Browser console: F12 → Console tab
# Network errors: F12 → Network tab
```

---

## ✅ Prevention Checklist

To avoid future issues:

- [ ] **Monitor regularly**: Set up alerts for downtime
- [ ] **Backup database**: Regular automated backups
- [ ] **Test deployments**: Always test after changes
- [ ] **Monitor performance**: Track response times and memory
- [ ] **Update dependencies**: Keep packages up to date
- [ ] **Security scans**: Regular vulnerability checks
- [ ] **Documentation**: Keep deployment docs updated

---

## 🎯 Success Indicators

Your deployment is healthy when:

- [ ] Health endpoint returns `"status": "healthy"`
- [ ] All API endpoints respond correctly
- [ ] Database connections are stable
- [ ] Email notifications work
- [ ] Payment processing functions
- [ ] Real-time features are active
- [ ] Security headers are present
- [ ] Performance is acceptable (<3s response time)

---

**💡 Remember: When in doubt, check the logs first, then environment variables, then run the verification scripts!**