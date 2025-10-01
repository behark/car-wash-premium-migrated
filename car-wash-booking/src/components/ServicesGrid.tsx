import Link from 'next/link';
import Image from 'next/image';

type Service = {
  id: number;
  titleFi: string;
  descriptionFi: string;
  priceCents: number;
  durationMinutes: number;
  image?: string;
};

// Professional service icons with consistent purple outline styling
const serviceIcons = {
  default: (
    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  wash: (
    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12l.01.01M12 12l.01.01M16 12l.01.01" />
    </svg>
  ),
  premium: (
    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  tire: (
    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="5" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2M12 19v2M21 12h-2M5 12H3M18.364 5.636l-1.414 1.414M7.05 16.95l-1.414 1.414M18.364 18.364l-1.414-1.414M7.05 7.05L5.636 5.636" />
    </svg>
  ),
  polish: (
    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  hotel: (
    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  ),
  engine: (
    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  odor: (
    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  interior: (
    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
};

// Function to get appropriate icon based on service title
const getServiceIcon = (title: string) => {
  const lowerTitle = title.toLowerCase();

  // Specific matches first
  if (lowerTitle.includes('kiillotus')) return serviceIcons.polish;
  if (lowerTitle.includes('hotel') || lowerTitle.includes('rengashotel')) return serviceIcons.hotel;
  if (lowerTitle.includes('moottor')) return serviceIcons.engine;
  if (lowerTitle.includes('hajun') || lowerTitle.includes('otsoni')) return serviceIcons.odor;
  if (lowerTitle.includes('sisäpuhdistus')) return serviceIcons.interior;
  if (lowerTitle.includes('kovavaha') || lowerTitle.includes('normaalivaha') || lowerTitle.includes('pikavaha')) return serviceIcons.premium;
  if (lowerTitle.includes('renkaiden') || lowerTitle.includes('pyök') || lowerTitle.includes('vaihto')) return serviceIcons.tire;
  if (lowerTitle.includes('pesu') || lowerTitle.includes('käsinpesu') || lowerTitle.includes('wash')) return serviceIcons.wash;

  return serviceIcons.default;
};

// Professional services with car wash business imagery
const mockServices = [
  {
    id: 1,
    titleFi: "Peruspesu",
    descriptionFi: "Perusteellinen auton ulko- ja sisäpuolen puhdistus. Sisältää pesun, kuivauksen ja peruspintojen puhdistuksen.",
    priceCents: 1500,
    durationMinutes: 45,
    image: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: 2,
    titleFi: "Erikoispesu",
    descriptionFi: "Erikoispesu vahauksen kanssa. Antaa autolle kestävän suojan ja upean kiillon, joka kestää pitkään.",
    priceCents: 2500,
    durationMinutes: 75,
    image: "https://images.unsplash.com/photo-1489824904134-891ab64532f1?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: 3,
    titleFi: "Renkaiden vaihto & säilytys",
    descriptionFi: "Ammattitaitoinen renkaiden vaihto kausittain ja turvallinen säilytyspalvelu. Helppo nouto ja palautus.",
    priceCents: 4000,
    durationMinutes: 45,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=600&auto=format&fit=crop"
  }
];

export default function ServicesGrid({ services }: { services: Service[] }) {
  // Use mock services if no real services are provided
  const displayServices = services.length > 0 ? services : mockServices;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {displayServices.map((service, index) => (
        <div
          key={service.id}
          className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 premium-card overflow-hidden animate-fade-in"
          style={{ animationDelay: `${index * 150}ms` }}
        >
          {/* Premium Badge for expensive services */}
          {service.priceCents >= 5000 && (
            <div className="absolute top-4 right-4 z-10 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
              LUXURY
            </div>
          )}

          {/* Service Image */}
          <div className="relative h-48 overflow-hidden">
            <Image
              src={service.image || `/images/service${service.id}.svg`}
              alt={service.titleFi}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover aspect-[16/9] group-hover:scale-105 group-hover:brightness-110 transition-all duration-500"
              priority={index < 4}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent group-hover:from-purple-900/30 group-hover:via-purple-600/10 group-hover:to-transparent transition-all duration-500"></div>
          </div>

          {/* Service Content */}
          <div className="p-6">
            <h3 className="font-display text-xl font-bold text-navy-900 mb-3 group-hover:text-purple-600 transition-colors">
              {service.titleFi}
            </h3>

            <p className="text-slate-600 text-sm mb-4 line-clamp-2 leading-relaxed">
              {service.descriptionFi}
            </p>

            {/* Price and CTA */}
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-sm text-slate-500 mb-1">Alkaen</div>
                <div className="text-2xl font-bold text-purple-600">
                  {(service.priceCents / 100).toFixed(0)}€
                </div>
              </div>

              <Link
                href={`/services/${service.id}`}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Varaa nyt
              </Link>
            </div>

            {/* Guarantee Badge */}
            <div className="mt-4 pt-4 border-t border-silver-100">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>100% Tyytyväisyystakuu</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}