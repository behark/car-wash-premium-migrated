// ...existing code...
import Footer from '../components/Footer';
import Header from '../components/Header';
import SEO from '../components/SEO';
import { siteConfig } from '../lib/siteConfig';

export default function Contact() {
  return (
    <>
      <SEO
        title={`Yhteystiedot - ${siteConfig.name}`}
        description={`Ota yhteyttä ${siteConfig.name} - osoite, puhelinnumero, sähköposti ja aukioloajat.`}
      />
      <Header />
      <main className="bg-gray-50 min-h-screen">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Yhteystiedot
            </h1>
            <p className="text-xl text-purple-100">
              Ota yhteyttä! Autamme mielellämme kaikissa kysymyksissä.
            </p>
          </div>
        </div>
        
        <section className="container mx-auto px-4 py-16">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold mb-6">Yhteystiedot</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-purple-50 p-2 rounded-lg border border-purple-200">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">Osoite</h3>
                    <p className="text-gray-600">
                      {siteConfig.address.street}<br />
                      {siteConfig.address.postalCode} {siteConfig.address.city}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="bg-purple-50 p-2 rounded-lg border border-purple-200">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">Puhelinnumero</h3>
                    <p className="text-gray-600">{siteConfig.phone.display}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="bg-purple-50 p-2 rounded-lg border border-purple-200">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">Sähköposti</h3>
                    <p className="text-gray-600">{siteConfig.email}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="bg-purple-50 p-2 rounded-lg border border-purple-200">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">Aukioloajat</h3>
                    <div className="text-gray-600">
                      {siteConfig.hours.map((h) => (
                        <p key={h.label}>{h.label}: {h.value}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h2 className="text-2xl font-bold mb-4">Seuraa meitä</h2>
                <div className="flex space-x-4">
                  <a href={siteConfig.social.facebook} className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M20 10C20 4.477 15.523 0 10 0S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a href={siteConfig.social.instagram} className="bg-pink-600 hover:bg-pink-700 text-white p-3 rounded-lg">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2.22c-4.1 0-4.6.02-6.2.09-1.6.07-2.7.34-3.7.72-.9.36-1.7.85-2.5 1.63-.78.78-1.27 1.56-1.63 2.5-.38 1-.65 2.1-.72 3.7-.07 1.6-.09 2.1-.09 6.2s.02 4.6.09 6.2c.07 1.6.34 2.7.72 3.7.36.9.85 1.7 1.63 2.5.78.78 1.56 1.27 2.5 1.63 1 .38 2.1.65 3.7.72 1.6.07 2.1.09 6.2.09s4.6-.02 6.2-.09c1.6-.07 2.7-.34 3.7-.72.9-.36 1.7-.85 2.5-1.63.78-.78 1.27-1.56 1.63-2.5.38-1 .65-2.1.72-3.7.07-1.6.09-2.1.09-6.2s-.02-4.6-.09-6.2c-.07-1.6-.34-2.7-.72-3.7-.36-.9-.85-1.7-1.63-2.5-.78-.78-1.56-1.27-2.5-1.63-1-.38-2.1-.65-3.7-.72-1.6-.07-2.1-.09-6.2-.09zm0 1.62c4.03 0 4.51.02 6.1.09 1.47.07 2.27.32 2.8.53.7.27 1.2.6 1.73 1.13.53.53.86 1.03 1.13 1.73.21.53.46 1.33.53 2.8.07 1.59.09 2.07.09 6.1s-.02 4.51-.09 6.1c-.07 1.47-.32 2.27-.53 2.8-.27.7-.6 1.2-1.13 1.73-.53.53-1.03.86-1.73 1.13-.53.21-1.33.46-2.8.53-1.59.07-2.07.09-6.1.09s-4.51-.02-6.1-.09c-1.47-.07-2.27-.32-2.8-.53-.7-.27-1.2-.6-1.73-1.13-.53-.53-.86-1.03-1.13-1.73-.21-.53-.46-1.33-.53-2.8-.07-1.59-.09-2.07-.09-6.1s.02-4.51.09-6.1c.07-1.47.32-2.27.53-2.8.27-.7.6-1.2 1.13-1.73.53-.53 1.03-.86 1.73-1.13.53-.21 1.33-.46 2.8-.53 1.59-.07 2.07-.09 6.1-.09z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M10 13.33a3.33 3.33 0 100-6.66 3.33 3.33 0 000 6.66zm0-8.48a5.15 5.15 0 110 10.3 5.15 5.15 0 010-10.3zm6.55-.18a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z" clipRule="evenodd" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-6">Sijainti kartalla</h2>
              <div className="bg-gray-200 rounded-lg h-96 overflow-hidden relative">
                <iframe
                  title={`${siteConfig.name} sijainti`}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  style={{ border: 0 }}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(siteConfig.address.mapsQuery)}&hl=fi&z=15&output=embed`}
                  allowFullScreen
                  className="rounded-lg"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="absolute bottom-4 right-4">
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(siteConfig.address.mapsQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white hover:bg-gray-50 shadow-lg rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    Avaa Google Mapsissa
                  </a>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Helppo saavutettavuus julkisilla kulkuneuvoilla ja ilmainen pysäköinti.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-8">Kysy lisää</h2>
              <p className="text-lg text-gray-600 mb-8">
                Eikö löytynyt vastausta kysymykseesi? Ota rohkeasti yhteyttä, 
                niin autamme sinua parhaalla mahdollisella tavalla.
              </p>
              <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
                <a 
                  href={`tel:${siteConfig.phone.tel}`}
                  className="block sm:inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Soita meille
                </a>
                <a 
                  href={`mailto:${siteConfig.email}`}
                  className="block sm:inline-block bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Lähetä sähköpostia
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}