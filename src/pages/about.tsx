// ...existing code...
import Image from 'next/image';
import Link from 'next/link';
import Footer from '../components/Footer';
import Header from '../components/Header';
import SEO from '../components/SEO';
import { siteConfig } from '../lib/siteConfig';

export default function About() {
  return (
    <>
      <SEO
        title={`Meistä - ${siteConfig.name}`}
        description={`Tutustu ${siteConfig.name} – ${siteConfig.tagline}.`}
        image={siteConfig.heroImage}
      />
      <Header />
      <main className="bg-gray-50 min-h-screen">
        <div className="bg-purple-600 py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Meistä
            </h1>
            <p className="text-xl text-purple-100">
              Autosi ansaitsee parhaan mahdollisen hoidon
            </p>
          </div>
        </div>
        
        <section className="container mx-auto px-4 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Tarinamme</h2>
              <p className="text-lg text-gray-600 mb-4">
                {siteConfig.shortName} perustettiin tarpeesta tarjota 
                alueelle todella korkealaatuisia autopesupalveluja. 
                Yrityksemme syntyi intohimosta autojen hoitoon ja asiakaspalveluun.
              </p>
              <p className="text-lg text-gray-600 mb-4">
                Käytämme ainoastaan ympäristöystävällisiä pesuaineita ja 
                huippuluokan laitteistoa varmistaaksemme, että autosi saa 
                parhaan mahdollisen hoidon joka kerta.
              </p>
              <p className="text-lg text-gray-600">
                Tiimimme koostuu ammattitaitoisista autojen hoitoalan 
                ammattilaisista, jotka jakavat saman intohimon 
                täydellisiin tuloksiin.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="relative w-full h-64 mb-6">
                <Image
                  src="https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=800&auto=format&fit=crop"
                  alt={`${siteConfig.shortName} tiimi työssä`}
                  fill
                  sizes="100vw"
                  className="object-cover rounded-lg"
                  priority={false}
                />
              </div>
              <h3 className="text-xl font-bold mb-2">Miksi valita meidät?</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Yli 3 vuoden kokemus
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Ympäristöystävälliset tuotteet
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Ammattitaitoinen henkilökunta
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Tyytyväisyystakuu
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Arvomme</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Laatu</h3>
                <p className="text-gray-600">
                  Emme tee kompromisseja laadun suhteen. Jokainen auto pesään 
                  samalla huolellisuudella riippumatta palvelun hinnasta.
                </p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Nopeus</h3>
                <p className="text-gray-600">
                  Ymmärrämme, että aikasi on arvokasta. Tarjoamme nopeaa 
                  palvelua ilman tinkimistä lopputuloksesta.
                </p>
              </div>
              <div className="text-center">
                <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Asiakaspalvelu</h3>
                <p className="text-gray-600">
                  Asiakkaamme ovat meille tärkein prioriteetti. Palvelemme 
                  ystävällisesti ja ammattitaitoisesti joka tilanteessa.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gray-100 py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Tiimimme</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="relative w-32 h-32 rounded-full overflow-hidden mx-auto mb-4">
                  <Image src="/images/service1.jpg" alt="Matti Virtanen" fill className="object-cover" />
                </div>
                <h3 className="text-xl font-bold mb-2">Matti Virtanen</h3>
                <p className="text-purple-600 font-semibold mb-2">Toimitusjohtaja & Perustaja</p>
                <p className="text-gray-600 text-sm">
                  15 vuoden kokemus autoalalta. Intohimoinen autojen 
                  hoidosta ja asiakaspalvelusta.
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="relative w-32 h-32 rounded-full overflow-hidden mx-auto mb-4">
                  <Image src="/images/service2.jpg" alt="Anna Korhonen" fill className="object-cover" />
                </div>
                <h3 className="text-xl font-bold mb-2">Anna Korhonen</h3>
                <p className="text-purple-600 font-semibold mb-2">Palvelupäällikkö</p>
                <p className="text-gray-600 text-sm">
                  Varmistaa, että jokainen asiakas saa parhaan mahdollisen 
                  palvelukokemuksen.
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="relative w-32 h-32 rounded-full overflow-hidden mx-auto mb-4">
                  <Image src="/images/service3.jpg" alt="Jukka Nieminen" fill className="object-cover" />
                </div>
                <h3 className="text-xl font-bold mb-2">Jukka Nieminen</h3>
                <p className="text-purple-600 font-semibold mb-2">Tekninen asiantuntija</p>
                <p className="text-gray-600 text-sm">
                  Huolehtii, että kaikki laitteet toimivat moitteettomasti 
                  ja palvelu on tehokasta.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-purple-600 py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-white mb-8">
              Valmis kokeilemaan palveluitamme?
            </h2>
            <p className="text-xl text-purple-100 mb-8">
              Varaa aikasi jo tänään ja anna autollesi ansaitsemansa hoito!
            </p>
            <Link 
              href="/booking"
              className="inline-block bg-white text-purple-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Varaa aika
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}