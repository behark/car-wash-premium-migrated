# 🌱 Seed Production Database

## Issue: Database is Empty

Your site is live but the database has **no services**, so the booking page shows "Internal Error".

---

## ✅ SOLUTION: Run Seed Script

### **Option 1: Seed from Local (Easiest)**

**Run this command locally:**

```bash
cd "/home/behar/Desktop/New Folder (2)/car-wash-booking"

# This will populate your production database with:
# - 12 services (car washes, tire services, extras)
# - Business hours (Mon-Sat)
# - App settings
# - Admin user

npm run prisma:seed
```

**What it creates:**
- ✅ 12 services (Käsinpesu, Pikavaha, Sisäpuhdistus, etc.)
- ✅ Business hours (8:00-18:00 weekdays, 10:00-16:00 Saturday)
- ✅ Admin user with your password
- ✅ App settings

**Time:** 10 seconds

---

### **Option 2: Seed via Netlify (Alternative)**

If local doesn't work, create a one-time API endpoint:

1. I can create `/api/admin/seed` endpoint
2. You call it once from browser
3. Seeds the database
4. Delete the endpoint after

---

## 📊 Services That Will Be Created:

### **Autopesut (Car Washes):**
1. Käsinpesu - 25€
2. Käsinpesu + Pikavaha - 30€
3. Käsinpesu + Sisäpuhdistus - 55€
4. Käsinpesu + Normaalivaha - 70€
5. Käsinpesu + Kovavaha - 110€
6. Maalipinnan Kiillotus - 350€

### **Renkaat (Tires):**
7. Renkaiden Vaihto - 20€
8. Renkaiden Pesu - 10€
9. Rengashotelli - 69€

### **Lisäpalvelut (Additional):**
10. Moottorin Pesu - 20€
11. Hajunpoisto Otsonoinnilla - 50€
12. Penkkien Pesu - 100€

---

## 🚀 After Seeding:

**Refresh the booking page:**
https://kiiltoloisto.fi/booking

**You'll see:**
- ✅ All 12 services listed
- ✅ Calendar works
- ✅ Time slots available
- ✅ Booking form functional

---

## ⚡ Quick Command:

```bash
cd "/home/behar/Desktop/New Folder (2)/car-wash-booking" && npm run prisma:seed
```

**That's it!** Database will be populated with all services!

---

**Want me to run this for you?** Or you can run it locally now!
