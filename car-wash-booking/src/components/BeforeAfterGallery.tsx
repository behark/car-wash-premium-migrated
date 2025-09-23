import Image from 'next/image';
import Link from 'next/link';

export default function BeforeAfterGallery() {
  const featuredTransformations = [
    {
      before: 'https://images.unsplash.com/photo-1542362567-b07e54358753?q=80&w=600&auto=format&fit=crop',
      after: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=600&auto=format&fit=crop',
      title: 'Peruspesu',
      description: 'Likainen auto → Puhdas ja siisti'
    },
    {
      before: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=600&auto=format&fit=crop',
      after: 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?q=80&w=600&auto=format&fit=crop',
      title: 'Erikoispesu',
      description: 'Himmeä pinta → Kiiltävä vahakäsittely'
    },
    {
      before: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=600&auto=format&fit=crop',
      after: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=600&auto=format&fit=crop',
      title: 'Sisäpuolen siivous',
      description: 'Sotkuinen sisätila → Puhdas sisustus'
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            📸 Ennen & Jälkeen tulokset
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-navy-900 mb-6">
            Näin teemme autosi kiiltäväksi
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Katso miten autosi muuttuu ammattitaitoisen autopesupalvelumme ansiosta.
            Laadukasta työtä kilpailukykyisillä hinnoilla.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {featuredTransformations.map((transformation, index) => (
            <div
              key={index}
              className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
            >
              <div className="relative">
                {/* Before/After Images */}
                <div className="grid grid-cols-2 gap-1">
                  <div className="relative h-52">
                    <Image
                      src={transformation.before}
                      alt={`Ennen - ${transformation.title}`}
                      fill
                      sizes="(min-width: 1024px) 16vw, (min-width: 768px) 25vw, 50vw"
                      className="object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-navy-900/80 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs font-bold">
                      ENNEN
                    </div>
                  </div>
                  <div className="relative h-52">
                    <Image
                      src={transformation.after}
                      alt={`Jälkeen - ${transformation.title}`}
                      fill
                      sizes="(min-width: 1024px) 16vw, (min-width: 768px) 25vw, 50vw"
                      className="object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-2 py-1 rounded-lg text-xs font-bold">
                      JÄLKEEN
                    </div>
                  </div>
                </div>

                {/* Transformation Arrow */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
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

        <div className="text-center animate-fade-in">
          <Link
            href="/gallery"
            className="inline-flex items-center bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl group"
          >
            Katso kaikki transformaatiot
            <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}