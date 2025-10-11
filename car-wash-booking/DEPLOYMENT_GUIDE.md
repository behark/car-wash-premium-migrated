# 🚀 Car Wash Booking System - Production Deployment Guide

## 📋 Quick Setup for Render

### 1. **Environment Variables Setup**
Copy the variables from `RENDER_MINIMAL.env` to your Render dashboard:

**🔥 CRITICAL - Required for basic functionality:**
```bash
DATABASE_URL=postgresql://username:password@hostname:port/database_name
NEXTAUTH_URL=https://your-app-name.onrender.com
NEXTAUTH_SECRET=generate-a-secure-random-string-min-32-chars
NODE_ENV=production
```

**💳 PAYMENT - Required for bookings:**
```bash
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
```

**📧 EMAIL - Recommended for notifications:**
```bash
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDER_EMAIL=noreply@yourdomain.com
```

### 2. **Render Dashboard Steps**

1. **Create New Web Service**
   - Connect your GitHub repository
   - Choose "Node" environment
   - Set build command: `npm ci && npm run build`
   - Set start command: `npm start`

2. **Create PostgreSQL Database**
   - Go to Databases → Create PostgreSQL
   - Copy the connection string to `DATABASE_URL`

3. **Add Environment Variables**
   - Go to Environment tab in your service
   - Add all variables from step 1 above
   - Replace placeholder values with real ones

4. **Deploy**
   - Click "Manual Deploy" or push to main branch

## 🔧 Build Configuration

The project is configured with:
- ✅ TypeScript strict mode
- ✅ ESLint with production rules
- ✅ Next.js 15 with App Router
- ✅ PWA support with service worker
- ✅ Database migrations via Prisma
- ✅ Health check endpoint at `/api/health`

## 📁 File Structure for Deployment

```
car-wash-booking/
├── src/                    # Application source
├── prisma/                # Database schema
├── public/                # Static assets
├── render.yaml           # Render blueprint (optional)
├── RENDER_PRODUCTION.env # Complete env template
└── RENDER_MINIMAL.env    # Quick start env template
```

## 🔒 Security Checklist

- [ ] Use strong `NEXTAUTH_SECRET` (32+ characters)
- [ ] Set production Stripe keys (not test keys)
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS-only cookies in production
- [ ] Set up error monitoring (Sentry)
- [ ] Configure rate limiting

## 📊 Post-Deployment

After deployment:

1. **Database Setup**
   ```bash
   # Render will automatically run:
   npx prisma db push
   npx prisma db seed
   ```

2. **Test Health Check**
   - Visit: `https://your-app.onrender.com/api/health`
   - Should return JSON with status "healthy"

3. **Test Booking Flow**
   - Create a test booking
   - Verify email notifications
   - Test payment processing

## 🛠️ Optional Integrations

Add these environment variables for enhanced functionality:

**🗺️ Maps & Location:**
```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key
```

**📱 SMS Notifications:**
```bash
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM=+1234567890
```

**📈 Analytics:**
```bash
NEXT_PUBLIC_GA_ID=GA_MEASUREMENT_ID
SENTRY_DSN=https://your_sentry_dsn@sentry.io/project
```

## 🐛 Troubleshooting

**Build fails?**
- Check all required env vars are set
- Verify DATABASE_URL format
- Check Render build logs

**Database connection issues?**
- Verify PostgreSQL add-on is running
- Check DATABASE_URL has correct permissions
- Test connection from Render shell

**App crashes on startup?**
- Check application logs in Render dashboard
- Verify all required environment variables
- Check health endpoint response

## 📞 Support

For deployment issues:
1. Check Render documentation
2. Review application logs
3. Test locally with production env vars
4. Check health endpoint status

---

**🎉 Your car wash booking system is now production-ready!**

The application includes:
- Real-time booking system with WebSocket support
- Stripe payment processing
- Email/SMS notifications
- Admin dashboard with analytics
- Mobile-responsive PWA
- Database backup and monitoring