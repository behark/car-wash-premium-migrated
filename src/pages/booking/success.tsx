import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import SEO from '../../components/SEO';

export default function BookingSuccess() {
  const router = useRouter();
  const { booking: confirmationCode } = router.query;

  return (
    <>
      <SEO
        title="Varaus Vahvistettu - Autopesu Kiilto & Loisto"
        description="Varauksesi on vahvistettu onnistuneesti"
      />
      <Header />

      <main className="min-h-screen bg-gradient-to-b from-navy-50 to-silver-50 py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-silver-200 p-8 text-center">
              {/* Success Icon */}
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>

              {/* Success Message */}
              <h1 className="text-3xl font-bold text-navy-800 mb-4">
                Varaus Vahvistettu! 🎉
              </h1>

              <p className="text-lg text-silver-600 mb-6">
                Varauksesi on vastaanotettu onnistuneesti.
              </p>

              {/* Confirmation Details */}
              {confirmationCode && (
                <div className="bg-gold-50 border border-gold-200 rounded-xl p-6 mb-6">
                  <h3 className="font-semibold text-navy-800 mb-2">Vahvistuskoodi:</h3>
                  <div className="text-2xl font-mono font-bold text-gold-600">
                    {confirmationCode}
                  </div>
                  <p className="text-sm text-silver-600 mt-2">
                    Tallenna tämä koodi. Tarvitset sen mahdollisia muutoksia varten.
                  </p>
                </div>
              )}

              {/* Next Steps */}
              <div className="bg-navy-50 rounded-xl p-6 mb-6 text-left">
                <h3 className="font-semibold text-navy-800 mb-4">Mitä tapahtuu seuraavaksi?</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-gold-500 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">1</div>
                    <div>
                      <p className="font-medium text-navy-700">Vahvistus</p>
                      <p className="text-sm text-silver-600">Otamme yhteyttä 24 tunnin sisällä vahvistaaksemme varauksen.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-gold-500 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">2</div>
                    <div>
                      <p className="font-medium text-navy-700">Valmistautuminen</p>
                      <p className="text-sm text-silver-600">Saavu osoitteeseen Läkkisepäntie 15, 00620 Helsinki sovittuna aikana.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-gold-500 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">3</div>
                    <div>
                      <p className="font-medium text-navy-700">Autopesu</p>
                      <p className="text-sm text-silver-600">Nauti ammattitaitoisesta autopesupalvelustamme!</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="border-t border-silver-200 pt-6">
                <p className="text-silver-600 mb-4">Kysymyksiä? Ota yhteyttä:</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="tel:+358449608148"
                    className="flex items-center justify-center space-x-2 bg-navy-600 text-white px-6 py-3 rounded-xl hover:bg-navy-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                    </svg>
                    <span>044 960 8148</span>
                  </a>

                  <a
                    href="mailto:Info@kiiltoloisto.fi"
                    className="flex items-center justify-center space-x-2 bg-gold-600 text-white px-6 py-3 rounded-xl hover:bg-gold-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                    </svg>
                    <span>Info@kiiltoloisto.fi</span>
                  </a>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/booking"
                    className="bg-gradient-to-r from-gold-500 to-gold-600 text-white font-semibold px-8 py-4 rounded-xl hover:from-gold-600 hover:to-gold-700 transition-all duration-300 transform hover:scale-105 text-center"
                  >
                    Varaa Uusi Aika
                  </Link>

                  {confirmationCode && (
                    <Link
                      href={`/manage?code=${confirmationCode}`}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 text-center"
                    >
                      Hallinnoi varausta
                    </Link>
                  )}
                </div>

                <div className="text-sm space-y-2">
                  <div>
                    <Link
                      href="/reviews"
                      className="text-green-600 hover:text-green-800 underline"
                    >
                      ⭐ Jätä arvostelu palvelustamme
                    </Link>
                  </div>
                  <div>
                    <Link
                      href="/"
                      className="text-navy-600 hover:text-navy-800 underline"
                    >
                      Palaa etusivulle
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}