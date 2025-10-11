# Car Wash Booking System

Professional car wash booking and management system built with Next.js, TypeScript, and PostgreSQL.

## ✨ Features

### For Customers
- 🚗 Browse available car wash services
- 📅 Book appointments with real-time availability
- 📱 Mobile-optimized responsive design
- ⭐ Leave reviews and ratings
- 🗺️ Location map (with Google Maps integration)

### For Business Owners
- 📊 Complete admin dashboard
- 📋 Manage services, bookings, and customers
- 📧 Automated email/SMS notifications (optional)
- 💳 Online payment processing (optional)
- 📈 Performance monitoring and analytics

## 🚀 Quick Start

### 1. One-Command Setup
```bash
# Clone and setup everything automatically
git clone <your-repo>
cd car-wash-booking
./scripts/quick-start.sh
```

### 2. Manual Setup
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database URL

# Setup database
npx prisma migrate dev --name init
npx prisma db seed

# Start development server
npm run dev
```

Visit `http://localhost:3000`

**Default Admin Login:** admin@example.com / admin123

## 📚 Documentation

- **[Development Guide](docs/DEVELOPMENT.md)** - Local development setup
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment options
- **[Architecture Overview](docs/ARCHITECTURE.md)** - Technical architecture details
- **[Optional Services](docs/OPTIONAL_SERVICES.md)** - External service integrations

## 🛠️ Technology Stack

- **Frontend:** Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js
- **Optional Services:** SendGrid, Twilio, Stripe, Google Maps

## 🎯 Key Benefits

### Ready for Production
- ✅ Complete booking system that works immediately
- ✅ No external dependencies required
- ✅ Professional admin dashboard
- ✅ Mobile-responsive design

### Scalable Architecture
- ✅ Enterprise-grade database design
- ✅ API-first architecture
- ✅ Comprehensive testing suite
- ✅ Performance monitoring

### Business Ready
- ✅ Multi-service support with pricing
- ✅ Customer management system
- ✅ Review and rating system
- ✅ Email/SMS notifications (optional)
- ✅ Payment processing (optional)

## 📱 Demo

### Customer Experience
1. Browse services and pricing
2. Select date/time with real-time availability
3. Complete booking form
4. Receive confirmation (email/SMS if configured)

### Admin Experience
1. Login to admin dashboard
2. View all bookings in calendar/list view
3. Manage services, pricing, and availability
4. Review customer feedback
5. Monitor system performance

## 🚀 Deployment Options

### Recommended: Netlify
```bash
# One-click deployment
# Connect GitHub repo to Netlify
# Set environment variables
# Deploy automatically
```

### Alternative: Vercel, Docker, Manual
See [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.

## 🔧 Optional Enhancements

The system works perfectly without any external services. Add these for enhanced functionality:

- **📧 Email:** SendGrid for automated confirmations
- **📱 SMS:** Twilio for text notifications
- **🗺️ Maps:** Google Maps for location display
- **💳 Payments:** Stripe for online payments
- **📊 Monitoring:** Sentry for error tracking

See [Optional Services Guide](docs/OPTIONAL_SERVICES.md) for setup instructions.

## 📈 Business Value

### Immediate ROI
- Reduce phone bookings and manual scheduling
- 24/7 online booking availability
- Professional customer experience
- Automated booking confirmations

### Long-term Benefits
- Customer database for marketing
- Service usage analytics
- Review system for credibility
- Scalable to multiple locations

## 🆘 Support

- 📖 **Documentation:** See `/docs` folder
- 🐛 **Issues:** GitHub Issues
- 💬 **Questions:** Check documentation first

## 📄 License

MIT License - Use freely for personal and commercial projects.

---

**Built with ❤️ for car wash businesses everywhere** 🚗✨