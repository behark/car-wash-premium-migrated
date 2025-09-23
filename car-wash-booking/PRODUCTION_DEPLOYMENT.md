# 🚀 Production Deployment Guide

This guide provides step-by-step instructions for deploying the Car Wash Booking System to production.

## 📋 Prerequisites

Before deploying, ensure you have:

- **Docker** and **Docker Compose** installed
- **PostgreSQL database** (Supabase, AWS RDS, or similar)
- **SendGrid account** for email notifications
- **Twilio account** for SMS notifications
- **Domain name** with SSL certificate
- **Server** with at least 2GB RAM

## 🔧 Environment Setup

### 1. Create Production Environment File

Copy the example file and configure your production values:

```bash
cp .env.example .env.production
```

### 2. Configure Required Environment Variables

Edit `.env.production` with your production values:

```bash
# Database - REQUIRED
DATABASE_URL="postgresql://username:password@your-db-host:5432/carwash"

# NextAuth - REQUIRED
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-64-character-secure-random-string"

# Admin User - REQUIRED
ADMIN_EMAIL="admin@yourdomain.com"
ADMIN_PASSWORD="your-secure-admin-password"

# Email Notifications - REQUIRED
SENDGRID_API_KEY="SG.your-sendgrid-api-key"
SENDER_EMAIL="noreply@yourdomain.com"

# SMS Notifications - REQUIRED
TWILIO_ACCOUNT_SID="ACyour-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_FROM="+1234567890"

# Payment Processing - OPTIONAL
STRIPE_SECRET_KEY="sk_live_your-stripe-secret"
STRIPE_PUBLISHABLE_KEY="pk_live_your-stripe-public"

# Maps Integration - OPTIONAL
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-key"

# Application Configuration
NODE_ENV="production"
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"
LOG_LEVEL="INFO"
```

### 3. Generate Secure Secrets

```bash
# Generate NEXTAUTH_SECRET (64 characters)
openssl rand -hex 32

# Generate strong admin password
openssl rand -base64 32 | tr -d "=+/" | cut -c1-20
```

## 🚀 Deployment Methods

### Method 1: Automated Deployment (Recommended)

1. **Run the deployment script:**
   ```bash
   chmod +x scripts/deploy-production.sh
   ./scripts/deploy-production.sh
   ```

2. **The script will automatically:**
   - Validate all environment variables
   - Build and deploy all services
   - Run database migrations
   - Seed initial data
   - Perform health checks

### Method 2: Manual Deployment

1. **Build and start services:**
   ```bash
   docker-compose -f docker-compose.prod.yml build --no-cache
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Run database setup:**
   ```bash
   # Run migrations
   docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

   # Seed database
   docker-compose -f docker-compose.prod.yml exec app npm run prisma:seed
   ```

3. **Verify deployment:**
   ```bash
   curl http://localhost:3000/api/health
   ```

## 🔒 SSL/HTTPS Configuration

### Option 1: Let's Encrypt with Certbot

1. **Install Certbot:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Generate SSL certificates:**
   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

3. **Copy certificates to nginx directory:**
   ```bash
   sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
   sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
   ```

### Option 2: Custom SSL Certificates

Place your SSL certificates in the `nginx/ssl/` directory:
- `cert.pem` - SSL certificate
- `key.pem` - Private key

## 📊 Monitoring and Maintenance

### Health Checks

The application includes built-in health checks:

```bash
# Application health
curl https://yourdomain.com/api/health

# Database health
docker-compose -f docker-compose.prod.yml exec db pg_isready
```

### Log Management

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f app

# View database logs
docker-compose -f docker-compose.prod.yml logs -f db

# View nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Database Backups

```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres carwash > backup.sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres carwash < backup.sql
```

## 🔄 Updates and Rollbacks

### Updating the Application

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Rebuild and deploy:**
   ```bash
   ./scripts/deploy-production.sh
   ```

### Rolling Back

1. **Stop current services:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

2. **Checkout previous version:**
   ```bash
   git checkout previous-version-tag
   ```

3. **Deploy previous version:**
   ```bash
   ./scripts/deploy-production.sh
   ```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check database connectivity
   docker-compose -f docker-compose.prod.yml exec app npx prisma db push
   ```

2. **Email/SMS Not Working**
   ```bash
   # Check service configuration
   docker-compose -f docker-compose.prod.yml exec app node -e "
   console.log('SendGrid:', process.env.SENDGRID_API_KEY?.startsWith('SG.'));
   console.log('Twilio:', process.env.TWILIO_ACCOUNT_SID?.startsWith('AC'));
   "
   ```

3. **Memory Issues**
   ```bash
   # Monitor resource usage
   docker stats
   ```

### Emergency Procedures

1. **Service Restart:**
   ```bash
   docker-compose -f docker-compose.prod.yml restart app
   ```

2. **Full System Restart:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Database Recovery:**
   ```bash
   # Stop app, restore database, restart
   docker-compose -f docker-compose.prod.yml stop app
   # Restore from backup
   docker-compose -f docker-compose.prod.yml start app
   ```

## 📈 Performance Optimization

### Database Optimization

1. **Create indexes for frequent queries:**
   ```sql
   CREATE INDEX idx_bookings_date ON bookings(date);
   CREATE INDEX idx_bookings_status ON bookings(status);
   CREATE INDEX idx_bookings_service ON bookings(service_id);
   ```

2. **Configure connection pooling:**
   ```bash
   # In .env.production
   DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=20"
   ```

### Application Optimization

1. **Enable gzip compression** (already configured in nginx)
2. **Set proper cache headers** (configured in nginx)
3. **Monitor and adjust container resources**

## 🔐 Security Checklist

- [ ] Environment variables secured
- [ ] HTTPS enforced
- [ ] Database access restricted
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Admin credentials secured
- [ ] API keys rotated regularly
- [ ] Backups encrypted
- [ ] Logs monitored
- [ ] Updates applied regularly

## 📞 Support

For deployment issues or questions:

1. Check the logs first
2. Review this documentation
3. Check GitHub issues
4. Contact your development team

---

**Security Note:** Never commit production environment files to version control. Keep your API keys and secrets secure.