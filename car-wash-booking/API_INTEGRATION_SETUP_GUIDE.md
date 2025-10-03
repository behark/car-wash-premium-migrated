# 🔌 API Integration Setup Guide - Kiiltoloisto Car Wash Booking

## 📊 Current Integration Status

### ✅ Working Integrations
- **Database (Supabase)**: Fully connected and operational
- **NextAuth**: Configured with production URL
- **Internal APIs**: All Netlify functions working

### ⚠️ Requires Configuration
- **SendGrid Email Service**: Using placeholder API key
- **Stripe Payment Processing**: Not configured
- **Twilio SMS Notifications**: Not configured
- **Google Maps API**: Not configured

---

## 📧 1. SendGrid Email Configuration

### Step 1: Create SendGrid Account
1. Go to [SendGrid](https://sendgrid.com)
2. Sign up for a free account (100 emails/day free)
3. Verify your email address

### Step 2: Generate API Key
1. Navigate to Settings → API Keys
2. Click "Create API Key"
3. Name: `kiiltoloisto-production`
4. Select "Full Access"
5. Copy the API key (starts with `SG.`)

### Step 3: Verify Sender Domain
1. Go to Settings → Sender Authentication
2. Add domain: `kiiltoloisto.fi`
3. Follow DNS verification steps
4. Add these DNS records to your domain:
   ```
   CNAME: em1234.kiiltoloisto.fi → sendgrid.net
   CNAME: s1._domainkey.kiiltoloisto.fi → s1.domainkey.sendgrid.net
   CNAME: s2._domainkey.kiiltoloisto.fi → s2.domainkey.sendgrid.net
   ```

### Step 4: Update Netlify Environment Variables
```bash
SENDGRID_API_KEY=SG.your-actual-api-key-here
SENDER_EMAIL=noreply@kiiltoloisto.fi
```

### Step 5: Test Email Delivery
```bash
npm run test:email -- --to your-email@example.com
```

---

## 💳 2. Stripe Payment Integration

### Step 1: Create Stripe Account
1. Go to [Stripe](https://stripe.com)
2. Sign up and complete business verification
3. Add bank account for payouts (Finnish bank account)

### Step 2: Configure Products
1. Go to Products → Add Product
2. Create services:
   - Basic Wash: €25.00
   - Premium Wash: €45.00
   - VIP Detail: €120.00

### Step 3: Get API Keys
1. Navigate to Developers → API Keys
2. For testing: Use test keys (sk_test_...)
3. For production: Use live keys (sk_live_...)

### Step 4: Setup Webhook Endpoint
1. Go to Developers → Webhooks
2. Add endpoint: `https://kiiltoloisto.fi/.netlify/functions/payment-webhook`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.failed`
4. Copy webhook signing secret

### Step 5: Update Netlify Environment Variables
```bash
# For Production (use test keys first!)
STRIPE_SECRET_KEY=sk_test_your-test-key-here
STRIPE_PUBLISHABLE_KEY=pk_test_your-test-key-here
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# When ready for live payments
STRIPE_SECRET_KEY=sk_live_your-live-key-here
STRIPE_PUBLISHABLE_KEY=pk_live_your-live-key-here
```

### Step 6: Test Payment Flow
```bash
# Use Stripe test cards
4242 4242 4242 4242 - Successful payment
4000 0000 0000 0002 - Declined payment
```

---

## 📱 3. Twilio SMS Configuration

### Step 1: Create Twilio Account
1. Go to [Twilio](https://www.twilio.com)
2. Sign up for trial account (includes $15 credit)
3. Verify your phone number

### Step 2: Get Finnish Phone Number
1. Go to Phone Numbers → Buy a Number
2. Select country: Finland (+358)
3. Choose SMS-capable number
4. Monthly cost: ~€1-5

### Step 3: Configure Messaging Service
1. Go to Messaging → Services
2. Create new service: `Kiiltoloisto Notifications`
3. Add your phone number to the service
4. Configure sender pool

### Step 4: Get Credentials
1. Go to Account → API Keys & Tokens
2. Copy Account SID (starts with AC)
3. Copy Auth Token

### Step 5: Update Netlify Environment Variables
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token-here
TWILIO_FROM=+358xxxxxxxxx
```

### Step 6: Test SMS Delivery
```bash
npm run test:sms -- --to +358401234567
```

---

## 🗺️ 4. Google Maps API Configuration

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: `kiiltoloisto-maps`
3. Enable billing (required for production)

### Step 2: Enable Required APIs
1. Go to APIs & Services → Library
2. Enable:
   - Maps JavaScript API
   - Places API
   - Geocoding API

### Step 3: Create API Key
1. Go to APIs & Services → Credentials
2. Create Credentials → API Key
3. Restrict key:
   - Application restrictions: HTTP referrers
   - Add: `https://kiiltoloisto.fi/*`
   - Add: `https://*.kiiltoloisto.fi/*`
4. API restrictions: Select enabled APIs only

### Step 4: Update Netlify Environment Variables
```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 🚀 Deployment Checklist

### Before Going Live:

#### 1. Email Service (SendGrid)
- [ ] Real API key configured
- [ ] Domain authentication completed
- [ ] SPF/DKIM records added to DNS
- [ ] Test email sent successfully
- [ ] Email templates reviewed

#### 2. Payment Processing (Stripe)
- [ ] Switch from test to live keys
- [ ] Webhook endpoint verified
- [ ] SSL certificate active
- [ ] Test transaction completed
- [ ] Refund process tested

#### 3. SMS Service (Twilio)
- [ ] Production credentials configured
- [ ] Finnish phone number purchased
- [ ] Message templates approved
- [ ] Test SMS sent successfully

#### 4. Google Maps
- [ ] API key restricted to domain
- [ ] Billing account active
- [ ] Usage quotas configured
- [ ] Fallback for quota exceeded

#### 5. Security
- [ ] All API keys in environment variables
- [ ] No keys in source code
- [ ] HTTPS enforced
- [ ] Rate limiting configured
- [ ] Error messages don't expose details

---

## 📝 Environment Variables Template

Create `.env.production.local` in Netlify with:

```bash
# Database (Already Working)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# NextAuth (Already Working)
NEXTAUTH_URL=https://kiiltoloisto.fi
NEXTAUTH_SECRET=[your-64-character-secret]

# SendGrid Email (NEEDS REAL KEY)
SENDGRID_API_KEY=SG.[your-actual-sendgrid-api-key]
SENDER_EMAIL=noreply@kiiltoloisto.fi

# Stripe Payments (NEEDS CONFIGURATION)
STRIPE_SECRET_KEY=sk_live_[your-stripe-secret-key]
STRIPE_PUBLISHABLE_KEY=pk_live_[your-stripe-publishable-key]
STRIPE_WEBHOOK_SECRET=whsec_[your-webhook-secret]

# Twilio SMS (OPTIONAL BUT RECOMMENDED)
TWILIO_ACCOUNT_SID=AC[your-account-sid]
TWILIO_AUTH_TOKEN=[your-auth-token]
TWILIO_FROM=+358[your-twilio-number]

# Google Maps (OPTIONAL)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza[your-google-maps-key]

# Site Configuration
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://kiiltoloisto.fi
```

---

## 🧪 Testing Commands

Run these after configuration:

```bash
# Test all integrations
npm run test:integrations

# Test individual services
npm run test:email
npm run test:payment
npm run test:sms
npm run test:maps

# Check environment variables
npm run validate:env
```

---

## 📞 Support Contacts

- **SendGrid Support**: support@sendgrid.com
- **Stripe Support**: support@stripe.com
- **Twilio Support**: support@twilio.com
- **Google Cloud**: cloud.google.com/support

---

## 🔄 Next Steps

1. **Immediate Priority**: Configure SendGrid for email notifications
2. **High Priority**: Setup Stripe for payment processing
3. **Medium Priority**: Configure Twilio for SMS notifications
4. **Low Priority**: Add Google Maps for location display

---

## 🛠️ Troubleshooting

### SendGrid Issues
- **Error 401**: Invalid API key - regenerate key
- **Error 403**: Sender not verified - complete domain authentication
- **Emails not arriving**: Check spam folder, verify SPF/DKIM

### Stripe Issues
- **Webhook failures**: Verify endpoint URL and secret
- **Payment declined**: Check card details and billing address
- **3D Secure**: Enable in Stripe dashboard for European cards

### Twilio Issues
- **SMS not sending**: Verify phone number format (+358...)
- **Trial limitations**: Upgrade account for production
- **Delivery failures**: Check recipient's carrier restrictions

### Google Maps Issues
- **Map not showing**: Check API key and domain restrictions
- **Quota exceeded**: Increase quotas or implement caching
- **CORS errors**: Verify allowed domains in API console