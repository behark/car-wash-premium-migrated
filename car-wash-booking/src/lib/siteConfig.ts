export const siteConfig = {
  name: 'Autopesu Kiilto & Loisto',
  shortName: 'Kiilto & Loisto',
  tagline: 'PERUS- & ERIKOISPESUT RENKAIDEN VAIHTO & SÄILYTYS',
  subtitle: 'Ammattitaitoista autopesupalvelua Helsingissä',
  siteUrl: 'https://www.kiiltoloisto.fi',
  heroImage: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?q=80&w=2000&auto=format&fit=crop', // Professional car wash in action
  heroVideo: 'https://videos.pexels.com/video-files/3006792/3006792-uhd_2560_1440_30fps.mp4', // Professional car wash video
  phone: {
    display: '044 960 8148',
    tel: '+358449608148',
  },
  address: {
    street: 'Läkkisepäntie 15',
    city: 'Helsinki',
    postalCode: '00620',
    country: 'Suomi',
    mapsQuery: 'Läkkisepäntie 15, 00620 Helsinki, Finland',
  },
  hours: [
    { label: 'MA-PE', value: '08:00-18:00' },
    { label: 'LA', value: '10:00-16:00' },
    { label: 'SU', value: 'Suljettu' },
  ],
  email: 'Info@kiiltoloisto.fi',
  emailFrom: 'Info@kiiltoloisto.fi',
  social: {
    facebook: 'https://www.facebook.com/profile.php?id=61581129804372',
    instagram: 'https://www.instagram.com/kiiltoloisto/'
  },
  logoPath: '/images/kiilto-loisto-logo.jpeg',
  brandColor: 'bg-gradient-to-r from-navy-900 to-navy-700',
  features: {
    rating: '4.9',
    customers: '500+',
    years: '15+',
    guarantee: '100% Tyytyväisyystakuu'
  },
  certifications: [
    'Sertifioitu Detailing',
    'Luksusautojen Asiantuntija',
    'Ympäristöystävällinen',
    'Vakuutettu ja Bonded'
  ],
  premiumServices: [
    'Hand Wash & Detail',
    'Paint Protection Film',
    'Ceramic Coating',
    'Interior Luxury Clean'
  ]
};

export type SiteConfig = typeof siteConfig;
