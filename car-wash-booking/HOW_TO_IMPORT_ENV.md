# 📦 How to Import Environment Variables to Netlify

## Method 1: Import from .env file (EASIEST! ⭐)

### Step-by-Step:

1. **Download the file**: `.env.netlify.production` (in your project root)

2. **Go to Netlify Dashboard**:
   - Login: https://app.netlify.com/
   - Select your site
   - Click **Site Settings** (top menu)
   - Click **Environment variables** (left sidebar)

3. **Click the Import button**:
   - Look for **"Import from .env"** button (top right area)
   - Click it

4. **Upload the file**:
   - Select `.env.netlify.production` from your computer
   - Click **Import**

5. **Done!** ✅
   - All 5 variables imported instantly
   - Go to **Deploys** → **Trigger deploy**

---

## Method 2: Using Netlify CLI (For Advanced Users)

```bash
# Install Netlify CLI (if not installed)
npm install -g netlify-cli

# Login to Netlify
netlify login

# Link to your site
netlify link

# Import environment variables
netlify env:import .env.netlify.production

# Verify
netlify env:list
```

---

## Method 3: Manual Copy-Paste (Slower)

If import doesn't work, copy from the file and add manually:

1. Open `.env.netlify.production`
2. For each line (that's not commented):
   - Click **Add a variable** in Netlify
   - Copy the KEY (left side of `=`)
   - Copy the VALUE (right side, remove quotes)
   - Scope: **All scopes**
   - Click **Create variable**

---

## 📋 What Gets Imported

From `.env.netlify.production`:

✅ **5 Required Variables:**
1. DATABASE_URL
2. NEXTAUTH_URL
3. NEXTAUTH_SECRET
4. ADMIN_EMAIL
5. ADMIN_PASSWORD

⚪ **Optional (commented out, add later):**
- SENDGRID_API_KEY
- SENDER_EMAIL
- TWILIO credentials
- STRIPE credentials
- GOOGLE_MAPS_API_KEY

---

## 🔄 After Importing

1. **Verify variables are set**:
   - Check the Environment variables page
   - Should see all 5 variables listed

2. **Trigger deployment**:
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**

3. **Wait for build** (5-10 minutes)

4. **Test your site**: https://kiiltoloisto.fi

---

## ⚠️ Important Notes

### File Location:
- File must be in your project root
- Named: `.env.netlify.production`
- Format: `KEY="value"` (with quotes)

### Scopes:
- When importing, Netlify auto-assigns to "All scopes"
- This is what you want ✅

### Security:
- ❌ DO NOT commit this file to git (already in .gitignore)
- ✅ Keep it locally for reference
- ✅ Store admin password in password manager

### Comments:
- Lines starting with `#` are ignored (commented)
- To enable optional variables:
  - Remove the `#` at start of line
  - Add actual value
  - Re-import file

---

## 🎯 Quick Reference

**File to import**: `.env.netlify.production`

**Where to import**:
Netlify Dashboard → Site Settings → Environment variables → Import from .env

**Button location**: Top right corner of Environment variables page

**After import**: Trigger deploy to apply changes

---

## 🆘 Troubleshooting

### "Import from .env" button not showing?
- Make sure you're on the **Environment variables** page
- Look for a button with upload/import icon
- Try updating your browser or using Chrome

### Import failed?
- Check file format (must be `KEY="value"`)
- No spaces around `=`
- Values must have quotes if they contain special chars
- Try Method 3 (manual) instead

### Variables not working after import?
- **Trigger a new deploy** (import doesn't auto-deploy)
- Wait for build to complete
- Check Netlify build logs for errors

---

## ✅ Success Checklist

After import, verify:
- [ ] See 5 variables in Netlify dashboard
- [ ] DATABASE_URL is set
- [ ] NEXTAUTH_SECRET is set
- [ ] ADMIN credentials are set
- [ ] Triggered new deployment
- [ ] Build succeeded (no errors)
- [ ] Site loads at https://kiiltoloisto.fi
- [ ] Can login to admin panel

---

**Need help?** See `MINIMUM_ENV_VARIABLES.md` for manual setup.
