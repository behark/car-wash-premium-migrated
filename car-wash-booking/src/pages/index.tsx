// ...existing code...
import Link from 'next/link';
import Footer from '../components/Footer';
import Header from '../components/Header';
import Hero from '../components/Hero';
import SEO from '../components/SEO';
import ServicesGrid from '../components/ServicesGrid';
import BeforeAfterGallery from '../components/BeforeAfterGallery';
import TestimonialForm from '../components/TestimonialForm';
import TestimonialsList from '../components/TestimonialsList';
import FloatingContact from '../components/FloatingContact';
import { siteConfig } from '../lib/siteConfig';

type Props = {
  services: any[];
  testimonials: any[];
};

export default function Home({ services = [], testimonials = [] }: Props) {
  return (
    <>
      <SEO
        title={siteConfig.tagline}
        description={siteConfig.tagline}
        image={siteConfig.heroImage}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            'name': siteConfig.name,
            'image': siteConfig.heroImage,
            'telephone': siteConfig.phone.tel,
            'address': {
              '@type': 'PostalAddress',
              'streetAddress': siteConfig.address.street,
              'addressLocality': siteConfig.address.city,
              'postalCode': siteConfig.address.postalCode,
              'addressCountry': siteConfig.address.country
            },
            'url': siteConfig.siteUrl,
            'openingHoursSpecification': siteConfig.hours.filter(h => h.value && h.value !== 'Suljettu').map(h => ({
              '@type': 'OpeningHoursSpecification',
              'dayOfWeek': 'Monday',
              'opens': h.value.split('–')[0],
              'closes': h.value.split('–')[1]
            }))
          }
        ]}
      />
      <Header />
      <Hero />
      <main className="bg-slate-50">
        {/* Trust Badges Section */}
        <section className="py-12 bg-white border-b border-silver-100">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {siteConfig.certifications.map((cert, index) => (
                <div key={index} className="flex flex-col items-center space-y-2 animate-fade-in" style={{animationDelay: `${index * 100}ms`}}>
                  <div className="w-12 h-12 bg-gold-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">{cert}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 animate-fade-in">
              <div className="inline-flex items-center bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                🚗 Premium Luxury palvelut
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-navy-900 mb-6">
                Premium Autopesupalvelumme
              </h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                Tarjoamme kattavan valikoiman yksinomaisia premium autopesupalveluita, jotka antavat luksusautollesi ansaitsemansa huippuluokan hoidon ja suojan.
              </p>
            </div>

            <ServicesGrid services={services} />

            <div className="text-center mt-12 animate-fade-in">
              <Link
                href="/services"
                className="inline-flex items-center bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl group"
              >
                Tutustu premium palveluihimme
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* Before/After Gallery Section */}
        <BeforeAfterGallery />

        {/* Features Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 animate-fade-in">
              <h2 className="font-display text-4xl md:text-5xl font-bold text-navy-900 mb-6">
                Miksi valita premium palvelumme?
              </h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                Olemme sitoutuneet tarjoamaan parasta mahdollista luxury-luokan palvelua jokaiselle luksusauton omistajalle.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="text-center group animate-fade-in">
                <div className="w-20 h-20 bg-purple-50 border-2 border-purple-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:border-purple-400 transition-all duration-300 shadow-lg">
                  <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-navy-900 mb-4">Premium nopea palvelu</h3>
                <p className="text-slate-600 leading-relaxed">Huippuluokan tehokas palvelu ilman luxury-laatutason tinkimistä. Useimmat premium palvelut alle tunnissa.</p>
              </div>

              <div className="text-center group animate-fade-in animation-delay-200">
                <div className="w-20 h-20 bg-purple-50 border-2 border-purple-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:border-purple-400 transition-all duration-300 shadow-lg">
                  <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-navy-900 mb-4">Premium laaduntakuu</h3>
                <p className="text-slate-600 leading-relaxed">Emme ole tyytyväisiä ennen kuin sinä olet täysin vaikuttunut. {siteConfig.features.guarantee} kaikille luxury-palveluille.</p>
              </div>

              <div className="text-center group animate-fade-in animation-delay-500">
                <div className="w-20 h-20 bg-purple-50 border-2 border-purple-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:border-purple-400 transition-all duration-300 shadow-lg">
                  <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-navy-900 mb-4">Ympäristöystävällinen premium</h3>
                <p className="text-slate-600 leading-relaxed">Käytämme yksinomaan premium ympäristöystävällisiä pesuaineita ja kierrätämme pesuvettä vastuullisesti.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 animate-fade-in">
              <div className="inline-flex items-center bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                ⭐ Premium asiakaskokemukset
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-navy-900 mb-6">
                Mitä luksusauton omistajat sanovat
              </h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                Yli {siteConfig.features.customers} tyytyväistä premium asiakasta - lue heidän kokemuksiaan huippuluokan palvelustamme.
              </p>
            </div>

            <TestimonialsList testimonials={testimonials} />

            <div className="text-center mt-12 animate-fade-in">
              <Link
                href="/testimonials"
                className="inline-flex items-center text-gold-600 hover:text-gold-700 font-semibold transition-colors group"
              >
                Lue lisää premium arvosteluja
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            <div className="max-w-2xl mx-auto mt-16">
              <TestimonialForm />
            </div>
          </div>
        </section>

        {/* Premium CTA Section */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700"></div>
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=1920&auto=format&fit=crop')] bg-cover bg-center opacity-15"></div>

          <div className="relative container mx-auto px-4 text-center">
            <div className="max-w-4xl mx-auto animate-fade-in">
              <div className="inline-flex items-center bg-purple-500/20 backdrop-blur-sm border border-purple-400/30 rounded-full px-6 py-2 mb-8">
                <span className="text-purple-300 text-sm font-medium">
                  🚗 Varaa premium aika nyt ja säästä aikaa
                </span>
              </div>

              <h2 className="font-display text-4xl md:text-6xl font-bold text-white mb-6">
                Valmis antamaan luksusautollesi
                <span className="block bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">
                  ansaitsemansa premium hoidon?
                </span>
              </h2>

              <p className="text-xl md:text-2xl text-silver-200 mb-8 max-w-3xl mx-auto">
                Helppo premium online-varaus, sertifioitu ammattitaitoinen palvelu, ja {siteConfig.features.guarantee}.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href="/booking"
                  className="group relative bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl"
                >
                  <span className="relative z-10">Varaa premium aika nyt</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-gold-400 to-gold-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </Link>

                <Link
                  href="/services"
                  className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 hover:border-gold-400/50"
                >
                  Katso premium hinnat
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-white/20">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gold-400 mb-2">{siteConfig.features.rating}</div>
                  <div className="text-sm text-silver-300">⭐ Premium keskiarvo</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gold-400 mb-2">{siteConfig.features.customers}</div>
                  <div className="text-sm text-silver-300">Tyytyväistä premium asiakasta</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gold-400 mb-2">{siteConfig.features.years}</div>
                  <div className="text-sm text-silver-300">Vuotta luxury kokemusta</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <FloatingContact />
    </>
  );
}

// Temporarily disabled for static export
// export const getServerSideProps: GetServerSideProps = async () => {
//   try {
//     const services = await prisma.service.findMany({
//       where: { isActive: true },
//       take: 4,
//       orderBy: { createdAt: 'asc' }
//     });

//     const testimonials = await prisma.testimonial.findMany({
//       where: { approved: true },
//       take: 6,
//       orderBy: { createdAt: 'desc' }
//     });

//     return {
//       props: {
//         services: JSON.parse(JSON.stringify(services)),
//         testimonials: JSON.parse(JSON.stringify(testimonials))
//       }
//     };
//   } catch (err) {
//     console.error('[getStaticProps] Failed to load data for index page:', err);
//     return {
//       props: { services: [], testimonials: [] }
//     };
//   }
// };