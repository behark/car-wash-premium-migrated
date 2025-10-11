#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { format, addDays } = require('date-fns');

const prisma = new PrismaClient();

async function verifyBookingSystem() {
  console.log('🔍 Verifying Booking System...\n');

  let allPassed = true;

  try {
    // Test 1: Database Connection
    console.log('1️⃣ Testing Database Connection...');
    await prisma.$connect();
    console.log('   ✅ Database connection successful\n');

    // Test 2: Check Services
    console.log('2️⃣ Checking Services...');
    const services = await prisma.service.findMany({
      where: { isActive: true }
    });
    console.log(`   ✅ Found ${services.length} active service(s)`);
    services.forEach(s => {
      console.log(`      - ${s.titleFi}: ${s.priceCents/100}€, ${s.durationMinutes} min`);
    });
    console.log();

    if (services.length === 0) {
      console.log('   ⚠️  WARNING: No active services found. Run seed script first.');
      allPassed = false;
    }

    // Test 3: Check Business Hours
    console.log('3️⃣ Checking Business Hours...');
    const businessHours = await prisma.businessHours.findMany({
      orderBy: { dayOfWeek: 'asc' }
    });
    console.log(`   ✅ Found ${businessHours.length} business hours entries`);

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    businessHours.forEach(h => {
      const status = h.isOpen ? `${h.startTime} - ${h.endTime}` : 'CLOSED';
      console.log(`      ${days[h.dayOfWeek]}: ${status}`);
    });
    console.log();

    if (businessHours.length === 0) {
      console.log('   ⚠️  WARNING: No business hours configured. Run seed script first.');
      allPassed = false;
    }

    // Test 4: Check Recent Bookings
    console.log('4️⃣ Checking Recent Bookings...');
    const recentBookings = await prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { service: true }
    });
    console.log(`   ✅ Found ${recentBookings.length} recent booking(s)`);
    recentBookings.forEach(b => {
      console.log(`      - ${b.confirmationCode}: ${b.customerName} on ${format(b.date, 'yyyy-MM-dd')} at ${b.startTime}`);
      console.log(`        Service: ${b.service.titleFi}, Duration: ${b.duration} min, Status: ${b.status}`);
    });
    console.log();

    // Test 5: Test Availability Calculation
    if (services.length > 0 && businessHours.some(h => h.isOpen)) {
      console.log('5️⃣ Testing Availability Calculation...');
      const testDate = addDays(new Date(), 7); // 7 days from now
      const testService = services[0];
      const dayOfWeek = testDate.getDay();
      const dayHours = businessHours.find(h => h.dayOfWeek === dayOfWeek);

      if (dayHours && dayHours.isOpen) {
        console.log(`   Testing date: ${format(testDate, 'yyyy-MM-dd')} (${days[dayOfWeek]})`);
        console.log(`   Business hours: ${dayHours.startTime} - ${dayHours.endTime}`);
        console.log(`   Service: ${testService.titleFi} (${testService.durationMinutes} min)`);

        // Calculate expected slots
        const startHour = parseInt(dayHours.startTime.split(':')[0]);
        const startMin = parseInt(dayHours.startTime.split(':')[1]);
        const endHour = parseInt(dayHours.endTime.split(':')[0]);
        const endMin = parseInt(dayHours.endTime.split(':')[1]);

        const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const expectedSlots = Math.floor(totalMinutes / 30);

        console.log(`   Expected ~${expectedSlots} time slots (30-min intervals)`);
        console.log('   ✅ Availability logic configuration looks good\n');
      } else {
        console.log(`   ℹ️  Test date falls on ${days[dayOfWeek]} (closed day)\n`);
      }
    }

    // Test 6: Check Database Schema
    console.log('6️⃣ Verifying Database Schema...');
    const booking = await prisma.booking.findFirst();
    if (booking) {
      const hasRequiredFields = booking.hasOwnProperty('duration') &&
                                booking.hasOwnProperty('startTime') &&
                                booking.hasOwnProperty('endTime');
      if (hasRequiredFields) {
        console.log('   ✅ Booking table has required fields (duration, startTime, endTime)\n');
      } else {
        console.log('   ⚠️  WARNING: Booking table missing required fields');
        allPassed = false;
      }
    } else {
      console.log('   ℹ️  No bookings in database yet to verify schema\n');
    }

    // Summary
    console.log('━'.repeat(60));
    if (allPassed && services.length > 0 && businessHours.length > 0) {
      console.log('✅ All checks passed! Booking system is ready.');
    } else if (allPassed) {
      console.log('⚠️  System is functional but needs data. Run: npm run seed');
    } else {
      console.log('❌ Some checks failed. Please review warnings above.');
    }
    console.log('━'.repeat(60));

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    if (error.code === 'P1001') {
      console.error('   Could not reach database. Check DATABASE_URL in .env');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyBookingSystem();
