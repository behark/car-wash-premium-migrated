/**
 * Database Seeding Script
 * Creates initial data for testing the real-time booking system
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create services
  const services = await Promise.all([
    prisma.service.create({
      data: {
        titleFi: 'Peruspesu',
        titleEn: 'Basic Wash',
        descriptionFi: 'Ulkopuolinen pesu ja kuivaus',
        descriptionEn: 'Exterior wash and dry',
        priceCents: 2500, // €25.00
        durationMinutes: 30,
        capacity: 2,
        image: '/images/basic-wash.jpg',
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        titleFi: 'Premium-pesu',
        titleEn: 'Premium Wash',
        descriptionFi: 'Sisä- ja ulkopuolinen pesu, vahaus',
        descriptionEn: 'Interior and exterior wash with wax',
        priceCents: 4500, // €45.00
        durationMinutes: 60,
        capacity: 1,
        image: '/images/premium-wash.jpg',
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        titleFi: 'Täysi kiillotus',
        titleEn: 'Full Detail',
        descriptionFi: 'Täydellinen sisä- ja ulkopuolinen kiillotus',
        descriptionEn: 'Complete interior and exterior detailing',
        priceCents: 8500, // €85.00
        durationMinutes: 120,
        capacity: 1,
        image: '/images/full-detail.jpg',
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Services created:', services.length);

  // Create wash bays
  const washBays = await Promise.all([
    prisma.washBay.create({
      data: {
        name: 'Bay 1 - Express',
        bayNumber: 1,
        minCapacity: 1,
        maxCapacity: 2,
        shape: 'rectangular',
        isEnabled: true,
        location: 'Front area',
        notes: 'Quick service bay for basic washes',
      },
    }),
    prisma.washBay.create({
      data: {
        name: 'Bay 2 - Premium',
        bayNumber: 2,
        minCapacity: 1,
        maxCapacity: 3,
        shape: 'rectangular',
        isEnabled: true,
        location: 'Middle area',
        notes: 'Full-service bay with detailing station',
      },
    }),
    prisma.washBay.create({
      data: {
        name: 'Bay 3 - Detail',
        bayNumber: 3,
        minCapacity: 1,
        maxCapacity: 1,
        shape: 'rectangular',
        isEnabled: true,
        location: 'Back area',
        notes: 'Specialized detailing bay',
      },
    }),
  ]);

  console.log('✅ Wash bays created:', washBays.length);

  // Create staff members
  const staff = await Promise.all([
    prisma.staff.create({
      data: {
        name: 'Mikko Virtanen',
        email: 'mikko@kiiltoloisto.fi',
        phone: '+358 50 123 4567',
        role: 'MANAGER',
        isActive: true,
        specialties: JSON.stringify(['basic_wash', 'premium_wash', 'detailing']),
      },
    }),
    prisma.staff.create({
      data: {
        name: 'Anna Koskinen',
        email: 'anna@kiiltoloisto.fi',
        phone: '+358 50 234 5678',
        role: 'SUPERVISOR',
        isActive: true,
        specialties: JSON.stringify(['premium_wash', 'detailing']),
      },
    }),
    prisma.staff.create({
      data: {
        name: 'Jukka Nieminen',
        email: 'jukka@kiiltoloisto.fi',
        phone: '+358 50 345 6789',
        role: 'OPERATOR',
        isActive: true,
        specialties: JSON.stringify(['basic_wash', 'premium_wash']),
      },
    }),
  ]);

  console.log('✅ Staff created:', staff.length);

  // Create business hours (Monday to Friday 8-18, Saturday 9-16, Sunday closed)
  const businessHours = await Promise.all([
    // Monday (0) to Friday (4)
    ...Array.from({ length: 5 }, (_, i) =>
      prisma.businessHours.create({
        data: {
          dayOfWeek: i + 1, // 1 = Monday, 5 = Friday
          startTime: '08:00',
          endTime: '18:00',
          isOpen: true,
          breakStart: '12:00',
          breakEnd: '13:00',
        },
      })
    ),
    // Saturday (6)
    prisma.businessHours.create({
      data: {
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '16:00',
        isOpen: true,
      },
    }),
    // Sunday (0)
    prisma.businessHours.create({
      data: {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '00:00',
        isOpen: false,
      },
    }),
  ]);

  console.log('✅ Business hours created:', businessHours.length);

  // Create time slots for the next 7 days
  const today = new Date();
  const timeSlots = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);

    // Skip Sundays (business is closed)
    if (date.getDay() === 0) continue;

    // Determine business hours for this day
    const dayOfWeek = date.getDay();
    const startHour = dayOfWeek === 6 ? 9 : 8; // Saturday starts at 9, others at 8
    const endHour = dayOfWeek === 6 ? 16 : 18; // Saturday ends at 16, others at 18

    // Create time slots every 30 minutes
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        // Skip lunch break (12:00-13:00) on weekdays
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour === 12) continue;

        const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const endTime = minute === 30
          ? `${(hour + 1).toString().padStart(2, '0')}:00`
          : `${hour.toString().padStart(2, '0')}:30`;

        timeSlots.push({
          date,
          startTime,
          endTime,
          isAvailable: true,
          maxCapacity: 3, // Total capacity across all bays
          currentBookings: 0,
          isHoliday: false,
        });
      }
    }
  }

  await prisma.timeSlot.createMany({
    data: timeSlots,
  });

  console.log('✅ Time slots created:', timeSlots.length);

  // Create some sample customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: 'Pekka Virtanen',
        email: 'pekka.virtanen@example.com',
        phone: '+358 40 123 4567',
        loyaltyPoints: 250,
        totalSpent: 12000, // €120.00
        visitCount: 5,
        loyaltyTier: 'SILVER',
        preferredServices: JSON.stringify([1, 2]),
        notes: 'Prefers morning appointments',
        isActive: true,
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Maria Koskinen',
        email: 'maria.koskinen@example.com',
        phone: '+358 45 234 5678',
        loyaltyPoints: 500,
        totalSpent: 25000, // €250.00
        visitCount: 12,
        loyaltyTier: 'GOLD',
        preferredServices: JSON.stringify([2, 3]),
        notes: 'VIP customer, detail services preferred',
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Customers created:', customers.length);

  // Create some sample bookings for tomorrow
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const sampleBookings = await Promise.all([
    prisma.booking.create({
      data: {
        serviceId: services[0].id,
        vehicleType: 'sedan',
        date: tomorrow,
        startTime: '09:00',
        endTime: '09:30',
        duration: 30,
        priceCents: services[0].priceCents,
        status: 'CONFIRMED',
        customerName: customers[0].name,
        customerEmail: customers[0].email,
        customerPhone: customers[0].phone!,
        customerId: customers[0].id,
        paymentStatus: 'PAID',
        confirmationCode: 'CW2024001',
        assignedStaffId: staff[0].id,
        assignedBayId: washBays[0].id,
        licensePlate: 'ABC-123',
        guestCount: 1,
      },
    }),
    prisma.booking.create({
      data: {
        serviceId: services[1].id,
        vehicleType: 'suv',
        date: tomorrow,
        startTime: '10:00',
        endTime: '11:00',
        duration: 60,
        priceCents: services[1].priceCents,
        status: 'CONFIRMED',
        customerName: customers[1].name,
        customerEmail: customers[1].email,
        customerPhone: customers[1].phone!,
        customerId: customers[1].id,
        paymentStatus: 'PAID',
        confirmationCode: 'CW2024002',
        assignedStaffId: staff[1].id,
        assignedBayId: washBays[1].id,
        licensePlate: 'XYZ-789',
        guestCount: 1,
      },
    }),
  ]);

  console.log('✅ Sample bookings created:', sampleBookings.length);

  // Create notification templates
  const notificationTemplates = await Promise.all([
    prisma.notificationTemplate.create({
      data: {
        type: 'BOOKING_CONFIRMATION',
        titleFi: 'Varaus vahvistettu',
        titleEn: 'Booking Confirmed',
        bodyFi: 'Varauksesi {{date}} klo {{time}} on vahvistettu. Varausnumero: {{confirmationCode}}',
        bodyEn: 'Your booking for {{date}} at {{time}} has been confirmed. Confirmation code: {{confirmationCode}}',
        icon: '/icons/check-circle.png',
        isActive: true,
      },
    }),
    prisma.notificationTemplate.create({
      data: {
        type: 'BOOKING_REMINDER',
        titleFi: 'Muistutus varauksesta',
        titleEn: 'Booking Reminder',
        bodyFi: 'Muistutus: Varauksesi {{service}} on huomenna {{date}} klo {{time}}',
        bodyEn: 'Reminder: Your {{service}} booking is tomorrow {{date}} at {{time}}',
        icon: '/icons/clock.png',
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Notification templates created:', notificationTemplates.length);

  // Create booking configuration
  await prisma.bookingConfiguration.create({
    data: {
      key: 'default',
      intervalMinutes: 30,
      leadTimeHours: 2,
      maxAdvanceDays: 30,
      cancellationDeadlineHours: 24,
      allowCustomerCancellation: true,
      defaultBayCapacity: 1,
      enableAutoBayAssignment: true,
      autoConfirmBookings: false,
      requirePaymentUpfront: true,
      sendReminderHours: 24,
      enableSmsNotifications: true,
      enablePushNotifications: true,
      value: JSON.stringify({
        workingHours: {
          start: '08:00',
          end: '18:00',
          saturday: { start: '09:00', end: '16:00' },
          sunday: { closed: true }
        },
        pricing: {
          cancellationFee: 500, // €5.00
          lateFee: 1000, // €10.00
        }
      }),
    },
  });

  console.log('✅ Booking configuration created');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   • ${services.length} services`);
  console.log(`   • ${washBays.length} wash bays`);
  console.log(`   • ${staff.length} staff members`);
  console.log(`   • ${businessHours.length} business hour configurations`);
  console.log(`   • ${timeSlots.length} time slots for the next 7 days`);
  console.log(`   • ${customers.length} sample customers`);
  console.log(`   • ${sampleBookings.length} sample bookings`);
  console.log(`   • ${notificationTemplates.length} notification templates`);
  console.log(`   • 1 booking configuration`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });