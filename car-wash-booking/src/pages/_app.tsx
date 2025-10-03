import '../styles/globals.css';
import '../styles/animations.css';
import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { siteConfig } from '../lib/siteConfig';
import { register as registerSW } from '../lib/pwa/serviceWorker';
import { initDB } from '../lib/pwa/offlineStorage';
import OfflineIndicator from '../components/PWA/OfflineIndicator';
import { initPerformanceOptimizations } from '../utils/performance';

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  const canonicalPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const canonicalUrl = siteConfig.siteUrl + (canonicalPath || '/');

  useEffect(() => {
    // Initialize performance optimizations
    initPerformanceOptimizations();

    // Initialize PWA features
    const initPWA = async () => {
      try {
        // Initialize offline database
        await initDB();

        // Register service worker
        registerSW({
          onSuccess: (registration) => {
            console.log('SW registered successfully');
          },
          onUpdate: (registration) => {
            console.log('SW update available');
            setSwUpdateAvailable(true);
          },
          onOffline: () => {
            console.log('App is offline');
          },
          onOnline: () => {
            console.log('App is online');
          },
        });

        // Store beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
          e.preventDefault();
          (window as any).deferredPrompt = e;
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
      } catch (error) {
        console.error('Failed to initialize PWA features:', error);
      }
    };

    initPWA();
  }, []);

  const handleUpdateSW = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
  };

  return (
    <SessionProvider session={session}>
      <Head>
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content={siteConfig.name} />
      </Head>

      {/* PWA Components */}
      <OfflineIndicator />


      {/* SW Update Banner */}
      {swUpdateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white p-3 text-center">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <span className="text-sm">Uusi versio saatavilla!</span>
            <div className="space-x-2">
              <button
                onClick={handleUpdateSW}
                className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Päivitä
              </button>
              <button
                onClick={() => setSwUpdateAvailable(false)}
                className="text-blue-200 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <Component {...pageProps} />
    </SessionProvider>
  );
}