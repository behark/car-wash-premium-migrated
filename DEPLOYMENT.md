# 🚀 Render Deployment Guide

This guide will help you deploy the Premium Auto Pesu booking system to Render.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Domain (Optional)**: Custom domain for production use

## 🗄️ Database Setup

### 1. Create PostgreSQL Database

1. Go to your Render dashboard
2. Click "New" → "PostgreSQL"
3. Configure:
   - **Name**: `premium-auto-pesu-db`
   - **Database**: `premium_auto_pesu`
   - **User**: Choose a username
   - **Region**: Frankfurt (EU) for better performance
   - **Plan**: Starter (Free) or higher based on needs

4. Click "Create Database"
5. Save the **External Connection String** for later

### 2. Initialize Database Schema

After the database is created, you'll need to run migrations:

```bash
# Set your database URL temporarily
export DATABASE_URL="your_render_postgresql_connection_string"

# Run migrations
npx prisma migrate deploy

# Seed initial data (optional)
npx prisma db seed
```

## 🌐 Web Service Setup

### 1. Create Web Service

1. Go to Render dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `premium-auto-pesu`
   - **Region**: Frankfurt (EU)
   - **Branch**: `main` (or your production branch)
   - **Environment**: Node
   - **Build Command**: `npm ci && npx prisma generate && npm run build`
   - **Start Command**: `npm start`

### 2. Environment Variables

Add these environment variables in your Render service settings:

#### Required Variables

```bash
# Database
DATABASE_URL=[Use the External Connection String from your PostgreSQL service]

# Authentication
NEXTAUTH_URL=https://your-service-name.onrender.com
NEXTAUTH_SECRET=[Generate with: openssl rand -base64 32]

# Environment
NODE_ENV=production

# Admin Access
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD_HASH=[Generate with bcrypt - see instructions below]
```

#### Generate Admin Password Hash

```bash
# Run this locally to generate password hash
node -e "
const bcrypt = require('bcrypt');
const password = 'your_secure_password';
const hash = bcrypt.hashSync(password, 12);
console.log('Admin Password Hash:', hash);
"
```

#### Optional but Recommended

```bash
# Email (SendGrid)
SENDGRID_API_KEY=SG.your_api_key
SENDER_EMAIL=noreply@yourdomain.com

# Payment (Stripe)
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Error Monitoring (Sentry)
SENTRY_DSN=https://your_dsn@sentry.io/project

# Performance
DATABASE_POOL_SIZE=10
```

### 3. Custom Domain (Optional)

1. In your web service settings, go to "Settings" → "Custom Domains"
2. Add your domain
3. Configure DNS settings as instructed by Render
4. Update `NEXTAUTH_URL` to use your custom domain

## 🔧 Configuration Files

The repository includes several configuration files for Render:

- **`.env.render`** - Template for environment variables
- **`render.yaml`** - Infrastructure as Code (optional)
- **`DEPLOYMENT.md`** - This deployment guide

## 🚀 Deployment Process

### Automatic Deployment

1. Push your code to the connected GitHub branch
2. Render will automatically:
   - Install dependencies (`npm ci`)
   - Generate Prisma client (`npx prisma generate`)
   - Run database migrations (`npx prisma migrate deploy`)
   - Build the application (`npm run build`)
   - Start the service (`npm start`)

### Manual Deployment

1. Go to your Render service dashboard
2. Click "Manual Deploy" → "Deploy latest commit"

## 🔍 Health Checks

The application includes a health check endpoint at `/api/health` that Render uses to monitor service health.

## 📊 Monitoring & Logging

### Application Logs

- View logs in your Render service dashboard
- Logs include application errors, API requests, and database queries

### Error Monitoring

If you configured Sentry, errors will be automatically tracked and reported.

### Performance Monitoring

Monitor your service performance in the Render dashboard:
- Response times
- Memory usage
- CPU usage
- Database connections

## 🛡️ Security Considerations

### Database Security

- Use strong passwords for database users
- Regularly rotate database credentials
- Monitor for unusual activity

### Application Security

- Keep dependencies updated
- Use HTTPS for all connections (handled by Render)
- Implement proper rate limiting
- Validate all user inputs

### Environment Variables

- Never commit secrets to your repository
- Use Render's environment variable encryption
- Regularly rotate API keys and secrets

## 🔄 Backup Strategy

### Database Backups

Render automatically backs up PostgreSQL databases:
- Daily backups for 7 days (Starter plan)
- Point-in-time recovery available on higher plans

### Application Backups

- Your application code is backed up in GitHub
- Consider backing up uploaded files and user data

## 📈 Scaling

### Horizontal Scaling

- Upgrade to Standard or Pro plans for multiple instances
- Use Render's load balancing

### Database Scaling

- Upgrade PostgreSQL plan for more storage and connections
- Consider read replicas for high-traffic applications

### Caching

- Add Redis service for session storage and caching
- Implement application-level caching

## 🐛 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check build logs in Render dashboard
   - Ensure all dependencies are in `package.json`
   - Verify Node.js version compatibility

2. **Database Connection Issues**
   - Verify `DATABASE_URL` is correct
   - Check database service status
   - Ensure migrations have been run

3. **Environment Variable Issues**
   - Verify all required variables are set
   - Check for typos in variable names
   - Ensure sensitive values are properly escaped

### Debug Commands

```bash
# Check database connection
npx prisma db pull

# Run migrations
npx prisma migrate deploy

# View database schema
npx prisma studio

# Generate Prisma client
npx prisma generate
```

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [Sentry Next.js Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

## 🆘 Support

If you encounter issues during deployment:

1. Check the application logs in Render dashboard
2. Review this deployment guide
3. Check the troubleshooting section
4. Contact support with specific error messages and logs

---

**Note**: This guide assumes you're deploying the Premium Auto Pesu booking system. Adjust configuration values according to your specific requirements.