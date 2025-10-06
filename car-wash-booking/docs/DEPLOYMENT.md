# Deployment Guide

## Quick Deploy Options

### Option 1: Netlify (Recommended)
```bash
# 1. Connect your GitHub repo to Netlify
# 2. Set build command: npm run build
# 3. Set environment variables (see Environment Variables section)
# 4. Deploy automatically on git push
```

### Option 2: Vercel
```bash
# 1. Connect GitHub repo to Vercel
# 2. Add environment variables in dashboard
# 3. Deploy automatically
```

### Option 3: Docker
```bash
docker-compose up --build
```

## Environment Variables

### Required Variables
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

# Authentication
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-key-change-this-in-production"

# External Services (Optional - see Optional Services section)
SENDGRID_API_KEY="SG.xxxxx"
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="xxxx"
STRIPE_SECRET_KEY="sk_test_xxx"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your_google_maps_key"
```

### Production Checklist
- [ ] Database URL configured
- [ ] NEXTAUTH_SECRET generated (use: `openssl rand -base64 32`)
- [ ] NEXTAUTH_URL set to production domain
- [ ] SSL certificate active
- [ ] Environment variables secured

## Database Setup

### Development
```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
```

### Production
```bash
npx prisma migrate deploy
npx prisma generate
```

## Troubleshooting

### Common Issues
1. **Build fails**: Check Node.js version (18+)
2. **Database connection**: Verify DATABASE_URL format
3. **Environment variables**: Ensure all required vars are set
4. **API routes 404**: Check Next.js deployment configuration

### Support
- Check GitHub Issues for known problems
- Review logs in your deployment platform
- Test locally with `npm run build && npm start`