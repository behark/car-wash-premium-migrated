/**
 * Offline Fallback Page
 * Shown when users are offline and try to access uncached content
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { siteConfig } from '../lib/siteConfig';
import { useOnlineStatus } from '../components/PWA/OfflineIndicator';
import { bookingStorage, serviceStorage } from '../lib/pwa/offlineStorage';

interface OfflineBooking {
  id: string;
  serviceName: string;
  date: string;
  startTime: string;
  status: string;
}

export default function OfflinePage() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [recentBookings, setRecentBookings] = useState<OfflineBooking[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load offline data
    const loadOfflineData = async () => {
      try {
        const [bookings, availableServices] = await Promise.all([
          bookingStorage.getAll(),
          serviceStorage.getAll(),
        ]);

        // Sort bookings by date and take the 3 most recent
        const sortedBookings = bookings
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 3)
          .map(booking => ({
            id: booking.id,
            serviceName: booking.serviceName,
            date: booking.date,
            startTime: booking.startTime,
            status: booking.status,
          }));

        setRecentBookings(sortedBookings);
        setServices(availableServices.filter(s => s.isActive));
      } catch (error) {
        console.error('Failed to load offline data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOfflineData();
  }, []);

  useEffect(() => {
    // Redirect when back online if user wants to
    if (isOnline) {
      const timer = setTimeout(() => {
        // Auto-redirect after 3 seconds when back online
        router.back();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, router]);

  const handleRetry = () => {
    if (isOnline) {
      router.back();
    } else {
      window.location.reload();
    }
  };

  return (
    <>
      <Head>
        <title>Offline - {siteConfig.name}</title>
        <meta name="description" content="Olet offline-tilassa. Voit silti käyttää sovelluksen perusominaisuuksia." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7v10c0 5.55 3.84 9.739 9 11 5.16-1.261 9-5.45 9-11V7l-10-5z"/>
                  </svg>
                </div>
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  {siteConfig.name}
                </span>
              </Link>

              <div className="flex items-center space-x-2">
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isOnline
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                }`}>
                  {isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-8"
          >
            {/* Offline Icon */}
            <div className="mx-auto w-24 h-24 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.69 3.61.82 1.89 3.2L12 21.04l3.4 1.46 1.89-3.2 3.61-.82-.34-3.69L23 12zm-10 5h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>

            {/* Status Message */}
            <div className="space-y-4">
              {isOnline ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">
                    Yhteys palautunut!
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    Internetyhteys on jälleen käytettävissä. Sinut ohjataan takaisin automaattisesti.
                  </p>
                  <button
                    onClick={handleRetry}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-xl transition-colors"
                  >
                    Jatka heti
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Ei internetyhteyttä
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    Olet offline-tilassa, mutta voit silti käyttää sovelluksen perusominaisuuksia.
                  </p>
                  <button
                    onClick={handleRetry}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-xl transition-colors"
                  >
                    Yritä uudelleen
                  </button>
                </div>
              )}
            </div>

            {/* Available Offline Content */}
            {!loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="grid md:grid-cols-2 gap-8 text-left"
              >
                {/* Recent Bookings */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2 mb-4">
                    <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Viimeisimmät varaukset
                    </h2>
                  </div>

                  {recentBookings.length > 0 ? (
                    <div className="space-y-3">
                      {recentBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">
                            {booking.serviceName}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(booking.date).toLocaleDateString('fi-FI')} kello {booking.startTime}
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${
                            booking.status === 'confirmed'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {booking.status === 'confirmed' ? 'Vahvistettu' : 'Odottaa'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Ei tallennettuja varauksia offline-tilassa
                    </p>
                  )}
                </div>

                {/* Available Services */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2 mb-4">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Saatavilla offline-tilassa
                    </h2>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Palveluiden selaaminen</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Varausten luonnos (synkronoituu myöhemmin)</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Yhteystietojen katselu</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Gallerian selaaminen</span>
                    </div>
                  </div>

                  {services.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Offline-tilassa saatavilla {services.length} palvelua
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Navigation Links */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <Link
                href="/"
                className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors group"
              >
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Etusivu</span>
                </div>
              </Link>

              <Link
                href="/services"
                className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors group"
              >
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Palvelut</span>
                </div>
              </Link>

              <Link
                href="/contact"
                className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors group"
              >
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Yhteystiedot</span>
                </div>
              </Link>

              <Link
                href="/gallery"
                className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors group"
              >
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mx-auto group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-colors">
                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Galleria</span>
                </div>
              </Link>
            </motion.div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-6">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {siteConfig.name} - Toimii myös offline-tilassa
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}