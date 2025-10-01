# 🌐 Domain Setup Instructions for kiiltoloisto.fi

## 🎉 Deployment Successful!

Your site is now live at:
- **Netlify URL:** https://kiiltoloisto-fi.netlify.app
- **GitHub Repo:** https://github.com/behark/kiiltoloisto-fi

## 📋 Domain Configuration Steps

### Step 1: Add Custom Domain in Netlify

1. Go to: https://app.netlify.com/projects/kiiltoloisto-fi/site-configuration/domain-management
2. Click **"Add a domain"**
3. Enter: `kiiltoloisto.fi`
4. Click **"Verify"**
5. Then add: `www.kiiltoloisto.fi`

### Step 2: Configure DNS at Your Domain Provider

Where did you register kiiltoloisto.fi? Update the DNS settings there:

#### Option A: Using Netlify DNS (Recommended)
Point your domain's nameservers to Netlify:
```
dns1.p09.nsone.net
dns2.p09.nsone.net
dns3.p09.nsone.net
dns4.p09.nsone.net
```

#### Option B: Using Your Current DNS Provider
Add these records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 75.2.60.5 | 3600 |
| CNAME | www | kiiltoloisto-fi.netlify.app | 3600 |

### Step 3: Wait for DNS Propagation
- DNS changes can take 1-48 hours to propagate globally
- You can check status at: https://dnschecker.org/#A/kiiltoloisto.fi

### Step 4: Enable HTTPS (After DNS is set up)
1. Go back to Netlify domain settings
2. Click **"HTTPS"** → **"Verify DNS configuration"**
3. Click **"Provision certificate"**
4. Wait 5-10 minutes for SSL certificate

## ✅ What's Already Configured

### Environment Variables Set:
- ✅ DATABASE_URL (Supabase PostgreSQL)
- ✅ NEXTAUTH_URL (https://www.kiiltoloisto.fi)
- ✅ NEXTAUTH_SECRET (Secure key generated)
- ✅ NODE_ENV (production)
- ✅ SENDER_EMAIL (kroiautocenter@gmail.com)
- ✅ CONTACT_EMAIL (Info@kiiltoloisto.fi)

### Features Ready:
- ✅ Static pages (Home, Services, Gallery, etc.)
- ✅ Netlify Functions for API
- ✅ Database connected
- ✅ Working hours: Mon-Fri 08:00-18:00, Sat 10:00-16:00

### Features Needing Configuration:
- ⚠️ **SendGrid API Key** - For email notifications
- ⚠️ **Stripe Keys** - For payment processing
- ⚠️ **Twilio Credentials** - For SMS notifications

## 🧪 Testing Your Site

### 1. Test Current Deployment:
Visit: https://kiiltoloisto-fi.netlify.app

### 2. Test Booking System:
1. Go to: https://kiiltoloisto-fi.netlify.app/booking
2. Select a service
3. Choose date/time
4. Fill customer info
5. Submit booking

### 3. Check Function Logs:
If booking fails, check logs at:
https://app.netlify.com/projects/kiiltoloisto-fi/logs/functions

## 📊 Project URLs

| Service | URL |
|---------|-----|
| **Live Site** | https://kiiltoloisto-fi.netlify.app |
| **Future Domain** | https://www.kiiltoloisto.fi |
| **Netlify Dashboard** | https://app.netlify.com/projects/kiiltoloisto-fi |
| **GitHub Repo** | https://github.com/behark/kiiltoloisto-fi |
| **Function Logs** | https://app.netlify.com/projects/kiiltoloisto-fi/logs/functions |

## 🚀 Next Steps

1. **Configure DNS** at your domain registrar
2. **Wait for propagation** (check with dnschecker.org)
3. **Enable HTTPS** in Netlify
4. **Test booking system**
5. **Add SendGrid API key** for emails (optional)

## 📝 Common Domain Registrars DNS Settings

### If registered at Namecheap:
1. Login to Namecheap
2. Domain List → Manage → Advanced DNS
3. Add the A and CNAME records above

### If registered at GoDaddy:
1. Login to GoDaddy
2. My Products → DNS → Manage DNS
3. Add the records above

### If registered at Cloudflare:
1. Login to Cloudflare
2. Select domain → DNS
3. Add records (disable proxy/orange cloud for initial setup)

### If registered at Finnish provider (e.g., Louhi, Nebula):
1. Login to control panel
2. Find DNS/Name Server settings
3. Either change nameservers to Netlify or add A/CNAME records

## ❓ Need Help?

- **Netlify Support:** https://answers.netlify.com/
- **DNS Issues:** Check at https://dnschecker.org/
- **Booking Issues:** Check function logs in Netlify dashboard

---

**Deployment completed at:** January 1, 2025
**Site Status:** ✅ LIVE and READY (pending DNS configuration)