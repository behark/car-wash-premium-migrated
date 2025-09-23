import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create admin user with secure password
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@kiiltoloisto.fi';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Admin',
      email: adminEmail,
      role: 'admin',
      passwordHash
    }
  });

  console.log('Admin user created:', adminEmail);

  // Create services with user-specified pricing
  const services = [
    {
      titleFi: 'Peruspesu',
      titleEn: 'Basic Wash',
      descriptionFi: 'Ulkopuolen perusteellinen pesu ja kuivaus',
      descriptionEn: 'Thorough exterior wash and dry',
      priceCents: 1500, // 15€
      durationMinutes: 45,
      capacity: 2,
      image: 'https://images.unsplash.com/photo-1542362567-b07e54358753?q=80&w=1200&auto=format&fit=crop',
      isActive: true,
    },
    {
      titleFi: 'Erikoispesu',
      titleEn: 'Special Wash',
      descriptionFi: 'Premium pesu sisältäen vahan ja renkaiden käsittelyn',
      descriptionEn: 'Premium wash including wax and tire treatment',
      priceCents: 2500, // 25€
      durationMinutes: 60,
      capacity: 2,
      image: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?q=80&w=1200&auto=format&fit=crop',
      isActive: true,
    },
    {
      titleFi: 'Vahapesu',
      titleEn: 'Wax Wash',
      descriptionFi: 'Täydellinen pesu premium-vahakäsittelyllä ja suojauksella',
      descriptionEn: 'Complete wash with premium wax treatment and protection',
      priceCents: 3500, // 35€
      durationMinutes: 90,
      capacity: 1,
      image: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?q=80&w=1200&auto=format&fit=crop',
      isActive: true,
    },
    {
      titleFi: 'Renkaan vaihto',
      titleEn: 'Tire Change',
      descriptionFi: 'Ammattitaitoinen renkaiden vaihto ja tasapainotus',
      descriptionEn: 'Professional tire change and balancing',
      priceCents: 4000, // 40€
      durationMinutes: 60,
      capacity: 2,
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=1200&auto=format&fit=crop',
      isActive: true,
    },
  ];

  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    await prisma.service.upsert({
      where: { id: i + 1 },
      update: service,
      create: { id: i + 1, ...service },
    });
  }

  console.log('Services created successfully');

  // Create business hours
  const businessHours = [
    { dayOfWeek: 0, startTime: '00:00', endTime: '00:00', isOpen: false }, // Sunday
    { dayOfWeek: 1, startTime: '08:00', endTime: '17:00', isOpen: true, breakStart: '12:00', breakEnd: '13:00' }, // Monday
    { dayOfWeek: 2, startTime: '08:00', endTime: '17:00', isOpen: true, breakStart: '12:00', breakEnd: '13:00' }, // Tuesday
    { dayOfWeek: 3, startTime: '08:00', endTime: '17:00', isOpen: true, breakStart: '12:00', breakEnd: '13:00' }, // Wednesday
    { dayOfWeek: 4, startTime: '08:00', endTime: '17:00', isOpen: true, breakStart: '12:00', breakEnd: '13:00' }, // Thursday
    { dayOfWeek: 5, startTime: '08:00', endTime: '17:00', isOpen: true, breakStart: '12:00', breakEnd: '13:00' }, // Friday
    { dayOfWeek: 6, startTime: '10:00', endTime: '16:00', isOpen: true }, // Saturday
  ];

  for (const hours of businessHours) {
    await prisma.businessHours.upsert({
      where: { dayOfWeek: hours.dayOfWeek },
      update: hours,
      create: hours,
    });
  }

  console.log('Business hours created successfully');

  // Create app settings
  const settings = [
    { key: 'booking_advance_days', value: '30' },
    { key: 'booking_cancellation_hours', value: '24' },
    { key: 'reminder_hours_before', value: '24' },
    { key: 'max_bookings_per_slot', value: '2' },
    { key: 'currency', value: 'EUR' },
    { key: 'timezone', value: 'Europe/Helsinki' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log('Settings created successfully');

  // Only seed testimonials in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: seeding sample testimonials...');
    const testimonialsData = [
      { name: 'Maija Mallikas', contentFi: 'Loistava palvelu!', contentEn: 'Great service!', rating: 5, approved: true },
      { name: 'Arto Auto', contentFi: 'Mukava ja nopea kokemus.', contentEn: 'Nice and quick experience.', rating: 4, approved: true },
      { name: 'Pekka P.', contentFi: 'Hyvät hinnat ja ystävällinen henkilökunta.', contentEn: 'Good prices and friendly staff.', rating: 5, approved: true }
    ];

    for (const t of testimonialsData) {
      await prisma.testimonial.create({
        data: t
      }).catch(() => {}); // Ignore if already exists
    }
  } else {
    console.log('Production mode: skipping sample testimonials');
  }

  console.log('Seeding finished.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });