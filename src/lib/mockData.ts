// Mock data for development (when database is not connected)
// Based on official PDF price list
export const mockServices = [
  // AUTOPESUT (Car Washes)
  {
    id: 1,
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
    id: 2,
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
    id: 3,
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
    id: 4,
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
    id: 5,
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
    id: 6,
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
    id: 7,
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
    id: 8,
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
    id: 9,
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
    id: 10,
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
    id: 11,
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
    id: 12,
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

export const mockTestimonials = [
  {
    id: 1,
    name: 'Matti M.',
    contentFi: 'Loistava palvelu! Auto näyttää uudelta.',
    contentEn: 'Excellent service! Car looks like new.',
    rating: 5,
    approved: true,
    createdAt: new Date('2025-01-15'),
  },
  {
    id: 2,
    name: 'Laura K.',
    contentFi: 'Ammattitaitoista työtä, suosittelen lämpimästi!',
    contentEn: 'Professional work, highly recommend!',
    rating: 5,
    approved: true,
    createdAt: new Date('2025-01-10'),
  },
  {
    id: 3,
    name: 'Jari P.',
    contentFi: 'Nopea ja huolellinen pesu. Hinta-laatusuhde kohdallaan.',
    contentEn: 'Fast and careful wash. Good value for money.',
    rating: 5,
    approved: true,
    createdAt: new Date('2025-01-05'),
  },
];
