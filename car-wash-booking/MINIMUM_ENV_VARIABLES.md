# 🚀 Minimum Environment Variables for Deployment

## ✅ **REQUIRED - Only These 5 Variables**

Your site will deploy and work with **ONLY** these variables:

### Copy-Paste to Netlify Dashboard:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://postgres.tamqwcfugkbnaqafbybb:Beharkabashi1@aws-1-eu-central-1.pooler.supabase.com:5432/postgres` | Your Supabase database |
| `NEXTAUTH_URL` | `https://kiiltoloisto.fi` | Your production domain |
| `NEXTAUTH_SECRET` | `UDRlJwJLAhRvRzg9hBOmdg03mXdybZuyCIYk0uizJ9bFHC/RrjDWAuRcPwcFG+ZnSh2sD4QuOtnUxxw669Xikg==` | Authentication secret |
| `ADMIN_EMAIL` | `admin@kiiltoloisto.fi` | Admin login email |
| `ADMIN_PASSWORD` | `kSsdIIaRMKsCvcsyCblp7lkJENjRYduFxOGOhAKSuDU=` | Admin login password (SAVE THIS!) |

---

## 🎯 What Works Without SendGrid/Twilio?

### ✅ **Will Work:**
- ✅ Website loads perfectly
- ✅ All pages (home, booking, services, etc.)
- ✅ Booking form and availability checking
- ✅ Admin panel login and management
- ✅ Database operations
- ✅ Payment processing (if Stripe configured)
- ✅ All UI features

### ⚠️ **Won't Work (but site still functions):**
- ❌ Email confirmations to customers
- ❌ SMS notifications
- ❌ Automated reminder emails

**The site will log warnings but continue working!**

---

## 📧 When to Add Email/SMS (Optional)

### Add Later When Needed:

**For Email Notifications:**
```
SENDGRID_API_KEY=SG.your-key
SENDER_EMAIL=noreply@kiiltoloisto.fi
```

**For SMS Notifications:**
```
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_FROM=+358xxxxxxxxx
```

**For Payments:**
```
STRIPE_SECRET_KEY=sk_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_xxxxx
```

You can add these **anytime** without redeploying code - just:
1. Add variables in Netlify
2. Click "Trigger deploy"

---

## 🚀 Quick Deploy Steps

1. **Login to Netlify**: https://app.netlify.com/
2. **Go to**: Site Settings → Environment Variables
3. **Add** the 5 variables from the table above
4. **Select**: "All scopes" for each
5. **Deploy**: Deploys tab → Trigger deploy

**That's it!** Site will be live in ~10 minutes.

---

## 🔐 Your Login Info

**Admin URL:** https://kiiltoloisto.fi/admin/login

```
Email: admin@kiiltoloisto.fi
Password: kSsdIIaRMKsCvcsyCblp7lkJENjRYduFxOGOhAKSuDU=
```

💾 **Save this password!** You can't retrieve it later.

---

## 📊 What Customers Will See

### Booking Flow:
1. ✅ Choose service
2. ✅ Select date/time
3. ✅ Fill in details
4. ✅ Submit booking
5. ✅ See confirmation page with booking code
6. ⚠️ **No email sent** (but they see the confirmation on screen)

### Workaround Without Email:
- Customers get confirmation code on screen
- You can manually email them from admin panel
- Or add SendGrid later to automate

---

## 💡 Recommendation

**Start with minimum variables**, test the site, then add email/SMS when needed:

1. **Week 1**: Deploy with 5 variables, test everything
2. **Week 2**: Add SendGrid for automated emails
3. **Week 3+**: Add Twilio for SMS if desired

---

## 🆘 Need Help?

**Site not working?**
- Check all 5 variables are set correctly
- Check Netlify build logs for errors
- Verify DATABASE_URL is accessible

**Want to add email later?**
- See `QUICK_START_NETLIFY.md` for SendGrid setup
- Takes 5 minutes to add

**Questions?**
- Full details: `NETLIFY_ENV_VARIABLES.txt`
- Deployment checklist: `NETLIFY_DEPLOYMENT_CHECKLIST.md`

---

**Bottom line:** You can deploy **RIGHT NOW** with just 5 variables. Email/SMS are optional extras! 🚀
