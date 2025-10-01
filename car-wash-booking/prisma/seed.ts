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

  // Create services based on official price list
  const services = [
    // AUTOPESUT (Car Washes)
    {
      titleFi: 'Käsinpesu',
      titleEn: 'Hand Wash',
      descriptionFi: 'Huolellinen käsinpesu, joka palauttaa autosi pinnan raikkauden.',
      descriptionEn: 'Careful hand wash that restores your car\'s surface freshness.',
      priceCents: 2500, // 25€
      durationMinutes: 30,
      capacity: 2,
      image: '/images/service-kasinpesu.svg',
      isActive: true,
    },
    {
      titleFi: 'Käsinpesu + Pikavaha',
      titleEn: 'Hand Wash + Quick Wax',
      descriptionFi: 'Kevyt vaha antaa upean kiillon ja suojaa autoasi heti pesun jälkeen.',
      descriptionEn: 'Light wax gives great shine and protects your car right after washing.',
      priceCents: 3000, // 30€
      durationMinutes: 40,
      capacity: 2,
      image: '/images/service-pikavaha.svg',
      isActive: true,
    },
    {
      titleFi: 'Käsinpesu + Sisäpuhdistus',
      titleEn: 'Hand Wash + Interior Cleaning',
      descriptionFi: 'Kokonaisvaltainen puhdistus: matot, imurointi, ikkunat ja pölyjen poisto.',
      descriptionEn: 'Comprehensive cleaning: carpets, vacuuming, windows and dust removal.',
      priceCents: 5500, // 55€
      durationMinutes: 60,
      capacity: 2,
      image: '/images/service-sisapuhdistus.svg',
      isActive: true,
    },
    {
      titleFi: 'Käsinpesu + Normaalivaha',
      titleEn: 'Hand Wash + Normal Wax',
      descriptionFi: 'Vahapinnoite, joka säilyttää kiillon ja suojan jopa 2–3 kuukauden ajan.',
      descriptionEn: 'Wax coating that maintains shine and protection for 2-3 months.',
      priceCents: 7000, // 70€
      durationMinutes: 90,
      capacity: 2,
      image: '/images/service-normaalivaha.svg',
      isActive: true,
    },
    {
      titleFi: 'Käsinpesu + Kovavaha',
      titleEn: 'Hand Wash + Hard Wax',
      descriptionFi: 'Pitkäkestoinen 6 kk suoja ja upea kiilto kovavahauksella.',
      descriptionEn: 'Long-lasting 6-month protection and great shine with hard wax.',
      priceCents: 11000, // 110€
      durationMinutes: 120,
      capacity: 1,
      image: '/images/service-kovavaha.svg',
      isActive: true,
    },
    {
      titleFi: 'Maalipinnan Kiillotus',
      titleEn: 'Paint Surface Polishing',
      descriptionFi: '3 step kiillotus sekä käsinvahaus. Henkilöauto 350€, Maasturi 400€, Pakettiauto 450€.',
      descriptionEn: '3-step polishing with hand waxing. Car 350€, SUV 400€, Van 450€.',
      priceCents: 35000, // 350€
      durationMinutes: 240,
      capacity: 1,
      image: '/images/service-kiillotus.svg',
      isActive: true,
    },
    // RENKAAT (Tires)
    {
      titleFi: 'Renkaiden Vaihto',
      titleEn: 'Tire Change',
      descriptionFi: 'Turvallisuutta ja varmuutta ajoon – renkaiden allevaihto ja paineiden tarkistus.',
      descriptionEn: 'Safety and reliability for driving - tire change and pressure check.',
      priceCents: 2000, // 20€
      durationMinutes: 30,
      capacity: 2,
      image: '/images/service-renkaiden-vaihto.svg',
      isActive: true,
    },
    {
      titleFi: 'Renkaiden Pesu',
      titleEn: 'Tire Wash',
      descriptionFi: 'Puhtaat renkaat ja vanteet sekä sisältä että ulkoa.',
      descriptionEn: 'Clean tires and rims both inside and outside.',
      priceCents: 1000, // 10€
      durationMinutes: 20,
      capacity: 2,
      image: '/images/service-renkaiden-pesu.svg',
      isActive: true,
    },
    {
      titleFi: 'Rengashotelli',
      titleEn: 'Tire Hotel',
      descriptionFi: 'Helppoutta ja tilansäästöä – kausisäilytys keväästä syksyyn tai syksystä kevääseen.',
      descriptionEn: 'Convenience and space saving - seasonal storage from spring to autumn or autumn to spring.',
      priceCents: 6900, // 69€
      durationMinutes: 15,
      capacity: 4,
      image: '/images/service-rengashotelli.svg',
      isActive: true,
    },
    // LISÄPALVELUT (Additional Services)
    {
      titleFi: 'Moottorin Pesu',
      titleEn: 'Engine Wash',
      descriptionFi: 'Puhdas moottoritila – aina asiakkaan omalla vastuulla.',
      descriptionEn: 'Clean engine bay - always at customer\'s own responsibility.',
      priceCents: 2000, // 20€
      durationMinutes: 30,
      capacity: 2,
      image: '/images/service-moottorin-pesu.svg',
      isActive: true,
    },
    {
      titleFi: 'Hajunpoisto Otsonoinnilla',
      titleEn: 'Odor Removal with Ozone',
      descriptionFi: 'Raikas sisäilma – tehokas otsonointi poistaa epämiellyttävät hajut.',
      descriptionEn: 'Fresh interior air - effective ozone treatment removes unpleasant odors.',
      priceCents: 5000, // 50€
      durationMinutes: 60,
      capacity: 1,
      image: '/images/service-hajunpoisto.svg',
      isActive: true,
    },
    {
      titleFi: 'Penkkien Pesu',
      titleEn: 'Seat Wash',
      descriptionFi: 'Syväpuhdistetut penkit – kemiallinen märkäpesu palauttaa raikkauden.',
      descriptionEn: 'Deep cleaned seats - chemical wet wash restores freshness.',
      priceCents: 10000, // 100€
      durationMinutes: 90,
      capacity: 1,
      image: '/images/service-penkkien-pesu.svg',
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