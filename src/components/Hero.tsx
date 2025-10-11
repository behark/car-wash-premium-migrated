import Image from 'next/image';
import { siteConfig } from '../lib/siteConfig';

export default function Hero() {
  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background Video/Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={process.env.NEXT_PUBLIC_HERO_IMAGE || siteConfig.heroImage}
          alt="Kiilto & Loisto autopesu palvelut"
          fill
          priority
          sizes="100vw"
          className="object-cover scale-105 animate-slow-zoom"
        />
        {/* Refined Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900/70 via-navy-800/60 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
      </div>

      {/* Floating Trust Badges */}
      <div className="absolute top-8 right-8 z-20 hidden lg:block">
        <div className="flex flex-col space-y-4">
          <div className="bg-white/10 backdrop-blur-lg shadow-2xl border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-medium animate-fade-in hover:scale-105 transition-all duration-300">
            ⭐ {siteConfig.features.rating} / 5.0 Arvosana
          </div>
          <div className="bg-white/10 backdrop-blur-lg shadow-2xl border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-medium animate-fade-in animation-delay-500 hover:scale-105 transition-all duration-300">
            📞 {siteConfig.phone.display}
          </div>
          <div className="bg-white/10 backdrop-blur-lg shadow-2xl border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-medium animate-fade-in animation-delay-1000 hover:scale-105 transition-all duration-300">
            🕒 {siteConfig.hours[0].label}: {siteConfig.hours[0].value}, {siteConfig.hours[1].label}: {siteConfig.hours[1].value}
          </div>
        </div>
      </div>

      {/* Main Hero Content */}
      <div className="relative z-10 text-center text-white px-4 max-w-6xl mx-auto">
        {/* Hero Badge */}
        <div className="inline-flex items-center bg-white/10 backdrop-blur-lg shadow-xl border border-white/20 rounded-full px-6 py-3 mb-8 animate-slide-down hover:scale-105 transition-all duration-300">
          <span className="text-white text-sm font-medium">
            🚗 Laadukasta autopesupalvelua kilpailukykyisillä hinnoilla
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-6 animate-slide-up">
          <span className="block text-white">Huolellisesti</span>
          <span className="block bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">
            Kiiltävään Lopputulokseen
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl lg:text-3xl text-silver-200 mb-4 max-w-4xl mx-auto leading-relaxed animate-slide-up animation-delay-200">
          {siteConfig.tagline}
        </p>

        <p className="text-lg md:text-xl text-silver-300 mb-12 max-w-3xl mx-auto animate-slide-up animation-delay-300">
          {siteConfig.subtitle} - luotettavaa laatua ja kilpailukykyiset hinnat.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up animation-delay-500">
          <button
            onClick={() => window.location.href = '/booking'}
            className="group relative bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-5 px-10 rounded-xl text-xl transition-all duration-300 transform hover:scale-110 shadow-xl hover:shadow-glow-lg ring-2 ring-purple-400/50 hover:ring-purple-300"
          >
            <span className="relative z-10 flex items-center gap-2">
              Varaa aika nyt
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-purple-500 rounded-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300 blur-sm"></div>
          </button>

          <button
            onClick={() => window.location.href = '/services'}
            className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 hover:border-purple-400/50"
          >
            Tutustu palveluihin
          </button>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 animate-fade-in animation-delay-700">
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-400">{siteConfig.features.rating}</div>
            <div className="text-sm text-silver-300">⭐ Asiakasarvosana</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-400">{siteConfig.features.customers}</div>
            <div className="text-sm text-silver-300">Tyytyväistä asiakasta</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-400">{siteConfig.features.years}</div>
            <div className="text-sm text-silver-300">Vuotta kokemusta</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-400">{siteConfig.hours[0].label} {siteConfig.hours[0].value}</div>
            <div className="text-sm text-silver-300">📅 Aukioloajat</div>
            <div className="text-xs text-silver-400">{siteConfig.hours[1].label} {siteConfig.hours[1].value}</div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/60 rounded-full mt-2"></div>
        </div>
      </div>
    </div>
  );
}