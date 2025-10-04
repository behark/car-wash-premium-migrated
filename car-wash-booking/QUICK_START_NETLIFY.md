# 🚀 Quick Start - Netlify Deployment

## Step 1: Get Your SendGrid API Key (REQUIRED)

**Without this, emails won't work!**

1. Go to: https://app.sendgrid.com/signup
2. Create free account (100 emails/day free)
3. Verify your email
4. Go to: **Settings** → **API Keys** → **Create API Key**
5. Name: "Car Wash Booking Production"
6. Permissions: **Full Access**
7. **COPY THE KEY** (starts with `SG.`) - you can't see it again!

## Step 2: Add Environment Variables to Netlify

Go to: https://app.netlify.com/ → Your Site → **Site Settings** → **Environment Variables**

Click **"Add a variable"** for each:

### ✅ Copy-Paste These (Already Generated for You):

| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | `postgresql://postgres.tamqwcfugkbnaqafbybb:Beharkabashi1@aws-1-eu-central-1.pooler.supabase.com:5432/postgres` | Your Supabase DB |
| `NEXTAUTH_URL` | `https://kiiltoloisto.fi` | Your domain |
| `NEXTAUTH_SECRET` | `UDRlJwJLAhRvRzg9hBOmdg03mXdybZuyCIYk0uizJ9bFHC/RrjDWAuRcPwcFG+ZnSh2sD4QuOtnUxxw669Xikg==` | Already generated |
| `ADMIN_EMAIL` | `admin@kiiltoloisto.fi` | Change if you want |
| `ADMIN_PASSWORD` | `kSsdIIaRMKsCvcsyCblp7lkJENjRYduFxOGOhAKSuDU=` | **SAVE THIS!** |
| `SENDER_EMAIL` | `noreply@kiiltoloisto.fi` | Must verify in SendGrid |

### ✅ Add Your SendGrid Key:

| Key | Value | Notes |
|-----|-------|-------|
| `SENDGRID_API_KEY` | `SG.your-actual-key-here` | From Step 1 |

**Important:** For each variable, select **"All scopes"** when adding!

## Step 3: Verify SendGrid Sender

1. In SendGrid, go to: **Settings** → **Sender Authentication**
2. Choose: **Verify a Single Sender**
3. Enter: `noreply@kiiltoloisto.fi` (or your preferred sender)
4. Fill in the form (name: Kiilto & Loisto, etc.)
5. Check your email and click verification link

## Step 4: Deploy!

1. In Netlify, go to: **Deploys** tab
2. Click: **Trigger deploy** → **Deploy site**
3. Wait 5-10 minutes for build
4. Visit: https://kiiltoloisto.fi

## Step 5: Test Login

1. Go to: https://kiiltoloisto.fi/admin/login
2. Email: `admin@kiiltoloisto.fi` (or what you set)
3. Password: `kSsdIIaRMKsCvcsyCblp7lkJENjRYduFxOGOhAKSuDU=` (or what you set)

---

## 🎉 That's It!

Your site should now be live with:
- ✅ Working database
- ✅ Email notifications
- ✅ Admin panel
- ✅ Booking system
- ✅ HTTPS security

---

## 🔧 Optional: Add SMS & Payments Later

### SMS Notifications (Twilio)
1. Sign up: https://www.twilio.com/try-twilio
2. Get phone number for Finland
3. Add to Netlify:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM`

### Payments (Stripe)
1. Sign up: https://dashboard.stripe.com/register
2. Get API keys from: Developers → API Keys
3. Add to Netlify:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`

---

## 🆘 Troubleshooting

**Build fails?**
- Check Netlify build logs
- Verify all 7 required env variables are set
- Make sure DATABASE_URL is correct

**Can't login to admin?**
- Check ADMIN_EMAIL and ADMIN_PASSWORD are set
- Wait 2-3 minutes after deploy
- Try incognito/private window

**Emails not sending?**
- Verify SENDGRID_API_KEY is correct
- Check sender email is verified in SendGrid
- Check SendGrid activity logs

---

**Full details in:** `NETLIFY_ENV_VARIABLES.txt`
