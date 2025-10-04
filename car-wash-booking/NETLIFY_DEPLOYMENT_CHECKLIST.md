# Netlify Deployment Verification Checklist

## ✅ Configuration Files

### 1. netlify.toml
- [x] Build command: `npm run build`
- [x] Publish directory: `.` (correct for Next.js plugin)
- [x] Node version: 18
- [x] Next.js plugin configured: `@netlify/plugin-nextjs`
- [x] Functions directory: `netlify/functions`
- [x] Functions bundler: `esbuild`
- [x] Environment variables configured per context (production, preview, branch)
- [x] HTTPS redirects configured
- [x] Security headers enabled (CSP, HSTS, X-Frame-Options, etc.)
- [x] API route redirects to Netlify Functions

### 2. Netlify Functions
- [x] 6 TypeScript functions:
  - `bookings-availability.ts`
  - `bookings-create.ts`
  - `payment-create-session.ts`
  - `payment-webhook.ts`
  - `services-id.ts`
  - `services-index.ts`
- [x] 1 JavaScript function: `bookings-id.js`
- [x] All functions export `handler`
- [x] Functions package.json includes all dependencies:
  - Prisma Client
  - Stripe
  - SendGrid
  - Zod (latest v4)
  - date-fns (latest v4)

### 3. Prisma Configuration
- [x] Binary targets include Netlify environments:
  - `native`
  - `rhel-openssl-1.0.x`
  - `rhel-openssl-3.0.x`
  - `debian-openssl-3.0.x`
- [x] Postinstall script: `prisma generate`
- [x] Build command includes: `prisma generate && next build`

### 4. Next.js Configuration
- [x] Security headers configured
- [x] PWA configured with proper caching
- [x] Console logs removed in production
- [x] Image optimization configured
- [x] SWC minification enabled

## ⚠️ Required Environment Variables

### Production (Netlify Dashboard)
Must be set in Netlify UI under Site Settings → Environment Variables:

#### Database (REQUIRED)
- [ ] `DATABASE_URL` - PostgreSQL connection string
  - Example: `postgresql://user:pass@host:5432/db`

#### Authentication (REQUIRED)
- [ ] `NEXTAUTH_URL` - Set in netlify.toml (auto-configured)
- [ ] `NEXTAUTH_SECRET` - 64+ character random string
  - Generate: `openssl rand -base64 64`

#### Admin (REQUIRED)
- [ ] `ADMIN_EMAIL` - Admin login email
- [ ] `ADMIN_PASSWORD` - Secure admin password

#### Email Notifications (REQUIRED for production)
- [ ] `SENDGRID_API_KEY` - SendGrid API key (starts with `SG.`)
- [ ] `SENDER_EMAIL` - Verified sender email

#### SMS Notifications (OPTIONAL)
- [ ] `TWILIO_ACCOUNT_SID` - Twilio Account SID (starts with `AC`)
- [ ] `TWILIO_AUTH_TOKEN` - Twilio Auth Token
- [ ] `TWILIO_FROM` - Twilio phone number (+358...)

#### Payment (OPTIONAL for now)
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key (starts with `sk_`)
- [ ] `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (starts with `pk_`)

#### Maps (OPTIONAL)
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key

#### System (Auto-configured)
- [x] `NEXT_PUBLIC_SITE_URL` - Set in netlify.toml
- [x] `NODE_ENV` - Auto-set by Netlify

## 🔍 Pre-Deployment Tests

### Local Build Test
```bash
# 1. Install dependencies
npm install
cd netlify/functions && npm install && cd ../..

# 2. Generate Prisma client
npx prisma generate

# 3. Test build
npm run build

# 4. Check for errors
npm run lint
```

### Function Tests
```bash
# Test functions can be imported
node -e "require('./netlify/functions/bookings-availability.ts')"
```

## 🚀 Deployment Steps

### 1. Push to Repository
```bash
git add -A
git commit -m "feat: Ready for Netlify deployment"
git push origin master
```

### 2. Configure Netlify
1. Connect repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `.`
4. Add all required environment variables
5. Enable Next.js plugin (auto-detected)

### 3. Deploy
- Netlify will auto-deploy on push to master
- Or trigger manual deploy in Netlify dashboard

## ✅ Post-Deployment Verification

### 1. Check Build Logs
- [ ] Prisma client generated successfully
- [ ] Next.js build completed
- [ ] Functions bundled successfully
- [ ] No TypeScript errors
- [ ] No deployment errors

### 2. Test Functions
```bash
# Test API endpoints
curl https://kiiltoloisto.fi/api/services
curl https://kiiltoloisto.fi/api/bookings/availability?date=2025-10-05&serviceId=1
```

### 3. Test Pages
- [ ] Homepage loads: https://kiiltoloisto.fi
- [ ] Booking page works: https://kiiltoloisto.fi/booking
- [ ] Services page works: https://kiiltoloisto.fi/services
- [ ] Admin login: https://kiiltoloisto.fi/admin/login

### 4. Security Headers
```bash
# Verify security headers
curl -I https://kiiltoloisto.fi
```
Should include:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- `Content-Security-Policy`

### 5. HTTPS Redirect
```bash
# Test HTTP to HTTPS redirect
curl -I http://kiiltoloisto.fi
```
Should return `301` redirect to `https://`

## 🐛 Common Issues & Solutions

### Issue: Prisma Client Not Found
**Solution**: Ensure `prisma generate` runs in:
- Root `package.json` postinstall
- Functions `package.json` postinstall
- Build command in `netlify.toml`

### Issue: Function Timeout
**Solution**:
- Check database connection pooling
- Optimize queries
- Increase function timeout in netlify.toml if needed

### Issue: Environment Variables Not Found
**Solution**:
- Double-check spelling in Netlify dashboard
- Ensure no extra spaces
- Redeploy after adding variables

### Issue: Next.js Plugin Not Working
**Solution**:
- Ensure `@netlify/plugin-nextjs` is in `package.json`
- Plugin is declared in `netlify.toml`
- Clear cache and redeploy

## 📊 Performance Monitoring

### Recommended Tools
- Netlify Analytics (built-in)
- Sentry (error tracking) - configured in code
- Google Analytics (optional)
- Lighthouse CI (performance)

## 🔒 Security Best Practices

- [x] All secrets in environment variables (not in code)
- [x] Security headers enabled
- [x] HTTPS enforced
- [x] CSP configured
- [x] API routes protected
- [x] Database connection uses SSL
- [ ] Regular dependency updates
- [ ] Security scanning enabled

## 📝 Notes

- Netlify Functions have 10-second timeout (can be increased)
- Cold starts may occur on infrequent functions
- Use function warming for critical endpoints (configured for services-index and bookings-availability)
- Database connection pooling recommended for serverless
- Consider implementing Redis caching for better performance

---

**Last Updated**: 2025-10-04
**Next Review**: Before next major deployment
