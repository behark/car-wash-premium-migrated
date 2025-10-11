import Link from 'next/link';
import Image from 'next/image';
import { siteConfig } from '../lib/siteConfig';
import { useState } from 'react';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="fixed w-full top-0 z-50 bg-navy-900/95 backdrop-blur-md border-b border-silver-200/20 shadow-xl">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            {siteConfig.logoPath && (
              <div className="relative w-10 h-10">
                <Image
                  src={siteConfig.logoPath}
                  alt={siteConfig.name}
                  fill
                  className="object-contain group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xl font-display font-bold text-white group-hover:text-gold-400 transition-colors">
                {siteConfig.shortName}
              </span>
              <span className="text-xs text-silver-300 hidden sm:block">Kiilto & Loisto</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            <Link href="/services" className="text-silver-200 hover:text-gold-400 font-medium transition-colors duration-200 relative group">
              Palvelut
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gold-400 group-hover:w-full transition-all duration-300"></span>
            </Link>
            <Link href="/gallery" className="text-silver-200 hover:text-gold-400 font-medium transition-colors duration-200 relative group">
              Galleria
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gold-400 group-hover:w-full transition-all duration-300"></span>
            </Link>
            <Link href="/testimonials" className="text-silver-200 hover:text-gold-400 font-medium transition-colors duration-200 relative group">
              Arvostelut
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gold-400 group-hover:w-full transition-all duration-300"></span>
            </Link>
            <Link href="/about" className="text-silver-200 hover:text-gold-400 font-medium transition-colors duration-200 relative group">
              Tietoa meistä
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gold-400 group-hover:w-full transition-all duration-300"></span>
            </Link>
            <Link href="/contact" className="text-silver-200 hover:text-gold-400 font-medium transition-colors duration-200 relative group">
              Yhteystiedot
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gold-400 group-hover:w-full transition-all duration-300"></span>
            </Link>
          </nav>

          {/* Contact & CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <a
              href={`tel:${siteConfig.phone.tel}`}
              className="flex items-center space-x-2 text-silver-200 hover:text-gold-400 transition-colors group"
            >
              <div className="w-8 h-8 bg-gold-500/20 rounded-full flex items-center justify-center group-hover:bg-gold-500/30 transition-colors">
                <svg className="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <span className="font-semibold">{siteConfig.phone.display}</span>
            </a>

            <Link
              href="/booking"
              className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-semibold px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Varaa aika
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-silver-200 focus:outline-none focus:ring-2 focus:ring-gold-500 rounded-lg p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <svg className={`w-6 h-6 transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${isMobileMenuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <nav className="py-4 space-y-2 border-t border-silver-600/30 overflow-y-auto">
            <Link href="/services" className="block px-4 py-3 text-silver-200 hover:bg-gold-500/10 hover:text-gold-400 rounded-lg transition-colors">
              Palvelut
            </Link>
            <Link href="/gallery" className="block px-4 py-3 text-silver-200 hover:bg-gold-500/10 hover:text-gold-400 rounded-lg transition-colors">
              Galleria
            </Link>
            <Link href="/testimonials" className="block px-4 py-3 text-silver-200 hover:bg-gold-500/10 hover:text-gold-400 rounded-lg transition-colors">
              Arvostelut
            </Link>
            <Link href="/about" className="block px-4 py-3 text-silver-200 hover:bg-gold-500/10 hover:text-gold-400 rounded-lg transition-colors">
              Tietoa meistä
            </Link>
            <Link href="/contact" className="block px-4 py-3 text-silver-200 hover:bg-gold-500/10 hover:text-gold-400 rounded-lg transition-colors">
              Yhteystiedot
            </Link>
            <div className="pt-4 border-t border-silver-600/30">
              <a
                href={`tel:${siteConfig.phone.tel}`}
                className="block px-4 py-3 text-gold-400 font-semibold"
              >
                📞 {siteConfig.phone.display}
              </a>
              <Link
                href="/booking"
                className="block mx-4 mt-2 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold px-6 py-3 rounded-xl text-center transition-all duration-300"
              >
                Varaa aika nyt
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}