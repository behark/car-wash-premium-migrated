# 🔒 Fix 403 Forbidden Error

**Current Issue:** Your Netlify site is showing 403 Forbidden

**Site URL:** https://kiiltoloisto-fi.netlify.app

---

## 🎯 Quick Fix (Takes 2 Minutes)

Your site has **access restrictions** enabled. Here's how to remove them:

### Step 1: Go to Netlify Dashboard
1. Visit: https://app.netlify.com/sites/kiiltoloisto-fi
2. Log in if needed

### Step 2: Navigate to Site Settings
1. Click **"Site settings"** (left sidebar or top)
2. Scroll down to **"Access control"** section
3. Or directly: https://app.netlify.com/sites/kiiltoloisto-fi/settings/access

### Step 3: Remove Access Restrictions

You'll see one of these options:

#### Option A: Password Protection
```
If you see "Password Protection":
1. Click "Change password"
2. Select "Remove password protection"
3. Click "Save"
```

#### Option B: Visitor Access Settings
```
If you see "Visitor access":
1. Look for dropdown menu
2. Change from "Restricted" to "Public"
3. Click "Save changes"
```

#### Option C: Team Member Access
```
If you see "Team members only":
1. Change to "Public"
2. Save changes
```

### Step 4: Verify Fix
After saving, wait 30 seconds, then visit:
```
https://kiiltoloisto-fi.netlify.app
```

You should see your site! ✅

---

## 🖼️ Visual Guide

### What to Look For:

**In Site Settings → Access control:**

❌ **If you see this (WRONG):**
```
┌─────────────────────────────┐
│ Password Protection         │
│ Password: ••••••••          │
│ [Change password]           │
└─────────────────────────────┘
```
**Fix:** Click "Change password" → "Remove password protection"

✅ **Should look like this (CORRECT):**
```
┌─────────────────────────────┐
│ Visitor Access              │
│ ○ Public                    │
│ ○ Team members only         │
└─────────────────────────────┘
```
**Make sure "Public" is selected**

---

## 🔍 Alternative: Check via Netlify CLI

```bash
cd /home/behar/Desktop/New\ Folder\ \(2\)/car-wash-booking

# Check site info
netlify sites:list

# Open site settings in browser
netlify open:admin
```

Then navigate to Access Control as described above.

---

## 🚨 Common Causes of 403 Error

### 1. Password Protection Enabled
- **Why:** You may have set a password for preview
- **Fix:** Remove password protection
- **Location:** Site settings → Access control

### 2. Team Members Only
- **Why:** Site set to private for team only
- **Fix:** Change to "Public"
- **Location:** Site settings → Access control

### 3. IP Restrictions
- **Why:** IP whitelist configured
- **Fix:** Remove IP restrictions
- **Location:** Site settings → Access control

### 4. Build Context Protection
- **Why:** Branch deploy preview protection
- **Fix:** This only affects branch deploys, not main site
- **Location:** Site settings → Build & deploy

---

## ✅ After Fixing - Test These

### Test 1: Homepage
```
Visit: https://kiiltoloisto-fi.netlify.app
Expected: See your car wash homepage
```

### Test 2: Booking Page
```
Visit: https://kiiltoloisto-fi.netlify.app/booking
Expected: See booking form with services
```

### Test 3: API Endpoint
```bash
curl https://kiiltoloisto-fi.netlify.app/.netlify/functions/services-index?active=true
```
**Expected:** JSON response with services

### Test 4: Full Booking Flow
1. Go to booking page
2. Select "Käsinpesu" (25€)
3. Choose tomorrow's date
4. See available time slots
5. Fill in test info
6. Create booking
7. Get confirmation code

---

## 📞 If Still Getting 403 After Removing Password

### Check Build Status
1. Go to: https://app.netlify.com/sites/kiiltoloisto-fi/deploys
2. Make sure latest deploy shows green checkmark ✅
3. If red ❌, check build logs for errors

### Check Domain Settings
1. Site settings → Domain management
2. Make sure primary domain is set
3. Try using the Netlify subdomain directly

### Check Functions
1. Site settings → Functions
2. Make sure functions are enabled
3. Check function logs for errors

### Force Redeploy
```bash
cd /home/behar/Desktop/New\ Folder\ \(2\)/car-wash-booking
git commit --allow-empty -m "Force redeploy"
git push
```

---

## 🎯 Expected Behavior (After Fix)

### ✅ Homepage Should Show:
- Kiilto & Loisto logo
- Service cards (12 services)
- Contact information
- Booking button

### ✅ Booking Page Should Show:
- Service selection grid
- Date picker
- Time slot selector (after selecting date)
- Customer information form
- "Vahvista varaus" button

### ✅ API Should Return:
```json
{
  "success": true,
  "services": [
    {
      "id": 1,
      "titleFi": "Käsinpesu",
      "priceCents": 2500,
      "durationMinutes": 30,
      ...
    },
    ...
  ]
}
```

---

## 📝 Summary

**Problem:** 403 Forbidden error on your deployed site

**Cause:** Access restrictions (password/privacy settings) enabled

**Solution:**
1. Go to Netlify dashboard
2. Site settings → Access control
3. Remove password protection OR change to "Public"
4. Save changes
5. Wait 30 seconds
6. Visit site again

**Time to fix:** 2 minutes ⏱️

---

## 🚀 Next Steps After Fixing

Once the 403 is resolved:

1. ✅ Test homepage loads
2. ✅ Test booking page loads
3. ✅ Make a test booking
4. ✅ Verify booking in database
5. 📧 Add SendGrid for emails (optional)

---

**Need help?** Open: https://app.netlify.com/sites/kiiltoloisto-fi/settings/access

Look for "Password Protection" or "Visitor Access" and set to Public!
