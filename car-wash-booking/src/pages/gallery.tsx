// ...existing code...
import Image from 'next/image';
import Footer from '../components/Footer';
import Header from '../components/Header';
import SEO from '../components/SEO';
import FloatingContact from '../components/FloatingContact';
import { siteConfig } from '../lib/siteConfig';

export default function Gallery() {
  const beforeAfterGallery = [
    {
      before: 'https://images.unsplash.com/photo-1542362567-b07e54358753?q=80&w=600&auto=format&fit=crop',
      after: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=600&auto=format&fit=crop',
      title: 'Peruspesu',
      description: 'Puhdas ja siisti'
    },
    {
      before: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=600&auto=format&fit=crop',
      after: 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?q=80&w=600&auto=format&fit=crop',
      title: 'Erikoispesu',
      description: 'Kiiltävä vahakäsittely'
    },
    {
      before: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=600&auto=format&fit=crop',
      after: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=600&auto=format&fit=crop',
      title: 'Sisäpuolen siivous',
      description: 'Puhdas sisustus'
    },
    {
      before: 'https://images.unsplash.com/photo-1609521263047-f8f205293f24?q=80&w=600&auto=format&fit=crop',
      after: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?q=80&w=600&auto=format&fit=crop',
      title: 'Kokonaishuolto',
      description: 'Täydellinen lopputulos'
    }
  ];

  return (
    <>
      <SEO
        title={`Galleria - ${siteConfig.name}`}
        description="Katso kuvia töistämme ja tyytyväisistä asiakkaistamme."
      />
      <Header />
      <main className="bg-slate-50 min-h-screen">
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 py-20">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center bg-purple-500/20 backdrop-blur-sm border border-purple-400/30 rounded-full px-6 py-2 mb-8">
              <span className="text-purple-300 text-sm font-medium">
                📸 Transformaatiot
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-6">
              <span className="block bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">
                Galleria
              </span>
            </h1>
            <p className="text-xl text-silver-200 max-w-3xl mx-auto">
              Katso miten autosi muuttuu ammattitaitoisen autopesupalvelumme ansiosta.
              Laadukasta työtä kilpailukykyisillä hinnoilla.
            </p>
          </div>
        </div>
        
        <section className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {beforeAfterGallery.map((transformation, idx) => (
              <div key={idx} className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
                <div className="relative">
                  {/* Single Image */}
                  <div className="relative h-52">
                    <Image
                      src={transformation.after}
                      alt={transformation.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-display text-lg font-bold text-navy-900 mb-2 group-hover:text-purple-600 transition-colors">
                    {transformation.title}
                  </h3>
                  <p className="text-slate-600 text-sm">{transformation.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-r from-navy-900 to-navy-800 py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-4xl font-bold text-white mb-6">Haluat nähdä luksusautosi transformaation?</h2>
            <p className="text-lg text-silver-200 mb-8 max-w-3xl mx-auto">
              Varaa autopesuaika ja jaa upea lopputulos sosiaalisessa mediassa merkitsemällä meidät!
              Parhaimmat ennen/jälkeen -kuvat julkaistaan galleriassamme.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <a
                href={siteConfig.social.facebook}
                className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
              >
                Seuraa Facebookissa
              </a>
              <a
                href={siteConfig.social.instagram}
                className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:border-purple-400/50"
              >
                Seuraa Instagramissa
              </a>
            </div>
            <a
              href="/booking"
              className="inline-flex items-center bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-xl"
            >
              Varaa aika nyt
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </section>
      </main>
      <Footer />
      <FloatingContact />
    </>
  );
}