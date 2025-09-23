import Link from 'next/link';
import { useState } from 'react';
import { siteConfig } from '../lib/siteConfig';

export default function FloatingContact() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Expanded Contact Menu */}
      <div className={`transition-all duration-300 transform ${isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="bg-white rounded-2xl shadow-2xl p-4 mb-4 border border-gold-200 min-w-[280px]">
          <div className="text-center mb-4">
            <h3 className="font-bold text-navy-900 text-lg">Ota yhteyttä</h3>
            <p className="text-slate-600 text-sm">Premium autopesupalvelu</p>
          </div>

          <div className="space-y-3">
            {/* Call Button */}
            <a
              href={`tel:${siteConfig.phone.tel}`}
              className="flex items-center justify-center w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-semibold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {siteConfig.phone.display}
            </a>

            {/* Book Now Button */}
            <Link
              href="/booking"
              className="flex items-center justify-center w-full bg-navy-900 hover:bg-navy-800 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Varaa aika nyt
            </Link>

            {/* WhatsApp Button */}
            <a
              href={`https://wa.me/${siteConfig.phone.tel.replace('+', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.106"/>
              </svg>
              WhatsApp
            </a>

            {/* Email Button */}
            <a
              href={`mailto:${siteConfig.email}`}
              className="flex items-center justify-center w-full bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Sähköposti
            </a>
          </div>

          {/* Business Hours */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="text-center">
              <p className="text-xs font-medium text-slate-700 mb-1">Aukioloajat</p>
              {siteConfig.hours.map((hour, index) => (
                <p key={index} className="text-xs text-slate-600">
                  {hour.label}: {hour.value}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Floating Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`group relative bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 ${isExpanded ? 'rotate-45' : ''}`}
        aria-label="Ota yhteyttä"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>

        {/* Pulse Animation */}
        <div className="absolute inset-0 bg-gold-400 rounded-full animate-ping opacity-30"></div>
        <div className="absolute inset-0 bg-gold-400 rounded-full animate-pulse opacity-20"></div>
      </button>

      {/* Tooltip for closed state */}
      {!isExpanded && (
        <div className="absolute bottom-full right-0 mb-2 bg-navy-900 text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Ota yhteyttä
        </div>
      )}
    </div>
  );
}