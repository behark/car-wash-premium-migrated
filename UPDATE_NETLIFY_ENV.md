# 🔧 Netlify Environment Variables - Correct Configuration

## ❌ Variables to DELETE (Not needed):
- All the duplicate `postgresql://` entries at the bottom
- `BUSINESS_PHONE` (this is in siteConfig)
- `BUSINESS_TAGLINE` (this is in siteConfig)
- `GOOGLE_MAPS_LAT` (not used)

## ✅ Variables to ADD or UPDATE:

Copy and paste these exact values into your Netlify Environment Variables:

### 1. **DATABASE_URL** (Keep existing - it looks correct)
```
postgresql://postgres.tamqwcfugkbnaqafbybb:Beharkabashi1@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

### 2. **NEXTAUTH_URL** (ADD NEW)
```
https://kiiltoloisto.netlify.app
```
*Note: Replace with your actual Netlify URL if different*

### 3. **NEXTAUTH_SECRET** (ADD NEW - CRITICAL!)
Generate a new secret by running this command in your terminal:
```bash
openssl rand -base64 32
```
Or use this pre-generated one (but generate your own for better security):
```
w5XH9Zr8KqN3Fv7mP2LsA6JdE4GhR9TbC1YnQ8WxU0I=
```

### 4. **NODE_ENV** (ADD NEW)
```
production
```

### 5. **SENDER_EMAIL** (RENAME from FROM_EMAIL)
```
kroiautocenter@gmail.com
```

### 6. **SENDGRID_API_KEY** (ADD NEW - for email to work)
You need to get this from SendGrid. For now, leave it empty or use:
```
SG.test-key-not-configured
```
*Note: Emails won't work without a real SendGrid API key*

## 📝 Step-by-Step Instructions:

1. **Go to your Netlify Dashboard** (which you already have open)

2. **Delete unnecessary variables:**
   - Click on each duplicate `postgresql://` entry
   - Click "Delete" for each one
   - Delete `BUSINESS_PHONE`, `BUSINESS_TAGLINE`, `GOOGLE_MAPS_LAT`

3. **Add new variables:**
   - Click "New variable"
   - Add each variable from the list above
   - For each one:
     - Key: The variable name (e.g., `NEXTAUTH_URL`)
     - Values:
       - Scopes: Check "All scopes"
       - Value: Copy the value from above

4. **Update existing variables:**
   - Click on `FROM_EMAIL`
   - Change the key to `SENDER_EMAIL`
   - Keep the value the same

5. **Save all changes**

6. **Trigger a redeploy:**
   - Go to the Deploys tab
   - Click "Trigger deploy" → "Clear cache and deploy site"

## 🎯 Final Configuration Should Look Like:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | postgresql://postgres.tamqwcfugkbnaqafbybb:... |
| `NEXTAUTH_URL` | https://kiiltoloisto.netlify.app |
| `NEXTAUTH_SECRET` | [Your generated secret] |
| `NODE_ENV` | production |
| `SENDER_EMAIL` | kroiautocenter@gmail.com |
| `CONTACT_EMAIL` | (keep existing value) |
| `SENDGRID_API_KEY` | (optional - for email) |

## ⚠️ Important Notes:

1. **NEXTAUTH_SECRET is CRITICAL** - Without it, the booking system won't work
2. **NEXTAUTH_URL must match your site URL** - Update if your Netlify URL is different
3. **SendGrid API Key** - Bookings will save but emails won't send without it

## 🧪 After Updating Variables:

Test the booking system:
1. Go to: https://kiiltoloisto.netlify.app/booking
2. Try to make a test booking
3. Check Netlify Functions logs if there are errors

## 🆘 If Booking Still Doesn't Work:

Check the Functions tab in Netlify:
- Look for error messages in the function logs
- Most common issue: NEXTAUTH_SECRET not set correctly

---

**Need SendGrid API Key?**
1. Sign up at: https://sendgrid.com/
2. Create an API key
3. Add it to Netlify variables
4. Then emails will work!