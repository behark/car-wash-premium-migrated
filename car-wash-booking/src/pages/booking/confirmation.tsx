import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import SEO from '../../components/SEO';
import { siteConfig } from '../../lib/siteConfig';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { getBookingByConfirmationCode, BookingData } from '../../lib/booking-storage';

interface BookingDetails {
  id: number;
  confirmationCode: string;
  service: {
    titleFi: string;
    titleEn: string;
    priceCents: number;
    durationMinutes: number;
  };
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  status: string;
  paymentStatus: string;
}

export default function BookingConfirmation() {
  const router = useRouter();
  const { session_id, booking: confirmationCode } = router.query;
  const [loading, setLoading] = useState(true);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [error, setError] = useState('');

  const verifyPaymentAndGetBooking = useCallback(async () => {
    try {
      const response = await fetch(`/api/payment/verify?sessionId=${session_id}`);
      const data = await response.json();

      if (data.success) {
        setBookingDetails(data.booking);
      } else {
        setError('Maksun vahvistus epäonnistui');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setError('Virhe maksun vahvistuksessa');
    } finally {
      setLoading(false);
    }
  }, [session_id]);

  const getBookingDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/bookings/${confirmationCode}`);
      const data = await response.json();

      if (data.success) {
        setBookingDetails(data.booking);
      } else {
        setError('Varauksen tietoja ei löytynyt');
      }
    } catch (error) {
      console.error('Get booking error:', error);
      setError('Virhe varauksen hakemisessa');
    } finally {
      setLoading(false);
    }
  }, [confirmationCode]);

  useEffect(() => {
    if (session_id && confirmationCode) {
      verifyPaymentAndGetBooking();
    } else if (confirmationCode) {
      getBookingDetails();
    }
  }, [session_id, confirmationCode, verifyPaymentAndGetBooking, getBookingDetails]);

  const formatPrice = (priceCents: number) => {
    return `${(priceCents / 100).toFixed(2)} €`;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE d.M.yyyy', { locale: fi });
    } catch {
      return dateString;
    }
  };

  return (
    <>
      <SEO
        title={`Varausvahvistus - ${siteConfig.name}`}
        description="Kiitos varauksestasi! Vahvistus on lähetetty sähköpostiisi."
      />
      <Header />

      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-20 pb-12">
        <div className="container mx-auto px-4 py-16 max-w-2xl">
          {loading ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
                <svg className="animate-spin h-12 w-12 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-lg text-slate-600">Vahvistetaan varaustasi...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Virhe varauksessa</h1>
              <p className="text-slate-600 mb-6">{error}</p>
              <Link href="/booking">
                <a className="inline-flex items-center justify-center px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors">
                  Palaa varaukseen
                </a>
              </Link>
            </div>
          ) : bookingDetails ? (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* Success Header */}
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-8 py-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur rounded-full mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Varaus vahvistettu!</h1>
                <p className="text-white/90">Kiitos varauksestasi, {bookingDetails.customerName}</p>
              </div>

              {/* Confirmation Code */}
              <div className="p-8">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-8 text-center">
                  <p className="text-sm text-slate-600 mb-2">Vahvistuskoodi</p>
                  <p className="text-3xl font-bold text-amber-600 tracking-wider">
                    {bookingDetails.confirmationCode}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">Säilytä tämä koodi</p>
                </div>

                {/* Booking Details */}
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 mb-3">Varauksen tiedot</h2>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Palvelu:</span>
                        <span className="font-medium text-slate-900">{bookingDetails.service.titleFi}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Päivämäärä:</span>
                        <span className="font-medium text-slate-900">{formatDate(bookingDetails.date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Aika:</span>
                        <span className="font-medium text-slate-900">
                          {bookingDetails.startTime} - {bookingDetails.endTime}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Hinta:</span>
                        <span className="font-medium text-slate-900">{formatPrice(bookingDetails.service.priceCents)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Maksun tila:</span>
                        <span className="font-medium text-green-600">
                          {bookingDetails.paymentStatus === 'PAID' ? '✓ Maksettu' : 'Odottaa maksua'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 mb-3">Osoite</h2>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="font-medium text-slate-900">{siteConfig.name}</p>
                      <p className="text-slate-600">
                        {siteConfig.address.street}<br />
                        {siteConfig.address.postalCode} {siteConfig.address.city}
                      </p>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(siteConfig.address.mapsQuery)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-amber-600 hover:text-amber-700 mt-2 text-sm"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Näytä kartalla
                      </a>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 mb-3">Mitä seuraavaksi?</h2>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <ul className="space-y-2 text-sm text-slate-700">
                        <li className="flex items-start">
                          <svg className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Vahvistus on lähetetty sähköpostiisi</span>
                        </li>
                        <li className="flex items-start">
                          <svg className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Saat muistutuksen 24h ennen varaustasi</span>
                        </li>
                        <li className="flex items-start">
                          <svg className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Saavu paikalle 5 min ennen varattua aikaa</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <Link href="/">
                      <a className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors">
                        Palaa etusivulle
                      </a>
                    </Link>
                    <button
                      onClick={() => window.print()}
                      className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Tulosta vahvistus
                    </button>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="mt-8 pt-8 border-t border-slate-200 text-center text-sm text-slate-600">
                  <p className="mb-2">Tarvitsetko apua?</p>
                  <p>
                    Puh: <a href={`tel:${siteConfig.phone.tel}`} className="text-amber-600 hover:text-amber-700 font-medium">{siteConfig.phone.display}</a>
                    {' | '}
                    Email: <a href={`mailto:${siteConfig.email}`} className="text-amber-600 hover:text-amber-700 font-medium">{siteConfig.email}</a>
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </>
  );
}